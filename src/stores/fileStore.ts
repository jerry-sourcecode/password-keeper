import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Folder, type IFolder } from '@/models/Folder'
import { Entry, type IEntry } from '@/models/Entry'
import { EntryFactory, type EntryType } from '@/models/EntryFactory'
import { isFolderPath, getParentPath, getBaseName, joinPath, isUnderFolder } from '@/utils/path'
import type { TYPE_PASSWORD, PasswordData } from '@/models/PasswordEntry'
import type { TYPE_TEXT, TextData } from '@/models/TextEntry'
import { watch } from 'vue'
import { Crypto } from '@/utils/crypto'


export type EntryTypeMap = {
    [TYPE_PASSWORD]: PasswordData;
    [TYPE_TEXT]: TextData;
}

// 存储上限：100MB = 104857600 字节
export const MAX_STORAGE = 100 * 1024 * 1024

export const useFileStore = defineStore('file', () => {
    // ---------- 状态 ----------
    const folders = ref<IFolder[]>([])
    const items = ref<IEntry[]>([])

    watch(folders, () => {
        Crypto.load();
    }, { deep: true });
    watch(items, () => {
        Crypto.load();
    }, { deep: true });

    // 初始化根目录
    function initRoot() {
        if (!folders.value.some(f => f.path === '/')) {
            folders.value.push({ id: 'root', path: '/', name: '/', createdAt: Date.now(), updatedAt: Date.now() })
        }
    }
    initRoot()

    // ---------- 辅助函数 ----------
    function getFolderByPath(path: string): Folder | null {
        const plain = folders.value.find(f => f.path === path)
        return plain ? new Folder({ id: plain.id, path: plain.path, name: plain.name }) : null
    }

    function getFolderById(id: string): Folder | null {
        const plain = folders.value.find(f => f.id === id)
        return plain ? new Folder({ id: plain.id, path: plain.path, name: plain.name }) : null
    }

    function getEntryById(id: string): Entry | null {
        const plain = items.value.find(i => i.id === id)
        return plain ? EntryFactory.fromPlain(plain) : null
    }

    function getEntryByPath(path: string): Entry | null {
        const plain = items.value.find(i => i.path === path)
        return plain ? EntryFactory.fromPlain(plain) : null
    }

    // 检查是否存在同名文件或文件夹（a.txt 与 a.txt/ 视为冲突）
    function isNameTaken(path: string): boolean {
        return (
            items.value.some(i => i.path === path) ||
            folders.value.some(f => f.path === path + '/')
        )
    }

    // ---------- 文件夹操作 ----------
    function addFolder(path: string, name?: string): Folder {
        if (!isFolderPath(path)) {
            throw new Error(`文件夹路径必须以 / 结尾: ${path}`)
        }
        if (folders.value.some(f => f.path === path)) {
            throw new Error(`文件夹已存在: ${path}`)
        }
        const parentPath = getParentPath(path)
        if (parentPath !== path && !folders.value.some(f => f.path === parentPath)) {
            throw new Error(`父文件夹不存在: ${parentPath}`)
        }
        const folder = new Folder({ path, name })
        folders.value.push(folder.toPlain())
        return folder
    }

    function deleteFolder(id: string): void {
        const folder = getFolderById(id)
        if (!folder) return
        if (folder.path === '/') {
            throw new Error('不能删除根目录')
        }
        // 删除所有子文件夹
        const childFolders = folders.value.filter(f => f.path !== folder.path && isUnderFolder(f.path, folder.path))
        const childPaths = childFolders.map(f => f.path)
        // 删除所有条目（包括子文件夹中的）
        items.value = items.value.filter(item => !isUnderFolder(item.path, folder.path))
        // 删除文件夹本身及子文件夹
        folders.value = folders.value.filter(f => f.id !== id && !childPaths.includes(f.path))
    }

    function updateFolder(id: string, updates: Partial<Pick<IFolder, 'name'>>): boolean {
        const folder = folders.value.find(f => f.id === id)
        if (folder) {
            if (updates.name !== undefined) folder.name = updates.name
            return true
        }
        return false
    }

    // ---------- 条目操作 ----------
    function addItem<K extends keyof EntryTypeMap>(
        params: {
            id?: string;
            path: string;
            title: string;
            type: K;
            data?: EntryTypeMap[K];
        }
    ): Entry {
        if (params.path.endsWith('/')) {
            throw new Error(`条目路径不能以 / 结尾: ${params.path}`)
        }
        if (items.value.some(i => i.path === params.path)) {
            throw new Error(`条目已存在: ${params.path}`)
        }
        const folderPath = getParentPath(params.path)
        if (!folders.value.some(f => f.path === folderPath)) {
            throw new Error(`父文件夹不存在: ${folderPath}`)
        }
        const entry = EntryFactory.create(
            params.type as EntryType,
            {
                id: params.id,
                path: params.path,
                title: params.title,
                data: params.data as Record<string, any>,
            }
        )
        items.value.push(entry.toPlain())
        return entry
    }

    function deleteItem(id: string): void {
        items.value = items.value.filter(item => item.id !== id)
    }

    function updateItem(id: string, updates: Partial<Pick<IEntry, 'title' | 'data'>>): boolean {
        const plain = items.value.find(i => i.id === id)
        if (!plain) return false
        if (updates.title !== undefined) plain.title = updates.title
        if (updates.data !== undefined) plain.data = { ...plain.data, ...updates.data }
        plain.updatedAt = Date.now()
        return true
    }

    // ---------- 重命名 ----------
    function renameItem(id: string, newName: string): boolean {
        const plain = items.value.find(i => i.id === id)
        if (!plain) return false
        plain.path = joinPath(getParentPath(plain.path), newName)
        plain.title = newName
        plain.updatedAt = Date.now()
        return true
    }

    function renameFolder(id: string, newName: string): boolean {
        const folder = folders.value.find(f => f.id === id)
        if (!folder || folder.path === '/') return false
        _moveFolder(folder, joinPath(getParentPath(folder.path), newName) + '/')
        return true
    }

    // ---------- 移动 / 复制（paths 为 store 格式路径，文件夹以 / 结尾）----------
    function moveEntries(paths: string[], targetFolderPath: string): string[] {
        const blocked: string[] = []
        for (const p of paths) {
            if (isFolderPath(p)) {
                const folder = folders.value.find(f => f.path === p)
                if (!folder) continue
                const base = getBaseName(p)
                const newPath = joinPath(targetFolderPath, base) + '/'
                // 目标已存在同名文件或文件夹（排除自身所在位置）则跳过
                if (newPath !== folder.path && isNameTaken(joinPath(targetFolderPath, base))) {
                    blocked.push(base)
                    continue
                }
                _moveFolder(folder, newPath)
            } else {
                const plain = items.value.find(i => i.path === p)
                if (!plain) continue
                const base = getBaseName(p)
                const newPath = joinPath(targetFolderPath, base)
                if (newPath !== plain.path && isNameTaken(newPath)) {
                    blocked.push(base)
                    continue
                }
                plain.path = newPath
                plain.updatedAt = Date.now()
            }
        }
        return blocked
    }

    function copyEntries(paths: string[], targetFolderPath: string): string[] {
        const blocked: string[] = []
        for (const p of paths) {
            if (isFolderPath(p)) {
                const folder = folders.value.find(f => f.path === p)
                if (!folder) continue
                const base = getBaseName(p)
                // 目标已存在同名文件或文件夹则跳过
                if (isNameTaken(joinPath(targetFolderPath, base))) {
                    blocked.push(base)
                    continue
                }
                _copyFolder(folder, targetFolderPath)
            } else {
                const plain = items.value.find(i => i.path === p)
                if (!plain) continue
                const base = getBaseName(p)
                const newPath = joinPath(targetFolderPath, base)
                if (isNameTaken(newPath)) {
                    blocked.push(base)
                    continue
                }
                addItem({
                    path: newPath,
                    title: plain.title,
                    type: plain.type as EntryType,
                    data: { ...plain.data } as any,
                })
            }
        }
        return blocked
    }

    // 把文件夹及其所有后代移动到新路径
    function _moveFolder(folder: IFolder, newFolderPath: string): void {
        const oldPath = folder.path
        if (oldPath === newFolderPath) return
        folder.path = newFolderPath
        folder.name = getBaseName(newFolderPath) || '/'
        folders.value.forEach(f => {
            if (f.id !== folder.id && isUnderFolder(f.path, oldPath)) {
                f.path = newFolderPath + f.path.slice(oldPath.length)
            }
        })
        items.value.forEach(item => {
            if (isUnderFolder(item.path, oldPath)) {
                item.path = newFolderPath + item.path.slice(oldPath.length)
                item.updatedAt = Date.now()
            }
        })
    }

    // 复制文件夹（连同所有后代）到目标目录
    function _copyFolder(folder: IFolder, targetFolderPath: string): void {
        const oldPath = folder.path
        const newPath = joinPath(targetFolderPath, getBaseName(oldPath)) + '/'
        if (folders.value.some(f => f.path === newPath)) return
        addFolder(newPath)
        folders.value.forEach(f => {
            if (f.id !== folder.id && isUnderFolder(f.path, oldPath)) {
                addFolder(newPath + f.path.slice(oldPath.length), f.name)
            }
        })
        items.value.forEach(item => {
            if (isUnderFolder(item.path, oldPath)) {
                const newItemPath = newPath + item.path.slice(oldPath.length)
                if (items.value.some(i => i.path === newItemPath)) return
                addItem({
                    path: newItemPath,
                    title: item.title,
                    type: item.type as EntryType,
                    data: { ...item.data } as any,
                })
            }
        })
    }

    // 获取文件夹下的直接条目（不含子文件夹）
    function getItemsByFolder(folderPath: string): IEntry[] {
        return items.value.filter(item => getParentPath(item.path) === folderPath)
    }

    // 获取文件夹下的所有条目（包括子文件夹）
    function getAllItemsUnderFolder(folderPath: string): IEntry[] {
        return items.value.filter(item => isUnderFolder(item.path, folderPath))
    }

    function getItemsByType(type: EntryType): IEntry[] {
        return items.value.filter(item => item.type === type)
    }

    function searchItems(keyword: string): IEntry[] {
        const lower = keyword.toLowerCase()
        return items.value.filter(item => {
            if (item.title.toLowerCase().includes(lower)) return true
            const dataStr = Object.values(item.data).join(' ').toLowerCase()
            return dataStr.includes(lower)
        })
    }

    function resetAll(): void {
        folders.value = [{ id: 'root', path: '/', name: '/', createdAt: Date.now(), updatedAt: Date.now() }]
        items.value = []
    }

    // 生成 SVAR FileManager 所需的 data 数组
    const fileManagerData = computed(() => {
        const result: any[] = []

        // 添加所有文件夹（排除根目录 "/" —— SVAR 会自动创建根目录，
        // 若传入 id 为 "/" 的文件夹会形成自引用循环，导致 setLevel 无限递归）
        folders.value.forEach(f => {
            if (f.path === '/') return;
            // SVAR 要求文件夹 id 不能以 "/" 结尾（如 "/Code"），
            // 否则无法正确解析父文件夹，导致新建文件夹不显示
            result.push({
                id: f.path.replace(/\/$/, ''), // 必填：路径（去掉结尾 "/"）
                date: new Date(f.createdAt),   // 必填：日期对象
                type: 'folder',                // 可选：文件夹类型
                uid: f.id,                     // 自定义：内部 ID
                name: f.name,                  // 自定义：显示名称
            });
        })

        // 添加所有条目
        items.value.forEach(item => {
            result.push({
                id: item.path,                 // 必填：路径
                date: new Date(item.createdAt),// 必填：日期对象
                type: 'file',                  // 可选：文件类型
                uid: item.id,                  // 自定义：内部 ID
                title: item.title,             // 自定义：标题
                size: EntryFactory.fromPlain(item).getSize(), // 通过 Entry.getSize() 计算大小
            })
        })

        return result
    })

    // 所有条目的大小总和（字节）
    const totalSize = computed(() =>
        items.value.reduce(
            (sum, item) => sum + EntryFactory.fromPlain(item).getSize(),
            0,
        )
    )

    // 将某条目的内容替换为 newSize 字节后，是否会使总存储超出上限
    function wouldExceedLimit(entryId: string, newSize: number): boolean {
        const plain = items.value.find(i => i.id === entryId)
        if (!plain) return false
        const oldSize = EntryFactory.fromPlain(plain).getSize()
        return totalSize.value - oldSize + newSize > MAX_STORAGE
    }

    return {
        folders,
        items,
        // 文件夹
        addFolder,
        deleteFolder,
        updateFolder,
        getFolderById,
        getFolderByPath,
        // 条目
        addItem,
        deleteItem,
        updateItem,
        renameItem,
        renameFolder,
        moveEntries,
        copyEntries,
        getEntryById,
        getEntryByPath,
        isNameTaken,
        getItemsByFolder,
        getAllItemsUnderFolder,
        getItemsByType,
        searchItems,
        // 工具
        resetAll,
        // 信息
        fileManagerData,
        totalSize,
        wouldExceedLimit,
    }
})