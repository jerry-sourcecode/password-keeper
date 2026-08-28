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

    const data = (await res.json()) as T;

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
    data: string;
    uid: string;
    updatedAt: number;
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

    // ---------- 2. 更新用户信息 ----------
    async updateUser(
        username: string,
        password: string,
        data: string,
        passwordHint?: string,
    ) {
        await request<SuccessResult>("/api/auth/update", {
            username,
            password,
            data,
            passwordHint,
        });
    },

    // ---------- 3. 查询用户信息 ----------
    async queryUser(username: string, password: string) {
        const result = await request<QueryResult>("/api/auth/query", {
            username,
            password,
        });
        return result;
    },

    // ---------- 4. 删除用户 ----------
    async deleteUser(username: string, password: string) {
        await request<SuccessResult>("/api/auth/delete", { username, password });
    },

    async changePassword(username: string, oldPassword: string, newPassword: string, passwordHint?: string) {
        await request<SuccessResult>("/api/auth/change-password", { username, oldPassword, newPassword, passwordHint });
        console.log("密码修改成功");
    }
}