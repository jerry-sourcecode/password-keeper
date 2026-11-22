const BASE_URL = "https://pwd.jerrylab.top";

/** 业务错误：附带后端返回的 code，以及密码错误时返回的 hint（主密码提示） */
export class ApiError extends Error {
    code?: string;
    hint?: string;
    status?: number;

    constructor(
        message: string,
        opts?: { code?: string; hint?: string; status?: number },
    ) {
        super(message);
        this.name = "ApiError";
        this.code = opts?.code;
        this.hint = opts?.hint;
        this.status = opts?.status;
    }
}

/** 统一的请求封装：自动设置 JSON 头、序列化/反序列化，并抛出业务错误 */
async function request<T>(
    path: string,
    body: Record<string, unknown>,
): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    // 先取原始文本再解析：后端可能返回空响应、纯文本 404 或 HTML 错误页，
    // 直接 res.json() 只会抛出难以定位的错误
    //（例如 "404 Not Found" 会被当成 JSON 数字 404 + 多余字符）。
    const raw = await res.text();
    const text = raw.trim();

    // 非 JSON 响应（纯文本 / HTML 错误页）直接按 HTTP 状态给出明确提示
    if (!isJsonLike(text)) {
        throw new ApiError(nonJsonMessage(path, res.status, text), {
            status: res.status,
        });
    }

    const data = parseJson<T>(text, path, res.status);

    // 非 2xx 视为失败，抛出带 code/message/hint 的业务错误
    if (!res.ok) {
        const err = data as { message?: string; code?: string; hint?: string };
        throw new ApiError(err.message ?? `HTTP ${res.status}`, {
            code: err.code,
            hint: err.hint,
            status: res.status,
        });
    }

    return data;
}

/** 解析响应文本；失败时带上状态码、原始片段与位置，便于定位后端返回异常 */
function parseJson<T>(raw: string, path: string, status: number): T {
    const text = raw.trim();
    if (!text) {
        throw new ApiError(`接口 ${path} 返回空响应（HTTP ${status}）`, { status });
    }

    try {
        return JSON.parse(text) as T;
    } catch (e) {
        const err = e as Error;

        // 兜底：响应形如「合法 JSON + 多余内容」时（后端重复写入 / 代理追加等），
        // 取出第一段完整 JSON 继续使用，同时明确告警，不静默吞掉异常。
        const first = firstJsonValue(text);
        if (first) {
            try {
                const recovered = JSON.parse(first) as T;
                console.warn(
                    `接口 ${path} 的响应在 JSON 之后存在多余内容（HTTP ${status}），已忽略多余部分。原始响应：`,
                    raw,
                );
                return recovered;
            } catch {
                // 第一段也解析不了，走下面的统一报错
            }
        }

        const posMatch = /position (\d+)/i.exec(err.message);
        const pos = posMatch ? Number(posMatch[1]) : -1;
        // 出错位置附近的内容，能直接看出多余的是第二段 JSON 还是 HTML
        const around =
            pos >= 0
                ? text.slice(Math.max(0, pos - 60), pos + 60)
                : text.slice(0, 160);
        console.error(
            `接口 ${path} 返回了非法 JSON（HTTP ${status}），原始响应：`,
            raw,
        );
        throw new ApiError(
            `接口 ${path} 返回非法 JSON（HTTP ${status}）：${err.message}；出错位置附近：${JSON.stringify(around)}`,
            { status },
        );
    }
}

/**
 * 提取文本中第一段完整的 JSON 对象/数组（按括号配对，正确处理字符串与转义）。
 * 找不到完整值时返回 null。
 */
