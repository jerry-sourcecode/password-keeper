import { Entry, type IEntry } from './Entry'
import { PasswordEntry, TYPE_PASSWORD } from './PasswordEntry'
import { TextEntry, TYPE_TEXT } from './TextEntry'

export type EntryType = typeof TYPE_PASSWORD | typeof TYPE_TEXT

export type EntryConstructorParams = {
    id?: string
    path: string
    title: string
    type: EntryType
    data?: Record<string, any>
    createdAt?: number
    updatedAt?: number
}

export class EntryFactory {
    static create(type: EntryType, params: Omit<EntryConstructorParams, 'type'>): Entry {
        switch (type) {
            case TYPE_PASSWORD:
                return new PasswordEntry({
                    id: params.id,
                    path: params.path,
                    title: params.title,
                    username: params.data?.username,
                    password: params.data?.password,
                    remark: params.data?.remark,
                    phone: params.data?.phone,
                    email: params.data?.email,
                    url: params.data?.url,
                    thirdPartyLogins: params.data?.thirdPartyLogins,
                    createdAt: params.createdAt,
                    updatedAt: params.updatedAt,
                })
            case TYPE_TEXT:
                return new TextEntry({
                    id: params.id,
                    path: params.path,
                    title: params.title,
                    content: params.data?.content,
                    createdAt: params.createdAt,
                    updatedAt: params.updatedAt,
                })
            default:
                throw new Error(`未知条目类型: ${type}`)
        }
    }

    static fromPlain(plain: IEntry): Entry {
        const { type, ...rest } = plain
        return EntryFactory.create(type as EntryType, rest)
    }
}