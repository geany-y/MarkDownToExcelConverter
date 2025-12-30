import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from 'marked';
import { DocumentLine, FormatInfo, Document, defaultExcelConfig, RichTextSegment, FontStyle } from '@/types';

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
        // コードブロックの開始・終了を先に追跡
        const trimmedLine = removeIndentOnly(line, detectIndentLevel(line));
        if (trimmedLine.startsWith('```')) {
            isInCodeBlock = !isInCodeBlock;
        }

        const result = parseLine(line, isInCodeBlock);

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

    // 書式情報を生成（見出し記法の解析を含む）
    const formatting: FormatInfo = analyzeFormatting(trimmedLine, lineType);

    // リッチテキストセグメントを生成
    // NOTE: generateRichTextSegments内でstripPrefixも行われる
    // コードブロック内の段落（＝コード内容）は書式解析せず、そのままテキストとして扱う
    // リッチテキストセグメントを生成
    // NOTE: generateRichTextSegments内でstripPrefixも行われる
    const richText = determineRichTextSegments(trimmedLine, lineType, formatting, isInCodeBlock);

    // リッチテキストからプレーンテキストを生成（書式なし、プレフィックスなし）
    const plainText = richText.map(segment => segment.text).join('');

    return {
        richText,
        plainText,
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
 * 書式情報を解析する
 * @param line 対象行（インデント除去済み）
 * @param lineType 行タイプ
 * @returns FormatInfo
 */
const analyzeFormatting = (line: string, lineType: string): FormatInfo => {
    const formatting = createDefaultFormatInfo();

    // 見出し記法の解析
    if (lineType === 'header') {
        const headerLevel = detectHeaderLevel(line);
        formatting.headerLevel = headerLevel;
        formatting.fontSize = getHeaderFontSize(headerLevel);
    }

    // 引用の解析
    if (lineType === 'quote') {
        formatting.isQuote = true;
        formatting.backgroundColor = defaultExcelConfig.quoteBackgroundColor;
        formatting.leftBorderColor = defaultExcelConfig.quoteBorderColor;
    }

    // 水平線の解析
    if (lineType === 'horizontal_rule') {
        formatting.isHorizontalRule = true;
        formatting.bottomBorderColor = defaultExcelConfig.horizontalRuleColor;
    }

    return formatting;
};

/**
 * リッチテキストセグメントを生成する
 * @param line 対象行（インデント除去済み）
 * @param lineType 行タイプ
 * @param formatting 行全体の書式情報
 * @returns RichTextSegment配列
 */
const generateRichTextSegments = (line: string, lineType: string, formatting: FormatInfo): RichTextSegment[] => {
    // 行タイプに応じたプレフィックス除去と置換
    let content = stripLinePrefix(line, lineType);

    // コンテンツ全体が置き換わる特別なケース
    if (lineType === 'horizontal_rule') {
        return [{ text: '水平線' }];
    }
    if (lineType === 'table') {
        return [{ text: '表：' + content }];
    }
    if (lineType === 'empty') {
        return [{ text: '' }];
    }

    // 引用の場合はプレフィックス付与
    if (lineType === 'quote') {
        content = `引用：${content}`;
    }

    // インライン書式記法を解析してリッチテキストセグメントを生成
    return parseInlineFormatting(content);
};

/**
 * 行の状態に基づいてリッチテキストセグメントを決定する
 * @param line 対象行
 * @param lineType 行タイプ
 * @param formatting 書式情報
 * @param isInCodeBlock コードブロック内かどうか
 * @returns RichTextSegment配列
 */
const determineRichTextSegments = (line: string, lineType: string, formatting: FormatInfo, isInCodeBlock: boolean): RichTextSegment[] => {
    // コードブロック内の段落（＝コード内容）は書式解析せず、そのままテキストとして扱う
    if (isInCodeBlock && lineType === 'paragraph') {
        return [{ text: stripLinePrefix(line, lineType) }];
    }

    return generateRichTextSegments(line, lineType, formatting);
};

/**
 * 行タイプに応じてMarkdownのプレフィックスを除去する
 * @param line 対象行
 * @param lineType 行タイプ
 * @returns プレフィックス除去後のテキスト
 */
const stripLinePrefix = (line: string, lineType: string): string => {
    switch (lineType) {
        case 'header':
            // 見出し記号（#）と直後の1つのスペースのみを除去
            return line.replace(/^#{1,6}\s/, '');
        case 'list_item':
            // リスト記号と直後の1つのスペースのみを除去
            return line.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
        case 'code_block':
            // コードブロック記号を除去
            return line.replace(/^```.*$/, '');
        case 'quote':
            // 引用記号を除去
            return line.replace(/^> ?/, '');
        default:
            return line;
    }
};

/**
 * インライン書式記法を解析してRichTextSegment配列を生成する
 * markedライブラリを使用して解析を行う
 * @param text 対象テキスト
 * @returns RichTextSegment配列
 */
const parseInlineFormatting = (text: string): RichTextSegment[] => {
    // markedのLexerを使用してインライン解析を実行
    const lexer = new Lexer();

    // LexerのinlineTokensメソッドを使用してインライン要素のみを解析する
    // 型定義にメソッドが含まれていない場合があるためキャストして使用
    const tokens = (lexer as any).inlineTokens(text);

    return convertTokensToSegments(tokens);
};

/**
 * markedのトークンをRichTextSegmentに変換する
 * @param tokens markedトークン配列
 * @param currentFont 現在のフォントスタイル（再帰処理用）
 * @returns RichTextSegment配列
 */
const convertTokensToSegments = (tokens: any[], currentFont: FontStyle = {}): RichTextSegment[] => {
    const segments: RichTextSegment[] = [];

    for (const token of tokens) {
        switch (token.type) {
            case 'text':
            case 'escape':
            case 'html': // 安全性のためHTMLもテキストとして扱う
                segments.push({
                    text: decodeHtmlEntities(token.text),
                    font: { ...currentFont }
                });
                break;

            case 'strong': // 太字
                segments.push(...convertTokensToSegments(token.tokens, { ...currentFont, bold: true }));
                break;

            case 'em': // 斜体
                segments.push(...convertTokensToSegments(token.tokens, { ...currentFont, italic: true }));
                break;

            case 'del': // 取り消し線
                segments.push(...convertTokensToSegments(token.tokens, { ...currentFont, strike: true }));
                break;

            case 'codespan': // インラインコード
                // コード部分は単一セグメント
                segments.push({
                    text: decodeHtmlEntities(token.text),
                    font: {
                        ...currentFont,
                        code: true,
                        // コード用フォント設定などはExcel生成側で行うが、
                        // ここでは必要に応じてフラグを持たせてもよい
                        // 現在は仕様書に「等幅フォント」とあるため、フォント名を指定
                        name: defaultExcelConfig.codeFontName
                    }
                });
                break;

            case 'link': // リンク
                // リンクテキストを再帰的に解析（リンク内の太字などをサポート）
                // リンク情報は別途管理が必要だが、RichTextSegmentには文字色等を設定
                const linkSegments = convertTokensToSegments(token.tokens, {
                    ...currentFont,
                    color: { argb: 'FF0563C1' }, // 標準的なリンク色（青）
                    underline: true
                });

                // リンクURL情報を各セグメントに付与
                linkSegments.forEach(segment => {
                    segment.link = { target: token.href };
                });

                segments.push(...linkSegments);
                break;

            case 'image': // 画像
                // 画像は「代替テキスト」として表示
                segments.push({
                    text: token.text || '画像',
                    font: {
                        ...currentFont,
                        color: { argb: 'FF808080' } // グレー
                    },
                    image: {
                        src: token.href,
                        alt: token.text
                    }
                });
                break;

            default:
                // その他のトークンはテキストとして扱う
                if (token.text) {
                    segments.push({
                        text: decodeHtmlEntities(token.text),
                        font: { ...currentFont }
                    });
                }
                break;
        }
    }

    return mergeAdjacentSegments(segments);
};

/**
 * HTMLエンティティをデコードする
 * markedはデフォルトで特殊文字をエスケープするため、元のテキストに戻す必要がある
 * @param text デコード対象のテキスト
 * @returns デコード後のテキスト
 */
const decodeHtmlEntities = (text: string): string => {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
};

/**
 * 隣接する同じスタイルのセグメントを結合する
 * @param segments 結合対象のセグメント配列
 * @returns 結合後のセグメント配列
 */
const mergeAdjacentSegments = (segments: RichTextSegment[]): RichTextSegment[] => {
    if (segments.length === 0) return [];

    const merged: RichTextSegment[] = [segments[0]];

    for (let i = 1; i < segments.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = segments[i];

        if (isSameFont(prev.font, curr.font)) {
            prev.text += curr.text;
        } else {
            merged.push(curr);
        }
    }

    return merged;
};

/**
 * フォントスタイルが同じかどうか判定する
 * @param previousFont 比較元のフォントスタイル
 * @param currentFont 比較対象のフォントスタイル
 * @returns スタイルが完全に一致する場合はtrue
 */
const isSameFont = (previousFont: FontStyle | undefined, currentFont: FontStyle | undefined): boolean => {
    // 両方undefined/nullなら同じ
    if (!previousFont && !currentFont) return true;
    if (!previousFont || !currentFont) return false;

    // プロパティ比較
    const previousKeys = Object.keys(previousFont);
    const currentKeys = Object.keys(currentFont);
    if (previousKeys.length !== currentKeys.length) return false;

    for (const key of previousKeys) {
        if (typeof previousFont[key] === 'object') {
            // ネストしたオブジェクト（colorなど）の簡易比較
            if (JSON.stringify(previousFont[key]) !== JSON.stringify(currentFont[key])) return false;
            continue;
        }

        if (previousFont[key] !== currentFont[key]) return false;
    }
    return true;
};

/**
 * 見出しレベルを検出する
 * @param line 対象行
 * @returns 見出しレベル（1-6、見出しでない場合は0）
 */
const detectHeaderLevel = (line: string): number => {
    const match = line.match(/^(#{1,6})\s/);
    return match ? match[1].length : 0;
};

/**
 * 見出しレベルに対応するフォントサイズを取得する
 * @param headerLevel 見出しレベル（1-6）
 * @returns フォントサイズ
 */
const getHeaderFontSize = (headerLevel: number): number => {
    // デフォルト設定から見出しレベル別フォントサイズを取得
    return defaultExcelConfig.headerFontSizes[headerLevel] || defaultExcelConfig.baseFontSize;
};

/**
 * デフォルトの書式情報を作成する
 * @returns デフォルトのFormatInfo
 */
const createDefaultFormatInfo = (): FormatInfo => {
    return {
        isQuote: false,
        isHorizontalRule: false,
        headerLevel: 0,
        backgroundColor: '',
        fontSize: defaultExcelConfig.baseFontSize,
        leftBorderColor: '',
        bottomBorderColor: ''
    };
};
