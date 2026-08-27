// utils/path.ts

export function isFolderPath(path: string): boolean {
    return path.endsWith('/')
}

export function getParentPath(path: string): string {
    if (path === '/') return '/'
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
    const lastSlash = trimmed.lastIndexOf('/')
    if (lastSlash <= 0) return '/'
    return trimmed.slice(0, lastSlash + 1)
}

export function getBaseName(path: string): string {
    if (path === '/') return '/'
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
    const lastSlash = trimmed.lastIndexOf('/')
    return trimmed.slice(lastSlash + 1)
}

export function joinPath(parent: string, child: string): string {
    if (!parent.endsWith('/')) parent += '/'
    const cleanChild = child.startsWith('/') ? child.slice(1) : child
    return parent + cleanChild
}

export function isUnderFolder(path: string, folderPath: string): boolean {
    if (!folderPath.endsWith('/')) folderPath += '/'
    if (path === folderPath) return true
    return path.startsWith(folderPath)
}

/** 获取路径的类型：'folder' 或扩展名（如 'txt', 'pwd'） */
export function getPathType(path: string): string {
    if (isFolderPath(path)) return 'folder'
    const lastDot = path.lastIndexOf('.')
    if (lastDot === -1 || lastDot === path.length - 1) return ''
    return path.slice(lastDot + 1)
}