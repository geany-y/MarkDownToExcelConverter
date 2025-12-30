/**
 * フォントスタイル定義
 */
export interface FontStyle {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    underline?: boolean;
    code?: boolean;
    name?: string;
    size?: number;
    color?: { argb: string };
    [key: string]: any; // 将来的な拡張や比較ロジックの汎用性のためにインデックスシグネチャを許容（ただし明示的なプロパティ推奨）
}

/**
 * リッチテキストの一部分を表すインターフェース
 */
export interface RichTextSegment {
    /** テキスト内容 */
    text: string;
    /** この部分に適用される書式 */
    font?: FontStyle;
    /** リンク情報 */
    link?: {
        target: string;
    };
    /** 画像情報 */
    image?: {
        src: string;
        alt: string;
    };
}

/**
 * ドキュメントの行を表すインターフェース
 */
export interface DocumentLine {
    /** 行の内容（リッチテキスト形式） */
    richText: RichTextSegment[];
    /** プレーンテキスト版（検索・デバッグ用） */
    plainText: string;
    /** インデントレベル（0から開始） */
    indentLevel: number;
    /** 行の種類（header, paragraph, list_item, code_block, empty） */
    lineType: string;
    /** 行全体の書式情報 */
    formatting: FormatInfo;
    /** 元の行内容（デバッグ用） */
    originalLine: string;
}

/**
 * 行全体の書式情報を表すインターフェース
 */
export interface FormatInfo {
    /** 引用行かどうか */
    isQuote: boolean;
    /** 水平線かどうか */
    isHorizontalRule: boolean;
    /** 見出しレベル（0=見出しでない、1-6=見出し） */
    headerLevel: number;
    /** 背景色（16進数） */
    backgroundColor: string;
    /** 基本フォントサイズ */
    fontSize: number;
    /** 左境界線の色（引用用） */
    leftBorderColor: string;
    /** 下境界線の色（水平線用） */
    bottomBorderColor: string;
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
    cellWidth: 3.0,
    rowHeight: 20.0,
    indentColumnOffset: 1,
    fontName: "Meiryo",
    codeFontName: "Consolas",
    baseFontSize: 11,
    headerFontSizes: { 1: 18, 2: 16, 3: 14, 4: 12, 5: 11, 6: 10 },
    codeBackgroundColor: "F5F5F5",
    quoteBackgroundColor: "E8F4FD",
    imageBackgroundColor: "FFF2CC",
    quoteBorderColor: "4472C4",
    horizontalRuleColor: "D0D0D0"
};
