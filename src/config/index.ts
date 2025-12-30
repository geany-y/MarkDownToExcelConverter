import { ExcelConfig } from '../types';

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
    horizontalRuleColor: "D0D0D0",

    // 以下、ハードコーディングされていた色定義を追加
    codeColor: "FF000080",       // DarkBlue
    inlineCodeColor: "FFA31515", // DarkRed
    linkColor: "FF0563C1",       // Blue
    imageAltColor: "FF808080",   // Gray
    sheetName: "Markdown"        // Default base sheet name
};
