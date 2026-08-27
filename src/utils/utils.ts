import { v4 as uuidv4 } from 'uuid'

export function uuid() {
    return uuidv4()
}

/**
 * 计算字符串内容保存为 .txt 文件后的文件大小，并转换为指定单位的字符串
 * @param content - 要写入文件的字符串
 * @param unit - 目标单位：'B' | 'KB' | 'MB'
 * @returns 格式化后的文件大小字符串，如 "2KB" 或 "1.23MB"
 */
export function getTxtFileSize(content: string): number {
    // 1. 获取字节数（UTF-8 编码）
    return new Blob([content]).size;
}