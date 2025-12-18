import * as fs from 'fs';
import * as path from 'path';
import { DocumentLine, FormatInfo, Document } from '@/types';

/**
 * Markdownファイルを読み込んで解析する
 * @param filePath Markdownファイルのパス
 * @returns 解析されたドキュメント
 */
export const parseMarkdownFile = async (filePath: string): Promise<Document> => {
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    // ファイル読み込み
    const content = await readFileAsync(filePath);

    // 行ごとに分割して解析（各種改行コードに対応）
    const lines = normalizeAndSplitLines(content);

    // コードブロック状態を追跡しながら解析
    let isInCodeBlock = false;
    const documentLines = lines.map((line) => {
        const result = parseLine(line, isInCodeBlock);

        // コードブロックの開始・終了を追跡
        const trimmedLine = removeIndentOnly(line, detectIndentLevel(line));
        if (trimmedLine.startsWith('```')) {
            isInCodeBlock = !isInCodeBlock;
        }

        return result;
    });

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
};

/**
 * 改行コードを正規化して行に分割する
 * Windows（CRLF）、Unix（LF）、macOS（CR）の改行コードに対応
 * @param content ファイル内容
 * @returns 行の配列
 */
const normalizeAndSplitLines = (content: string): string[] => {
    // CRLF（\r\n）を LF（\n）に正規化
    const normalizedContent = content.replace(/\r\n/g, '\n');

    // CR（\r）を LF（\n）に正規化
    const fullyNormalizedContent = normalizedContent.replace(/\r/g, '\n');

    // LF（\n）で分割
    return fullyNormalizedContent.split('\n');
};

/**
 * ファイルを非同期で読み込む
 * @param filePath ファイルパス
 * @returns ファイル内容
 */
const readFileAsync = async (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(new Error(`ファイル読み込みエラー: ${err.message}`));
                return;
            }

            resolve(data);
        });
    });
};

/**
 * 単一行を解析してDocumentLineオブジェクトに変換する
 * @param line 解析対象の行
 * @param isInCodeBlock コードブロック内かどうか
 * @returns DocumentLineオブジェクト
 */
const parseLine = (line: string, isInCodeBlock: boolean = false): DocumentLine => {
    const originalLine = line;

    // インデントレベルを検出
    const indentLevel = detectIndentLevel(line);

    // インデント部分のみを除去した内容を取得
    const trimmedLine = removeIndentOnly(line, indentLevel);

    // 行タイプを判定（コードブロック状態を考慮）
    const lineType = determineLineType(trimmedLine, isInCodeBlock);

    // 基本的な書式情報を初期化（詳細な書式解析は後のタスクで実装）
    const formatting: FormatInfo = createDefaultFormatInfo();

    // Markdown記法を除去したプレーンテキストを取得
    const content = extractPlainText(trimmedLine, lineType);

    return {
        content,
        indentLevel,
        lineType,
        formatting,
        originalLine
    };
};

/**
 * インデントレベルを検出する
 * スペースとタブの両方に対応し、混在インデント形式も処理する
 * @param line 対象行
 * @returns インデントレベル（0から開始）
 */
const detectIndentLevel = (line: string): number => {
    let indentCount = 0;
    let hasSpaces = false;
    let hasTabs = false;

    for (const char of line) {
        if (char === ' ') {
            indentCount++;
            hasSpaces = true;
            continue;
        }

        if (char === '\t') {
            // タブは4スペース相当として計算
            indentCount += 4;
            hasTabs = true;
            continue;
        }

        // インデント文字以外が見つかったら終了
        break;
    }

    // 混在インデント形式の警告（実際のアプリケーションではログ出力等を検討）
    if (hasSpaces && hasTabs) {
        // 混在している場合は統一されたルールで処理を継続
        // 現在の実装では4スペース = 1タブとして計算済み
    }

    // 4スペースまたは1タブを1インデントレベルとする
    return Math.floor(indentCount / 4);
};

/**
 * インデント部分のみを除去する
 * @param line 対象行
 * @param indentLevel インデントレベル
 * @returns インデント部分を除去した行
 */
const removeIndentOnly = (line: string, indentLevel: number): string => {
    let charCount = 0;
    let removeCount = 0;
    const targetIndentChars = indentLevel * 4; // 4スペース = 1レベル

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === ' ') {
            charCount++;
        }

        if (char === '\t') {
            charCount += 4; // タブは4スペース相当
        }

        if (char !== ' ' && char !== '\t') {
            break; // インデント文字以外が見つかったら終了
        }

        if (charCount <= targetIndentChars) {
            removeCount = i + 1;
            continue;
        }

        break;
    }

    return line.substring(removeCount);
};

/**
 * 行タイプを判定する
 * @param trimmedLine インデントを除去した行
 * @param isInCodeBlock コードブロック内かどうか
 * @returns 行タイプ
 */
const determineLineType = (trimmedLine: string, isInCodeBlock: boolean = false): string => {
    // 空行の早期リターン
    if (trimmedLine.length === 0) {
        return 'empty';
    }

    // コードブロック内の場合は、```以外はすべて段落として扱う
    if (isInCodeBlock && !trimmedLine.startsWith('```')) {
        return 'paragraph';
    }

    // 見出し（# で始まる）の早期リターン
    if (trimmedLine.match(/^#{1,6}\s/)) {
        return 'header';
    }

    // リスト項目（-, *, +, 数字. で始まる）の早期リターン
    if (trimmedLine.match(/^[-*+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        return 'list_item';
    }

    // コードブロック（```で始まる）の早期リターン
    if (trimmedLine.startsWith('```')) {
        return 'code_block';
    }

    // 引用（> で始まる）の早期リターン
    if (trimmedLine.startsWith('> ')) {
        return 'quote';
    }

    // 水平線（---, ***, ___）の早期リターン
    if (trimmedLine.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        return 'horizontal_rule';
    }

    // 表（複数の | を含み、| で始まり | で終わる）の早期リターン
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|') && (trimmedLine.match(/\|/g) || []).length >= 2) {
        return 'table';
    }

    // デフォルトは段落
    return 'paragraph';
};

/**
 * デフォルトの書式情報を作成する
 * @returns デフォルトのFormatInfo
 */
const createDefaultFormatInfo = (): FormatInfo => {
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
};

/**
 * Markdown記法を除去してプレーンテキストを抽出する
 * @param line 対象行
 * @param lineType 行タイプ
 * @returns プレーンテキスト
 */
const extractPlainText = (line: string, lineType: string): string => {
    let content = line;

    switch (lineType) {
        case 'empty':
            return '';

        case 'header':
            // 見出し記号（#）と直後の1つのスペースのみを除去
            content = content.replace(/^#{1,6}\s/, '');
            break;

        case 'list_item':
            // リスト記号と直後の1つのスペースのみを除去
            content = content.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
            break;

        case 'code_block':
            // コードブロック記号を除去
            content = content.replace(/^```.*$/, '');
            break;

        case 'quote':
            // 引用記号を除去し、「引用：」プレフィックスを追加
            const quoteContent = content.replace(/^>\s*/, '');
            return `引用：${quoteContent}`;

        case 'horizontal_rule':
            // 水平線を説明文に変換
            return '水平線';

        case 'table':
            // 表を説明文に変換
            return '表：' + content;

        default:
            // 段落はそのまま
            break;
    }

    // タスク2では基本的な記法除去のみ実行
    // インライン書式の詳細解析はタスク3で実装予定
    return content;
};
