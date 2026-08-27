import { getTxtFileSize } from '@/utils/utils'
import { Entry } from './Entry'

export const TYPE_PASSWORD = 'password'

export interface ThirdPartyLogin {
    provider: string // 登录方式，如 GitHub / Google / 微信
    account: string  // 对应的第三方账号或说明
}

export interface PasswordData {
    username: string
    password: string
    remark: string
    phone: string
    email: string
    url: string
    thirdPartyLogins: ThirdPartyLogin[]
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
        thirdPartyLogins = [],
        createdAt,
        updatedAt,
    }: Partial<Omit<Entry, 'data' | 'type'>> & { path: string; title: string } & Partial<PasswordData>) {
        super({
            id,
            path,
            title,
            type: TYPE_PASSWORD,
            data: { username, password, remark, phone, email, url, thirdPartyLogins },
            createdAt,
            updatedAt,
        })
    }

    getSize(): number {
        const thirdParty = (this.data.thirdPartyLogins || [])
            .map(l => (l.provider || '') + (l.account || ''))
            .join('');
        return getTxtFileSize(this.data.username + this.data.password + this.data.remark + this.data.email + this.data.phone + this.data.url + thirdParty);
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