function firstJsonValue(text: string): string | null {
    const start = text.search(/[[{]/);
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "{" || ch === "[") depth++;
        else if (ch === "}" || ch === "]") {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/** 响应体是否看起来是 JSON（对象 / 数组 / 字符串），用于区分纯文本与 HTML 错误页 */
function isJsonLike(text: string): boolean {
    const first = text[0];
    return first === "{" || first === "[" || first === '"';
}

/** 非 JSON 响应（空响应 / 纯文本 / HTML 错误页）的友好错误信息 */
function nonJsonMessage(path: string, status: number, text: string): string {
    if (!text) return `接口 ${path} 返回空响应（HTTP ${status}）`;
    if (status === 404) {
        return `接口 ${path} 不存在（HTTP 404）：请确认后端已部署该路由`;
    }
    const snippet = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    return `接口 ${path} 返回了非 JSON 内容（HTTP ${status}）：${snippet}`;
}

/**
 * 本程序在服务端 `user_data` 表中的来源标识。
 * 服务端按 (uid, source) 存储，不同程序的数据互不影响，写入即整体覆盖。
 */
export const SOURCE = "password-keeper";

/** 旧版 KV 迁移过来的数据统一归属的来源标识 */
export const LEGACY_SOURCE = "legacy";

// ---------- 类型定义（与后端 zod schema 对应） ----------
interface RegisterResult {
    success: boolean;
    uid: string;
}
interface SuccessResult {
    success: boolean;
}
export interface QueryResult {
    success: boolean;
    uid: string;
    username: string;
    /** 仅当请求带 source 时才有值，否则为空串 */
    data: string;
    /** 数据最后更新时间；未指定 source 时为 null */
    dataUpdatedAt: number | null;
    /** 身份信息最后更新时间 */
    updatedAt: number;
}
export interface SaveDataResult {
    success: boolean;
    source: string;
    updatedAt: number;
}
export interface LoadDataResult {
    success: boolean;
    uid: string;
    source: string;
    /** 该来源尚无数据时为 null（不报错） */
    data: string | null;
    updatedAt: number | null;
}
export interface DataItem {
    source: string;
    data: string;
    createdAt: number;
    updatedAt: number;
}
export interface ListDataResult {
    success: boolean;
    count: number;
    items: DataItem[];
}
export interface MigrateResult {
    success: boolean;
    /** 本次新插入的用户行数 */
    users: number;
    /** 本次新插入的数据行数 */
    userData: number;
    /** 本次新插入的邀请码数 */
    invites: number;
}
interface InviteResult {
    success: boolean;
    inviteCode: string;
}
interface InviteListResult {
    success: boolean;
    count: number;
    invites: string[];
}

export const API = {
    // ---------- 1. 注册 ----------
    async registerUser(
        username: string,
        password: string,
        inviteCode: string,
        passwordHint?: string,
    ) {
        const result = await request<RegisterResult>("/api/auth/register", {
            username,
            password,
            inviteCode,
            passwordHint,
        });
        return result.uid;
    },

    // ---------- 2. 更新用户信息（身份信息 + 指定来源的数据） ----------
    async updateUser(
        username: string,
        password: string,
        source: string,
        data: string,
        passwordHint?: string,
    ) {
        await request<SuccessResult>("/api/auth/update", {
            username,
            password,
            source,
            data,
            passwordHint,
        });
    },

    // ---------- 3. 查询用户信息（带 source 时附带该来源的数据） ----------
    async queryUser(username: string, password: string, source?: string) {
        const result = await request<QueryResult>("/api/auth/query", {
            username,
            password,
            ...(source ? { source } : {}),
        });
        return result;
    },

    // ---------- 4. 删除用户 ----------
    async deleteUser(username: string, password: string) {
        await request<SuccessResult>("/api/auth/delete", { username, password });
    },

    async changePassword(username: string, oldPassword: string, newPassword: string, passwordHint?: string) {
        await request<SuccessResult>("/api/auth/change-password", { username, oldPassword, newPassword, passwordHint });
    },

    // ---------- 6. 生成邀请码（管理员） ----------
    async generateInvite(adminPassword: string) {
        const result = await request<InviteResult>("/api/auth/invite", { adminPassword });
        return result.inviteCode;
    },

    // ---------- 7. 查询全部有效邀请码（管理员） ----------
    async listInvites(adminPassword: string) {
        const result = await request<InviteListResult>("/api/auth/invite/list", { adminPassword });
        return result.invites;
    },

    // ---------- 8. 删除有效邀请码（管理员） ----------
    async deleteInvite(adminPassword: string, inviteCode: string) {
        await request<SuccessResult>("/api/auth/invite/delete", { adminPassword, inviteCode });
    },

    // ---------- 9. 写入指定来源的数据（按 (uid, source) 整体覆盖） ----------
    async saveData(username: string, password: string, source: string, data: string) {
        return await request<SaveDataResult>("/api/data/save", { username, password, source, data });
    },

    // ---------- 10. 读取指定来源的数据（不存在时 data 为 null，不报错） ----------
    async loadData(username: string, password: string, source: string) {
        return await request<LoadDataResult>("/api/data/load", { username, password, source });
    },

    // ---------- 11. 列出该用户所有来源的数据 ----------
    async listData(username: string, password: string) {
        const result = await request<ListDataResult>("/api/data/list", { username, password });
        return result.items;
    },

    // ---------- 12. 旧 KV 数据迁移到 D1（管理员，幂等） ----------
    async migrateLegacyData(adminPassword: string) {
        return await request<MigrateResult>("/api/admin/migrate", { adminPassword });
    },
}