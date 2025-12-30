import * as fs from 'fs';
import * as path from 'path';
import { Lexer, Token } from 'marked';
import { DocumentLine, FormatInfo, Document, RichTextSegment, FontStyle, LineType, MarkedTokenType } from '../types';
import { defaultExcelConfig } from '../config';

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

    // コードブロック状態とリスト連番を追跡しながら解析
    let isInCodeBlock = false;
    let listCounter: Record<number, number> = {}; // インデントレベルごとの連番を管理

    const documentLines = lines.map((line) => {
        // コードブロックの開始・終了を先に追跡
        const { level: indentLevel, content: indentStrippedLine } = splitIndent(line);
        const trimmedLine = line.trimStart();

        if (trimmedLine.startsWith('```')) {
            isInCodeBlock = !isInCodeBlock;
        }

        const result = parseLine(line, indentLevel, indentStrippedLine, isInCodeBlock, listCounter);

        // 現在の行がリスト項目でない場合、そのレベル以下のカウンタをリセット
        if (result.lineType !== LineType.ListItem) {
            listCounter = {};
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
 * @param listCounter リスト連番管理オブジェクト
 * @returns DocumentLineオブジェクト
 */
const parseLine = (line: string, indentLevel: number, indentStrippedLine: string, isInCodeBlock: boolean = false, listCounter: Record<number, number> = {}): DocumentLine => {
    const originalLine = line;

    // 行タイプ判定用に完全にトリムした行を取得
    const trimmedLine = line.trimStart();

    // 行タイプを判定（コードブロック状態を考慮）
    const lineType = determineLineType(trimmedLine, isInCodeBlock);

    // 書式情報を生成（見出し記法の解析を含む）
    const formatting: FormatInfo = analyzeFormatting(trimmedLine, lineType);

    // リストの連番処理
    let listNumber = 0;
    if (lineType === LineType.ListItem) {
        const isOrdered = trimmedLine.match(/^\d+\.\s/);
        if (isOrdered) {
            listCounter[indentLevel] = (listCounter[indentLevel] || 0) + 1;
            listNumber = listCounter[indentLevel];
        }
    }

    // リッチテキストセグメントを生成
    // 段落とコードブロックの内容（コードブロックヘッダ以外）の場合は、
    // インデント以外の先行スペースを保持する
    const contentForRichText = (lineType === LineType.Paragraph || (isInCodeBlock && lineType !== LineType.CodeBlock))
        ? indentStrippedLine
        : trimmedLine;

    const richText = determineRichTextSegments(contentForRichText, lineType, formatting, isInCodeBlock, listNumber);

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
 * インデントレベルを検出し、インデント部分を除外した残りの文字列を返す
 * @param line 対象行
 * @returns レベルとコンテンツのオブジェクト
 */
const splitIndent = (line: string): { level: number, content: string } => {
    let indentCount = 0;

    // 全体のインデント量を計算（レベル決定用）
    for (const char of line) {
        if (char === ' ') {
            indentCount++;
            continue;
        }
        if (char === '\t') {
            indentCount += 4;
            continue;
        }
        break;
    }

    // 4スペースまたは1タブを1インデントレベルとする
    const level = Math.floor(indentCount / 4);
    const targetStripWidth = level * 4;

    // targetStripWidthが0の場合はカットしない
    if (targetStripWidth === 0) {
        return {
            level,
            content: line
        };
    }

    // インデントレベルに相当する幅だけプレフィックスを除去
    let currentWidth = 0;
    let cutIndex = 0;

    for (let i = 0; i < line.length; i++) {
        // 現在の文字幅を加算する前に、既に目標幅に達しているかチェック
        if (currentWidth >= targetStripWidth) {
            cutIndex = i;
            break;
        }

        const char = line[i];

        if (char === ' ') {
            currentWidth++;
            continue;
        }

        if (char === '\t') {
            currentWidth += 4;
            continue;
        }

        // インデント以外の文字が出現した場合はそこで終了
        cutIndex = i;
        break;
    }

    return {
        level,
        content: line.substring(cutIndex)
    };
};





/**
 * 行タイプを判定する
 * @param trimmedLine インデントを除去した行
 * @param isInCodeBlock コードブロック内かどうか
 * @returns 行タイプ
 */
const determineLineType = (trimmedLine: string, isInCodeBlock: boolean = false): LineType => {
    // 空行の早期リターン
    if (trimmedLine.length === 0) {
        return LineType.Empty;
    }

    // コードブロック内の場合は、```以外はすべて段落として扱う
    if (isInCodeBlock && !trimmedLine.startsWith('```')) {
        return LineType.Paragraph;
    }

    // 見出し（# で始まる）の早期リターン
    if (trimmedLine.match(/^#{1,6}\s/)) {
        return LineType.Header;
    }

    // リスト項目（-, *, +, 数字. で始まる）の早期リターン
    if (trimmedLine.match(/^[-*+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        return LineType.ListItem;
    }

    // コードブロック（```で始まる）の早期リターン
    if (trimmedLine.startsWith('```')) {
        return LineType.CodeBlock;
    }

    // 引用（> で始まる）の早期リターン
    if (trimmedLine.startsWith('> ')) {
        return LineType.Quote;
    }

    // 水平線（---, ***, ___）の早期リターン
    if (trimmedLine.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        return LineType.HorizontalRule;
    }

    // 表（複数の | を含み、| で始まり | で終わる）の早期リターン
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|') && (trimmedLine.match(/\|/g) || []).length >= 2) {
        return LineType.Table;
    }

    // デフォルトは段落
    return LineType.Paragraph;
};

/**
 * 書式情報を解析する
 * @param line 対象行（インデント除去済み）
 * @param lineType 行タイプ
 * @returns FormatInfo
 */
const analyzeFormatting = (line: string, lineType: LineType): FormatInfo => {
    const formatting = createDefaultFormatInfo();

    // 見出し記法の解析
    if (lineType === LineType.Header) {
        const headerLevel = detectHeaderLevel(line);
        formatting.headerLevel = headerLevel;
        formatting.fontSize = getHeaderFontSize(headerLevel);
    }

    // コードブロックの背景色
    if (lineType === LineType.CodeBlock || (lineType === LineType.Paragraph && formatting.isQuote === false && line.startsWith(' '))) {
        // 注: isInCodeBlockでの判定はdetermineLineTypeで行われるため
        // ここでは明示的なcode_blockタイプに対して色を設定
    }

    // 引用の解析
    if (lineType === LineType.Quote) {
        formatting.isQuote = true;
        formatting.backgroundColor = defaultExcelConfig.quoteBackgroundColor;
        formatting.leftBorderColor = defaultExcelConfig.quoteBorderColor;
    }

    // 水平線の解析
    if (lineType === LineType.HorizontalRule) {
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
 * @param isInCodeBlock コードブロック内かどうか
 * @returns RichTextSegment配列
 */
const generateRichTextSegments = (line: string, lineType: LineType, formatting: FormatInfo, isInCodeBlock: boolean = false): RichTextSegment[] => {
    // 行タイプに応じたプレフィックス除去
    // NOTE: list_item の記号(・ or 1.)は既に付与済みなので、ここでは stripLinePrefix で消さないようにする
    const content = (lineType !== LineType.ListItem)
        ? stripLinePrefix(line, lineType)
        : line;

    // すでに determineRichTextSegments で付加されたリスト記号を二重に処理しないよう注意
    // (stripLinePrefix は Markdown 元来の記号を消すもの)

    // コンテンツ全体が置き換わる特別なケース
    if (lineType === LineType.HorizontalRule) {
        return [{ text: '------------------------------' }];
    }
    if (lineType === LineType.Table) {
        return [{ text: '表：' + content }];
    }
    if (lineType === LineType.Empty) {
        return [{ text: '' }];
    }

    // 引用の場合はプレフィックス付与
    const finalContent = (lineType === LineType.Quote)
        ? `引用：${content}`
        : content;

    // インライン書式記法を解析してリッチテキストセグメントを生成
    const segments = parseInlineFormatting(finalContent);

    // 行レベルの書式（フォントサイズ、見出しの太字、コードブロックの文字色）を全セグメントに適用
    return segments.map(segment => {
        const font = { ...segment.font };
        if (formatting.fontSize) {
            font.size = formatting.fontSize;
        }
        if (formatting.headerLevel > 0) {
            font.bold = true;
        }
        // コードブロック内の文字をダークブルーに変更
        if (lineType === LineType.CodeBlock || (isInCodeBlock && lineType === LineType.Paragraph)) {
            font.color = { argb: defaultExcelConfig.codeColor };
            font.name = defaultExcelConfig.codeFontName;
        }
        return { ...segment, font };
    });
};

/**
 * 行の状態に基づいてリッチテキストセグメントを決定する
 * @param line 対象行
 * @param lineType 行タイプ
 * @param formatting 書式情報
 * @param isInCodeBlock コードブロック内かどうか
 * @param listNumber リスト連番
 * @returns RichTextSegment配列
 */
const determineRichTextSegments = (line: string, lineType: LineType, formatting: FormatInfo, isInCodeBlock: boolean, listNumber: number = 0): RichTextSegment[] => {
    // 箇条書きや番号付きリストの記号を明示的に付与
    const getProcessedLine = (): string => {
        if (lineType === LineType.ListItem && line.match(/^[-*+]\s/)) {
            // 元の記号を消して「・ 」を付ける
            return '・ ' + line.replace(/^[-*+]\s/, '');
        }

        if (lineType === LineType.ListItem && listNumber > 0) {
            // 元の数字を消して連番「n. 」を付ける
            return `${listNumber}. ` + line.replace(/^\d+\.\s/, '');
        }

        return line;
    };

    const processedLine = getProcessedLine();

    // コードブロック内の段落（＝コード内容）は書式解析せず、そのままテキストとして扱う
    if (isInCodeBlock && lineType === LineType.Paragraph) {
        const content = stripLinePrefix(processedLine, lineType);
        return [{
            text: content,
            font: {
                color: { argb: defaultExcelConfig.codeColor },
                name: defaultExcelConfig.codeFontName
            }
        }];
    }

    return generateRichTextSegments(processedLine, lineType, formatting, isInCodeBlock);
};

/**
 * 行タイプに応じてMarkdownのプレフィックスを除去する
 * @param line 対象行
 * @param lineType 行タイプ
 * @returns プレフィックス除去後のテキスト
 */
const stripLinePrefix = (line: string, lineType: LineType): string => {
    switch (lineType) {
        case LineType.Header:
            // 見出し記号（#）と直後の1つのスペースのみを除去
            return line.replace(/^#{1,6}\s/, '');
        case LineType.ListItem:
            // リスト記号と直後の1つのスペースのみを除去
            return line.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
        case LineType.CodeBlock:
            // コードブロック記号を除去
            return line.replace(/^```.*$/, '');
        case LineType.Quote:
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
    // markedの型定義が不完全な場合があるため、Token[]としてキャスト
    const tokens = (lexer as Lexer & { inlineTokens: (text: string) => Token[] }).inlineTokens(text);

    return convertTokensToSegments(tokens);
}

/**
 * トークンがtextプロパティを持っているか判定する型ガード
 * @param token 判定対象トークン
 */
const hasText = (token: Token): token is Token & { text: string } => {
    return 'text' in token && typeof (token as { text: unknown }).text === 'string';
};

/**
 * markedのトークンをRichTextSegmentに変換する
 * @param tokens markedトークン配列
 * @param currentFont 現在のフォントスタイル（再帰処理用）
 * @returns RichTextSegment配列
 */
const convertTokensToSegments = (tokens: Token[], currentFont: FontStyle = {}): RichTextSegment[] => {
    const segments: RichTextSegment[] = [];

    for (const token of tokens) {
        switch (token.type) {
            case MarkedTokenType.Text:
            case MarkedTokenType.Escape:
            case MarkedTokenType.Html: // 安全性のためHTMLもテキストとして扱う
                segments.push({
                    text: decodeHtmlEntities(token.text),
                    font: { ...currentFont }
                });
                break;

            case MarkedTokenType.Strong: // 太字
                segments.push(...convertTokensToSegments(token.tokens || [], { ...currentFont, bold: true }));
                break;

            case MarkedTokenType.Em: // 斜体
                segments.push(...convertTokensToSegments(token.tokens || [], { ...currentFont, italic: true }));
                break;

            case MarkedTokenType.Del: // 取り消し線
                segments.push(...convertTokensToSegments(token.tokens || [], { ...currentFont, strike: true }));
                break;

            case MarkedTokenType.CodeSpan: // インラインコード
                // コード部分は単一セグメント
                segments.push({
                    text: decodeHtmlEntities(token.text),
                    font: {
                        ...currentFont,
                        code: true,
                        color: { argb: defaultExcelConfig.inlineCodeColor },
                        name: defaultExcelConfig.codeFontName
                    }
                });
                break;

            case MarkedTokenType.Link: // リンク
                // リンクテキストを再帰的に解析（リンク内の太字などをサポート）
                // リンク情報は別途管理が必要だが、RichTextSegmentには文字色等を設定
                const linkSegments = convertTokensToSegments(token.tokens || [], {
                    ...currentFont,
                    color: { argb: defaultExcelConfig.linkColor },
                    underline: true
                });

                // リンクURL情報を各セグメントに付与
                linkSegments.forEach(segment => {
                    segment.link = { target: token.href };
                });

                segments.push(...linkSegments);
                break;

            case MarkedTokenType.Image: // 画像
                // image トークン
                segments.push({
                    text: token.text || '画像',
                    font: {
                        ...currentFont,
                        color: { argb: defaultExcelConfig.imageAltColor }
                    },
                    image: {
                        src: token.href,
                        alt: token.text
                    }
                });
                break;

            default:
                // その他のトークンはテキストとして扱う（textプロパティがあれば）
                if (hasText(token)) {
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

        if (!isSameFont(prev.font, curr.font)) {
            merged.push(curr);
            continue;
        }

        prev.text += curr.text;
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
