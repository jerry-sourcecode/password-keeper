import { getParentPath } from '@/utils/path'
import { uuid } from '@/utils/utils'

export interface IEntry {
    id: string
    path: string          // 不以 / 结尾，唯一标识
    title: string
    type: string
    data: Record<string, any>
    createdAt: number
    updatedAt: number
}

export type EntryData = Record<string, any>

export abstract class Entry implements IEntry {
    id: string
    path: string
    title: string
    type: string
    data: EntryData
    createdAt: number
    updatedAt: number

    abstract getSize(): number;

    constructor({
        id = uuid(),
        path,
        title,
        type,
        data = {},
        createdAt = Date.now(),
        updatedAt = Date.now(),
    }: Partial<IEntry> & { path: string; title: string; type: string }) {
        if (path.endsWith('/')) {
            throw new Error(`条目路径不能以 / 结尾: ${path}`)
        }
        this.id = id
        this.path = path
        this.title = title
        this.type = type
        this.data = data
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }

    // 获取所属文件夹路径（从 path 推导）
    getFolderPath(): string {
        return getParentPath(this.path)
    }

    getDisplayData(): EntryData {
        return this.data
    }

    update(updates: Partial<Pick<IEntry, 'title' | 'data'>>): this {
        if (updates.title !== undefined) this.title = updates.title
        if (updates.data !== undefined) this.data = { ...this.data, ...updates.data }
        this.updatedAt = Date.now()
        return this
    }

    toPlain(): IEntry {
        return {
            id: this.id,
            path: this.path,
            title: this.title,
            type: this.type,
            data: { ...this.data },
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}