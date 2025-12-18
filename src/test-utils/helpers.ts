import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DocumentLine, Document, ExcelConfig } from '@/types';

/**
 * 一時ファイルを作成するヘルパー関数
 */
export function createTempFile(content: string, extension: string = '.tmp'): string {
    const tempDir = os.tmpdir();
    const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

/**
 * 一時ファイルを削除するヘルパー関数
 */
export function deleteTempFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        // ファイル削除エラーは無視（テスト環境では問題ない）
        console.warn(`Failed to delete temp file: ${filePath}`, error);
    }
}

/**
 * ファイルが存在するかチェックするヘルパー関数
 */
export function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * ファイルの内容を読み取るヘルパー関数
 */
export function readFileContent(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
}

/**
 * DocumentLineの配列が有効かチェックするヘルパー関数
 */
export function isValidDocumentLines(lines: DocumentLine[]): boolean {
    return lines.every(line =>
        typeof line.content === 'string' &&
        typeof line.indentLevel === 'number' &&
        line.indentLevel >= 0 &&
        typeof line.lineType === 'string' &&
        line.lineType.length > 0 &&
        typeof line.formatting === 'object' &&
        typeof line.originalLine === 'string'
    );
}

/**
 * Documentオブジェクトが有効かチェックするヘルパー関数
 */
export function isValidDocument(doc: Document): boolean {
    return (
        Array.isArray(doc.lines) &&
        isValidDocumentLines(doc.lines) &&
        typeof doc.metadata === 'object' &&
        doc.metadata !== null
    );
}

/**
 * ExcelConfigが有効かチェックするヘルパー関数
 */
export function isValidExcelConfig(config: ExcelConfig): boolean {
    return (
        typeof config.cellWidth === 'number' && config.cellWidth > 0 &&
        typeof config.rowHeight === 'number' && config.rowHeight > 0 &&
        typeof config.indentColumnOffset === 'number' && config.indentColumnOffset > 0 &&
        typeof config.fontName === 'string' && config.fontName.length > 0 &&
        typeof config.codeFontName === 'string' && config.codeFontName.length > 0 &&
        typeof config.baseFontSize === 'number' && config.baseFontSize > 0 &&
        typeof config.headerFontSizes === 'object' &&
        typeof config.codeBackgroundColor === 'string' &&
        typeof config.quoteBackgroundColor === 'string' &&
        typeof config.imageBackgroundColor === 'string' &&
        typeof config.quoteBorderColor === 'string' &&
        typeof config.horizontalRuleColor === 'string'
    );
}

/**
 * インデントレベルを計算するヘルパー関数
 */
export function calculateIndentLevel(line: string, tabSize: number = 4): number {
    let indentLevel = 0;
    let i = 0;

    while (i < line.length) {
        if (line[i] === ' ') {
            indentLevel++;
        } else if (line[i] === '\t') {
            indentLevel += tabSize;
        } else {
            break;
        }
        i++;
    }

    return Math.floor(indentLevel / tabSize);
}

/**
 * Markdownの行タイプを判定するヘルパー関数
 */
export function getLineType(line: string): string {
    const trimmed = line.trim();

    if (trimmed === '') {
        return 'empty';
    }

    if (trimmed.startsWith('#')) {
        return 'header';
    }

    // 水平線の判定を先に行う（リスト項目の判定より前）
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        return 'horizontal_rule';
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+') || /^\d+\./.test(trimmed)) {
        return 'list_item';
    }

    if (trimmed.startsWith('```')) {
        return 'code_block';
    }

    if (trimmed.startsWith('>')) {
        return 'quote';
    }

    return 'paragraph';
}

/**
 * テスト用のモックDocumentLineを作成するヘルパー関数
 */
export function createMockDocumentLine(
    content: string = 'test content',
    indentLevel: number = 0,
    lineType: string = 'paragraph'
): DocumentLine {
    return {
        content,
        indentLevel,
        lineType,
        formatting: {
            isBold: false,
            isItalic: false,
            isStrikethrough: false,
            isCode: false,
            isQuote: false,
            isHorizontalRule: false,
            headerLevel: 0,
            hyperlinkUrl: '',
            backgroundColor: '',
            fontSize: 11
        },
        originalLine: content
    };
}

/**
 * テスト用のモックDocumentを作成するヘルパー関数
 */
export function createMockDocument(lines: DocumentLine[] = []): Document {
    return {
        lines: lines.length > 0 ? lines : [createMockDocumentLine()],
        metadata: {
            fileName: 'test.md',
            createdAt: new Date().toISOString()
        }
    };
}
