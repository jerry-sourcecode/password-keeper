import { getTxtFileSize } from '@/utils/utils'
import { Entry } from './Entry'

export const TYPE_PASSWORD = 'password'

export interface PasswordData {
    username: string
    password: string
    remark: string
    phone: string
    email: string
    url: string
}

export class PasswordEntry extends Entry {
    declare data: PasswordData

    constructor({
        id,
        path,
        title,
        username = '',
        password = '',
        remark = '',
        phone = '',
        email = '',
        url = '',
        createdAt,
        updatedAt,
    }: Partial<Omit<Entry, 'data' | 'type'>> & { path: string; title: string } & Partial<PasswordData>) {
        super({
            id,
            path,
            title,
            type: TYPE_PASSWORD,
            data: { username, password, remark, phone, email, url },
            createdAt,
            updatedAt,
        })
    }

    getSize(): number {
        return getTxtFileSize(this.data.username + this.data.password + this.data.remark + this.data.email + this.data.phone + this.data.url);
    }

    getDisplayData(): PasswordData {
        return this.data
    }

    getMaskedPassword(): string {
        const pwd = this.data.password || ''
        return pwd.length > 0 ? '*'.repeat(pwd.length) : ''
    }

    updatePasswordFields(fields: Partial<PasswordData>): this {
        this.data = { ...this.data, ...fields }
        this.updatedAt = Date.now()
        return this
    }
}

export interface PasswordData { username: string; password: string; remark: string; phone: string; email: string; url: string }
