import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { Document, ExcelConfig, RichTextSegment, FontStyle, DocumentLine } from '@/types';

/**
 * 書類オブジェクトをExcelファイル（Buffer）に書き出す
 * @param document 解析済み書類オブジェクト
 * @param config Excel生成設定
 * @param outputPath 出力先パス (既存ファイルがあれば読み込む)
 * @returns 生成されたExcelファイルのBuffer
 */
export const writeExcel = async (document: Document, config: ExcelConfig, outputPath?: string): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();

    // 既存のファイルが存在する場合は、まず読み込む (シート追記のため)
    if (outputPath && fs.existsSync(outputPath)) {
        try {
            await workbook.xlsx.readFile(outputPath);
        } catch (error) {
            console.warn(`Could not read existing file, creating new one instead: ${error}`);
        }
    }

    // 新しいワークシートを追加
    // シート名は重複を避けるため「MD_[ファイル名]」とし、31文字制限に収める
    const baseFileName = path.parse(document.metadata.fileName || 'document').name;
    const timestamp = new Date().getTime().toString().slice(-4);
    const sheetName = `MD_${baseFileName}_${timestamp}`.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    // 方眼紙（グリッド）レイアウトの設定
    setupGridLayout(worksheet, config);

    // 各行を書き込み
    document.lines.forEach((line, index) => {
        writeLineToWorksheet(worksheet, line, index + 1, config);
    });

    // ドキュメント全体のリンクを収集して末尾に追加
    const allLinks = collectAllLinks(document);
    if (allLinks.length > 0) {
        const nextRow = document.lines.length + 3; // 2行空ける

        // 「## リンク」見出し (H2相当の書式)
        const headerCell = worksheet.getCell(nextRow, 1);
        headerCell.value = 'リンク';
        headerCell.font = {
            bold: true,
            size: config.headerFontSizes[2],
            name: config.fontName
        };

        // リンク一覧を箇条書きで出力 [番号] URL
        allLinks.forEach((link, idx) => {
            const rowNum = nextRow + 1 + idx;
            const indexLabel = `[${idx + 1}]`;
            const linkCell = worksheet.getCell(rowNum, 1);

            // セル自体にハイパーリンクを設定しつつ、テキストで番号を表示
            linkCell.value = {
                text: `${indexLabel} ${link}`,
                hyperlink: link
            };
            linkCell.font = {
                color: { argb: 'FF0563C1' },
                underline: true,
                name: config.fontName,
                size: config.baseFontSize
            };
        });
    }

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

    // リッチテキストに変換して設定
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
};

/**
 * ドキュメント内のすべてのユニークなリンクURLを順番通りに収集する
 * @param document ドキュメント
 * @returns URLの配列
 */
const collectAllLinks = (document: Document): string[] => {
    const allUrls = new Set<string>();
    const orderedUrls: string[] = [];

    document.lines.forEach(line => {
        line.richText.forEach(segment => {
            if (segment.link?.target && !allUrls.has(segment.link.target)) {
                allUrls.add(segment.link.target);
                orderedUrls.push(segment.link.target);
            }
        });
    });

    return orderedUrls;
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
    const targetToIndex = new Map<string, number>();
    let linkCounter = 0;

    segments.forEach(segment => {
        let text = segment.text;

        // 本文中の各リンクには [n] を付与して巻末との対応を明確にする
        if (segment.link?.target) {
            if (!targetToIndex.has(segment.link.target)) {
                linkCounter++;
                targetToIndex.set(segment.link.target, linkCounter);
            }
            // 番号のみを付加（URLそのものは書かない）
            text += ` [${targetToIndex.get(segment.link.target)}]`;
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
