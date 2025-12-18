/**
 * ドキュメントの行を表すインターフェース
 */
export interface DocumentLine {
    /** 行の内容（Markdown記法を除去したプレーンテキスト） */
    content: string;
    /** インデントレベル（0から開始） */
    indentLevel: number;
    /** 行の種類（header, paragraph, list_item, code_block, empty） */
    lineType: string;
    /** 書式情報 */
    formatting: FormatInfo;
    /** 元の行内容（デバッグ用） */
    originalLine: string;
}

/**
 * 書式情報を表すインターフェース
 */
export interface FormatInfo {
    /** 太字 */
    isBold: boolean;
    /** 斜体 */
    isItalic: boolean;
    /** 取り消し線 */
    isStrikethrough: boolean;
    /** インラインコード */
    isCode: boolean;
    /** 引用 */
    isQuote: boolean;
    /** 水平線 */
    isHorizontalRule: boolean;
    /** 見出しレベル（0=見出しでない、1-6=見出し） */
    headerLevel: number;
    /** ハイパーリンクURL */
    hyperlinkUrl: string;
    /** 背景色（16進数） */
    backgroundColor: string;
    /** フォントサイズ */
    fontSize: number;
}

/**
 * ドキュメント全体を表すインターフェース
 */
export interface Document {
    /** ドキュメントの全行 */
    lines: DocumentLine[];
    /** メタデータ（ファイル名、変換日時など） */
    metadata: Record<string, any>;
}

/**
 * Excel設定を表すインターフェース
 */
export interface ExcelConfig {
    /** セル幅（文字数） */
    cellWidth: number;
    /** 行高さ（ポイント） */
    rowHeight: number;
    /** インデント1レベルあたりの列オフセット */
    indentColumnOffset: number;
    /** 通常フォント名 */
    fontName: string;
    /** コード用等幅フォント名 */
    codeFontName: string;
    /** 基本フォントサイズ */
    baseFontSize: number;
    /** 見出しレベル別フォントサイズ */
    headerFontSizes: Record<number, number>;
    /** コード背景色 */
    codeBackgroundColor: string;
    /** 引用背景色 */
    quoteBackgroundColor: string;
    /** 画像背景色 */
    imageBackgroundColor: string;
    /** 引用左境界線色 */
    quoteBorderColor: string;
    /** 水平線色 */
    horizontalRuleColor: string;
}

/**
 * デフォルトのExcel設定
 */
export const defaultExcelConfig: ExcelConfig = {
    cellWidth: 15.0,
    rowHeight: 20.0,
    indentColumnOffset: 1,
    fontName: "Arial",
    codeFontName: "Consolas",
    baseFontSize: 11,
    headerFontSizes: { 1: 18, 2: 16, 3: 14, 4: 12, 5: 11, 6: 10 },
    codeBackgroundColor: "F5F5F5",
    quoteBackgroundColor: "E8F4FD",
    imageBackgroundColor: "FFF2CC",
    quoteBorderColor: "4472C4",
    horizontalRuleColor: "D0D0D0"
};
