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

    export function stringify(key: string): string {
        const fs = useFileStore();
        const json = JSON.stringify({ data: { items: fs.items, folders: fs.folders } });
        // 先 gzip 压缩再加密，以适配后端 data 字段的长度限制
        // 用 TextEncoder 转 UTF-8 字节，避免中文等非 ASCII 字符乱码
        const compressed = pako.deflate(new TextEncoder().encode(json));
        const payload = "gz:" + uint8ToBase64(compressed);
        return Crypto.encrypt(payload, Crypto.hash(key));
    }

    export function parse(encrypted: string, key: string): boolean {
        const fs = useFileStore();
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
                fs.items = parsed_data.items;
                fs.folders = parsed_data.folders;
                return true;
            }
        } catch (e) {
            console.error('Failed to parse encrypted data:', e);
        }
        return false;
    }


    export function load() {
        const setting = useSettingsStore();
        if (!setting.isLogin()) return;
        API.updateUser(
            setting.username,
            setting.masterPassword,
            Crypto.stringify(setting.masterPassword),
            setting.hint,
        )
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