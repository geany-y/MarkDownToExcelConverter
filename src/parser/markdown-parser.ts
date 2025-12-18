import * as fs from 'fs';
import * as path from 'path';
import { DocumentLine, FormatInfo, Document } from '../types';

/**
 * Markdownパーサークラス
 * Markdownファイルを読み込み、構造化されたドキュメントデータに変換する
 */
export class MarkdownParser {
    /**
     * Markdownファイルを読み込んで解析する
     * @param filePath Markdownファイルのパス
     * @returns 解析されたドキュメント
     */
    public async parseFile(filePath: string): Promise<Document> {
        // ファイルの存在確認
        if (!fs.existsSync(filePath)) {
            throw new Error(`ファイルが見つかりません: ${filePath}`);
        }

        // ファイル読み込み
        const content = await this.readFile(filePath);

        // 行ごとに分割して解析
        const lines = content.split('\n');
        const documentLines = lines.map((line, index) => this.parseLine(line, index));

        // ドキュメントオブジェクトを作成
        const document: Document = {
            lines: documentLines,
            metadata: {
                fileName: path.basename(filePath),
                filePath: filePath,
                convertedAt: new Date().toISOString(),
                totalLines: lines.length
            }
        };

        return document;
    }

    /**
     * ファイルを非同期で読み込む
     * @param filePath ファイルパス
     * @returns ファイル内容
     */
    private async readFile(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(new Error(`ファイル読み込みエラー: ${err.message}`));
                } else {
                    resolve(data);
                }
            });
        });
    }

    /**
     * 単一行を解析してDocumentLineオブジェクトに変換する
     * @param line 解析対象の行
     * @param lineNumber 行番号（0から開始）
     * @returns DocumentLineオブジェクト
     */
    private parseLine(line: string, lineNumber: number): DocumentLine {
        const originalLine = line;

        // インデントレベルを検出
        const indentLevel = this.detectIndentLevel(line);

        // インデントを除去した内容を取得
        const trimmedLine = line.trimStart();

        // 行タイプを判定
        const lineType = this.determineLineType(trimmedLine);

        // 基本的な書式情報を初期化（詳細な書式解析は後のタスクで実装）
        const formatting: FormatInfo = this.createDefaultFormatInfo();

        // Markdown記法を除去したプレーンテキストを取得
        const content = this.extractPlainText(trimmedLine, lineType);

        return {
            content,
            indentLevel,
            lineType,
            formatting,
            originalLine
        };
    }

    /**
     * インデントレベルを検出する
     * @param line 対象行
     * @returns インデントレベル（0から開始）
     */
    private detectIndentLevel(line: string): number {
        let indentCount = 0;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === ' ') {
                indentCount++;
            } else if (char === '\t') {
                // タブは4スペース相当として計算
                indentCount += 4;
            } else {
                break;
            }
        }

        // 4スペースまたは1タブを1インデントレベルとする
        return Math.floor(indentCount / 4);
    }

    /**
     * 行タイプを判定する
     * @param trimmedLine インデントを除去した行
     * @returns 行タイプ
     */
    private determineLineType(trimmedLine: string): string {
        // 空行
        if (trimmedLine.length === 0) {
            return 'empty';
        }

        // 見出し（# で始まる）
        if (trimmedLine.match(/^#{1,6}\s/)) {
            return 'header';
        }

        // リスト項目（-, *, +, 数字. で始まる）
        if (trimmedLine.match(/^[-*+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
            return 'list_item';
        }

        // コードブロック（```で始まる）
        if (trimmedLine.startsWith('```')) {
            return 'code_block';
        }

        // 引用（> で始まる）
        if (trimmedLine.startsWith('> ')) {
            return 'quote';
        }

        // 水平線（---, ***, ___）
        if (trimmedLine.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
            return 'horizontal_rule';
        }

        // 表（| を含む）
        if (trimmedLine.includes('|') && trimmedLine.trim().startsWith('|')) {
            return 'table';
        }

        // デフォルトは段落
        return 'paragraph';
    }

    /**
     * デフォルトの書式情報を作成する
     * @returns デフォルトのFormatInfo
     */
    private createDefaultFormatInfo(): FormatInfo {
        return {
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
        };
    }

    /**
     * Markdown記法を除去してプレーンテキストを抽出する
     * @param line 対象行
     * @param lineType 行タイプ
     * @returns プレーンテキスト
     */
    private extractPlainText(line: string, lineType: string): string {
        let content = line;

        switch (lineType) {
            case 'empty':
                return '';

            case 'header':
                // 見出し記号（#）を除去
                content = content.replace(/^#{1,6}\s*/, '');
                break;

            case 'list_item':
                // リスト記号を除去
                content = content.replace(/^[-*+]\s*/, '').replace(/^\d+\.\s*/, '');
                break;

            case 'code_block':
                // コードブロック記号を除去
                content = content.replace(/^```.*$/, '');
                break;

            case 'quote':
                // 引用記号を除去
                content = content.replace(/^>\s*/, '');
                break;

            case 'horizontal_rule':
                // 水平線は空文字にする
                return '';

            case 'table':
                // 表は除外対象なので空文字にする
                return '';

            default:
                // 段落はそのまま
                break;
        }

        return content.trim();
    }
}
