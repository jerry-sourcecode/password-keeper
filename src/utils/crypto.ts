import { useFileStore } from "@/stores/fileStore";
import crypto from "crypto-js";
import * as pako from "pako";
import { API, type QueryResult } from "@/utils/api";
import { useSettingsStore } from "@/stores/settingsStore";

/** Uint8Array → base64（分块避免栈溢出） */
function uint8ToBase64(u8: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode(...u8.subarray(i, i + chunk));
    }
    return btoa(binary);
}

/** base64 → Uint8Array */
function base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export namespace Crypto {
    export function encrypt(text: string, secret: string): string {
        return crypto.AES.encrypt(text, secret).toString();
    }

    export function decrypt(ciphertext: string, secret: string): string {
        const bytes = crypto.AES.decrypt(ciphertext, secret);
        return bytes.toString(crypto.enc.Utf8);
    }

    export function hash(text: string, salt: string = ""): string {
        return crypto.SHA512(text + salt).toString();
    }

    /**
     * 转化为加密信息
     * @param key 密钥
     * @returns 加密信息
     */
    export function stringify(key: string): string {
        const fs = useFileStore();
        const json = JSON.stringify({ data: { items: fs.items, folders: fs.folders } });
        // 先 gzip 压缩再加密，以适配后端 data 字段的长度限制
        // 用 TextEncoder 转 UTF-8 字节，避免中文等非 ASCII 字符乱码
        const compressed = pako.deflate(new TextEncoder().encode(json));
        const payload = "gz:" + uint8ToBase64(compressed);
        return Crypto.encrypt(payload, Crypto.hash(key));
    }

    /**
     * 解密数据并应用
     * @param encrypted 加密后数据
     * @param key 密钥
     * @returns 是否成功
     */
    export function parse(encrypted: string, key: string): boolean {
        const fs = useFileStore();
        const setting = useSettingsStore();
        try {
            const decrypted = Crypto.decrypt(encrypted, Crypto.hash(key));
            // 兼容：旧数据无 "gz:" 前缀，直接解析；新数据先解压
            let plain = decrypted;
            if (decrypted.startsWith("gz:")) {
                const u8 = base64ToUint8(decrypted.slice(3));
                const decompressed = pako.inflate(u8);
                plain = new TextDecoder().decode(decompressed);
            }
            const parsed_data = JSON.parse(plain).data;
            if (parsed_data.items && parsed_data.folders) {
                const remoteMax = Math.max(
                    0,
                    ...parsed_data.items.map((i: any) => i.updatedAt || 0),
                    ...parsed_data.folders.map((f: any) => f.updatedAt || 0),
                );
                const localMax = Math.max(
                    0,
                    ...fs.items.map(i => i.updatedAt || 0),
                    ...fs.folders.map(f => f.updatedAt || 0),
                );
                // 账号隔离：若本地缓存属于其他账号，直接用远端并更新归属
                if (fs.owner !== setting.username) {
                    fs.items = parsed_data.items;
                    fs.folders = parsed_data.folders;
                    fs.owner = setting.username;
                }
                // 时间戳合并：仅当远端比本地新时才覆盖，
                // 避免本地尚未成功同步到远端的修改被刷新/拉取覆盖而丢失
                else if (remoteMax > localMax) {
                    fs.items = parsed_data.items;
                    fs.folders = parsed_data.folders;
                }
                return true;
            }
        } catch (e) {
            console.error('Failed to parse encrypted data:', e);
        }
        return false;
    }

    /**
     * 强制恢复：用于从 .umc 备份导入。
     * 与 parse 不同，restore 无条件用备份数据覆盖当前 store，
     * 供用户显式导入备份使用。解密失败返回 false（本地数据不受影响）。
     */
    export function restore(encrypted: string, key: string): boolean {
        const fs = useFileStore();
        try {
            const decrypted = Crypto.decrypt(encrypted, Crypto.hash(key));
            let plain = decrypted;
            if (decrypted.startsWith("gz:")) {
                const u8 = base64ToUint8(decrypted.slice(3));
                const decompressed = pako.inflate(u8);
                plain = new TextDecoder().decode(decompressed);
            }
            const parsed_data = JSON.parse(plain).data;
            if (parsed_data.items && parsed_data.folders) {
                fs.items = parsed_data.items;
                fs.folders = parsed_data.folders;
                fs.owner = useSettingsStore().username;
                return true;
            }
        } catch (e) {
            console.error('Failed to restore encrypted data:', e);
        }
        return false;
    }


    /**
     * 将数据推送到远端
     */
    export function push() {
        const setting = useSettingsStore();
        if (!setting.isLogin()) return;
        API.updateUser(
            setting.username,
            setting.masterPassword,
            Crypto.stringify(setting.masterPassword),
            setting.hint,
        ).catch((e) => {
            // 同步失败不致命：本地已有持久化兜底，下次刷新仍可恢复
            console.error('同步到后端失败（本地数据已保留）:', e);
        })
    }

    /** 从远端拉取并解析用户数据到 store；成功返回查询结果（含 uid），未登录返回 null，出错时抛出 */
    export async function pull(): Promise<QueryResult | null> {
        const setting = useSettingsStore();
        if (!setting.username || !setting.masterPassword) return null;
        const res = await API.queryUser(setting.username, setting.masterPassword);
        Crypto.parse(res.data, setting.masterPassword);
        return res;
    }
}