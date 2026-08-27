import { getTxtFileSize } from '@/utils/utils';
import { Entry } from './Entry'

export const TYPE_TEXT = 'text'

export interface TextData {
    content: string
}

export class TextEntry extends Entry {
    declare data: TextData

    constructor({
        id,
        path,
        title,
        content = '',
        createdAt,
        updatedAt,
    }: Partial<Omit<Entry, 'data' | 'type'>> & { path: string; title: string } & Partial<TextData>) {
        super({
            id,
            path,
            title,
            type: TYPE_TEXT,
            data: { content },
            createdAt,
            updatedAt,
        })
    }

    getSize(): number {
        return getTxtFileSize(this.data.content);
    }

    getContent(): string {
        return this.data.content
    }

    updateContent(content: string): this {
        this.data.content = content
        this.updatedAt = Date.now()
        return this
    }
}

export interface TextData { content: string }
