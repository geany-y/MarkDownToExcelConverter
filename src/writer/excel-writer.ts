import * as ExcelJS from 'exceljs';
import { Document, ExcelConfig, RichTextSegment, FontStyle, DocumentLine } from '@/types';

/**
 * 書類オブジェクトをExcelファイル（Buffer）に書き出す
 * @param document 解析済み書類オブジェクト
 * @param config Excel生成設定
 * @returns 生成されたExcelファイルのBuffer
 */
export const writeExcel = async (document: Document, config: ExcelConfig): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // 方眼紙（グリッド）レイアウトの設定
    setupGridLayout(worksheet, config);

    // 各行を書き込み
    document.lines.forEach((line, index) => {
        writeLineToWorksheet(worksheet, line, index + 1, config);
    });

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
};

/**
 * ワークシートに方眼紙レイアウト（狭い列幅）を設定する
 * @param worksheet 設定対象のワークシート
 * @param config Excel生成設定
 */
const setupGridLayout = (worksheet: ExcelJS.Worksheet, config: ExcelConfig): void => {
    // 1列目から必要な範囲まで、設定されたセル幅を適用
    const totalGridColumns = 100;

    for (let columnIndex = 1; columnIndex <= totalGridColumns; columnIndex++) {
        const column = worksheet.getColumn(columnIndex);
        column.width = config.cellWidth;
    }
};

/**
 * 1行分のデータをワークシートに書き込む
 * @param worksheet 書き込み先のワークシート
 * @param line 解析済みドキュメント行
 * @param rowNumber 書き込み先の行番号（1始まり）
 * @param config Excel生成設定
 */
const writeLineToWorksheet = (
    worksheet: ExcelJS.Worksheet,
    line: DocumentLine,
    rowNumber: number,
    config: ExcelConfig
): void => {
    // インデントレベルに基づいて開始列を計算
    const startColumnIndex = (line.indentLevel * config.indentColumnOffset) + 1;
    const cell = worksheet.getCell(rowNumber, startColumnIndex);

    // 行内のリンクを抽出
    const links = extractLinks(line.richText);

    // リッチテキストに変換して設定（リンク番号を付加）
    cell.value = {
        richText: convertToExcelRichText(line.richText)
    };

    // 背景色の適用
    if (line.formatting.backgroundColor) {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: line.formatting.backgroundColor.replace('#', '') }
        };
    }

    // 境界線の適用
    const borders: Partial<ExcelJS.Borders> = {};
    if (line.formatting.leftBorderColor) {
        borders.left = { style: 'thick', color: { argb: line.formatting.leftBorderColor.replace('#', '') } };
    }
    if (line.formatting.bottomBorderColor) {
        borders.bottom = { style: 'thin', color: { argb: line.formatting.bottomBorderColor.replace('#', '') } };
    }
    if (Object.keys(borders).length > 0) {
        cell.border = borders;
    }

    // 行の高さ設定
    const row = worksheet.getRow(rowNumber);
    row.height = config.rowHeight;

    // サイドセルへのリンク展開
    if (links.length > 0) {
        links.forEach((link, idx) => {
            const linkColumnIndex = startColumnIndex + 1 + idx; // メインセルの右隣から順番に配置
            const linkCell = worksheet.getCell(rowNumber, linkColumnIndex);
            const indexLabel = `[${idx + 1}]`;

            linkCell.value = {
                text: `${indexLabel} ${link.target}`,
                hyperlink: link.target,
                tooltip: link.target
            };

            // リンク部分の書式設定（青字・下線）
            linkCell.font = {
                color: { argb: 'FF0563C1' },
                underline: true
            };
        });
    }
};

/**
 * リッチテキストセグメントからリンク情報を抽出する
 * @param segments セグメント配列
 * @returns リンク情報の配列
 */
const extractLinks = (segments: RichTextSegment[]): Array<{ target: string }> => {
    const links: Array<{ target: string }> = [];
    const seenTargets = new Set<string>();

    segments.forEach(segment => {
        if (segment.link?.target && !seenTargets.has(segment.link.target)) {
            links.push({ target: segment.link.target });
            seenTargets.add(segment.link.target);
        }
    });

    return links;
};

/**
 * RichTextSegment配列をExcelJSのRichText形式に変換する
 * @param segments 変換元のセグメント配列
 * @returns ExcelJSのリッチテキスト配列
 */
const convertToExcelRichText = (segments: RichTextSegment[]): ExcelJS.RichText[] => {
    const result: ExcelJS.RichText[] = [];
    let linkCount = 0;
    const targetToIndex = new Map<string, number>();

    segments.forEach(segment => {
        let text = segment.text;

        // リンクがある場合は番号を付与
        if (segment.link?.target) {
            if (!targetToIndex.has(segment.link.target)) {
                linkCount++;
                targetToIndex.set(segment.link.target, linkCount);
            }
            const index = targetToIndex.get(segment.link.target);
            text += ` [${index}]`;
        }

        const richText: ExcelJS.RichText = {
            text: text
        };

        if (segment.font) {
            richText.font = convertToExcelFont(segment.font);
        }

        result.push(richText);
    });

    return result;
};

/**
 * FontStyleをExcelJSのFont形式に変換する
 * @param style 変換元のスタイル
 * @returns ExcelJSのフォント設定
 */
const convertToExcelFont = (style: FontStyle): Partial<ExcelJS.Font> => {
    const excelFont: Partial<ExcelJS.Font> = {};

    if (style.bold) {
        excelFont.bold = true;
    }

    if (style.italic) {
        excelFont.italic = true;
    }

    if (style.strike) {
        excelFont.strike = true;
    }

    if (style.underline) {
        excelFont.underline = true;
    }

    if (style.size) {
        excelFont.size = style.size;
    }

    if (style.name) {
        excelFont.name = style.name;
    }

    if (style.color) {
        excelFont.color = { argb: style.color.argb };
    }

    return excelFont;
};
