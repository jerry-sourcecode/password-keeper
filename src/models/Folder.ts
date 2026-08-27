import { v4 as uuidv4 } from 'uuid'
import { isFolderPath, getBaseName } from '@/utils/path'

export interface IFolder {
    id: string
    path: string
    name: string
    createdAt: number
    updatedAt: number
}

export class Folder implements IFolder {
    id: string
    path: string
    name: string
    createdAt: number
    updatedAt: number

    constructor({
        id = uuidv4(),
        path,
        name,
        createdAt = Date.now(),
        updatedAt = Date.now(),
    }: Partial<IFolder> & { path: string }) {
        if (!isFolderPath(path)) {
            throw new Error(`文件夹路径必须以 / 结尾: ${path}`)
        }
        this.id = id
        this.path = path
        this.name = (name ?? getBaseName(path)) || '/'
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }

    toPlain(): IFolder {
        return {
            id: this.id,
            path: this.path,
            name: this.name,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}