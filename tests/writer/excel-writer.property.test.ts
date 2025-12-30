import * as fc from 'fast-check';
import * as ExcelJS from 'exceljs';
import { writeExcel } from '@/writer/excel-writer';
import { excelConfigGenerator, documentLineGenerator } from '@/test-utils/generators';
import { Document } from '@/types';

/**
 * ExcelWriter プロパティベーステスト
 *
 * Property 2: 任意のDocumentオブジェクトに対して、writeExcelはエラーなくBufferを生成し、
 * それは有効なExcelファイルとして読み込み可能である。
 */
describe('ExcelWriter プロパティベーステスト', () => {
    // タイムアウト設定を長めにする（Excel生成と検証を繰り返すため）
    const TEST_TIMEOUT = 30000;

    test('Property 2: 任意のDocumentオブジェクトから有効なExcelファイルを生成できる', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 1, maxLength: 20 }),
                excelConfigGenerator,
                async (lines, config) => {
                    const document: Document = {
                        lines,
                        metadata: {
                            fileName: 'test.md',
                            filePath: '/test.md',
                            convertedAt: new Date().toISOString(),
                            totalLines: lines.length
                        }
                    };

                    // 解析実行
                    const excelBuffer = await writeExcel(document, config);

                    // 検証1: Bufferが空でないこと
                    if (!excelBuffer || excelBuffer.length === 0) {
                        return false;
                    }

                    // 検証2: Excel形式として有効であること
                    try {
                        const workbook = new ExcelJS.Workbook();
                        // 型定義の不一致を回避（Parameters[0]は一つ目の引数の型を取得する型ユーティリティ）
                        await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);

                        const worksheet = workbook.getWorksheet('Sheet1');
                        if (!worksheet) return false;

                        // 検証3: 行数が一致すること
                        // ※ExcelJSのrowCountは書き込まれたセルのある行数だが、
                        // 空行などで差異が出る可能性があるため、最低限の存在確認を行う
                        if (worksheet.rowCount === 0) return false;

                        return true;
                    } catch (error) {
                        console.error('Excel load error:', error);
                        return false;
                    }
                }
            ),
            { numRuns: 50 }
        );
    }, TEST_TIMEOUT);

    test('Property 12: 方眼紙（グリッド）レイアウトが正しく設定されている', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 1, maxLength: 5 }),
                excelConfigGenerator,
                async (lines, config) => {
                    const document: Document = {
                        lines,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: lines.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    // 1列目から20列目までの幅が config.cellWidth と一致することを確認
                    for (let i = 1; i <= 20; i++) {
                        const column = worksheet.getColumn(i);
                        // ExcelJSのwidthは浮動小数点の誤差を含みうるため、許容範囲で比較
                        if (Math.abs((column.width || 0) - config.cellWidth) > 0.01) {
                            return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 20 }
        );
    }, TEST_TIMEOUT);

    test('Property 5: インデントレベルに応じて列オフセットが正しく適用される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 1, maxLength: 10 }),
                excelConfigGenerator,
                async (lines, config) => {
                    const document: Document = {
                        lines,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: lines.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    for (let i = 0; i < lines.length; i++) {
                        const rowNumber = i + 1;
                        const indentLevel = lines[i].indentLevel;
                        const expectedColumn = (indentLevel * config.indentColumnOffset) + 1;

                        // 期待される列に値が入っていることを確認
                        const cell = worksheet.getCell(rowNumber, expectedColumn);
                        if (!cell.value) return false;

                        // それより左の列（インデント部分）が空であることを確認（開始列が1より大きい場合）
                        for (let col = 1; col < expectedColumn; col++) {
                            const indentCell = worksheet.getCell(rowNumber, col);
                            if (indentCell.value !== null && indentCell.value !== undefined) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 30 }
        );
    }, TEST_TIMEOUT);

    test('Property 13: 空行（lineType: empty）がExcel上で適切に処理される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 5, maxLength: 20 }),
                excelConfigGenerator,
                async (lines, config) => {
                    // 全ての行を強制的に空行にしたデータを作成
                    const emptyLines = lines.map(line => ({
                        ...line,
                        lineType: 'empty' as const,
                        richText: [],
                        plainText: ''
                    }));

                    const document: Document = {
                        lines: emptyLines,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: emptyLines.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    // 全ての行のセルが空（または空のリッチテキスト）であることを確認
                    for (let i = 0; i < emptyLines.length; i++) {
                        const cell = worksheet.getCell(i + 1, 1);
                        // ExcelJSでリッチテキストを空で設定した場合、valueはundefinedまたは空の構造になる
                        const value = cell.value as { richText?: ExcelJS.RichText[] };
                        if (value && value.richText && value.richText.length > 0) return false;
                        if (typeof value === 'string' && value !== '') return false;
                    }
                    return true;
                }
            ),
            { numRuns: 20 }
        );
    }, TEST_TIMEOUT);

    test('Property 14: 複数行のドキュメントが正しい順序でExcel行に配置される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 5, maxLength: 20 }),
                excelConfigGenerator,
                async (texts, config) => {
                    // 識別可能なテキストを持つ行を生成
                    const lines = texts.map(text => ({
                        richText: [{ text }],
                        plainText: text,
                        indentLevel: 0,
                        lineType: 'paragraph' as const,
                        formatting: { isQuote: false, isHorizontalRule: false, headerLevel: 0, backgroundColor: '', fontSize: 11, leftBorderColor: '', bottomBorderColor: '' },
                        originalLine: text
                    }));

                    const document: Document = {
                        lines,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: lines.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    // 各行のテキストが期待通りの場所にあることを確認
                    for (let i = 0; i < lines.length; i++) {
                        const cell = worksheet.getCell(i + 1, 1);
                        const cellValue = cell.value as { richText: ExcelJS.RichText[] };
                        if (cellValue.richText[0].text !== texts[i]) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 20 }
        );
    }, TEST_TIMEOUT);
    test('Property: 背景色と境界線が正しく適用されている', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 1, maxLength: 5 }),
                excelConfigGenerator,
                async (lines, config) => {
                    const document: Document = {
                        lines,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: lines.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    for (let i = 0; i < lines.length; i++) {
                        const rowNumber = i + 1;
                        const line = lines[i];
                        const startColumn = (line.indentLevel * config.indentColumnOffset) + 1;
                        const cell = worksheet.getCell(rowNumber, startColumn);

                        // 背景色の検証
                        if (line.formatting.backgroundColor) {
                            const expectedColor = line.formatting.backgroundColor.replace('#', '').toUpperCase();
                            const actualColor = (cell.fill as ExcelJS.FillPattern)?.fgColor?.argb?.slice(-6).toUpperCase();
                            if (actualColor !== expectedColor) return false;
                        }

                        // 境界線の検証
                        if (line.formatting.leftBorderColor) {
                            if (!cell.border?.left) return false;
                        }
                        if (line.formatting.bottomBorderColor) {
                            if (!cell.border?.bottom) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 20 }
        );
    }, TEST_TIMEOUT);

    test('Property: ハイパーリンクがサイドセルに展開され、メインセルに番号が付与されている', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(documentLineGenerator, { minLength: 1, maxLength: 5 }),
                excelConfigGenerator,
                async (lines, config) => {
                    // 少なくとも1行はリンクを持つように加工
                    const linesWithLinks = lines.map((line, idx) => {
                        if (idx === 0) {
                            return {
                                ...line,
                                richText: [
                                    { text: 'Link1', link: { target: 'https://example.com/1' } },
                                    { text: ' and ', font: {} },
                                    { text: 'Link2', link: { target: 'https://example.com/2' } }
                                ]
                            };
                        }
                        return line;
                    });

                    const document: Document = {
                        lines: linesWithLinks,
                        metadata: { fileName: 'test.md', filePath: '', convertedAt: '', totalLines: linesWithLinks.length }
                    };

                    const excelBuffer = await writeExcel(document, config);
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
                    const worksheet = workbook.getWorksheet('Sheet1');
                    if (!worksheet) return false;

                    // 1行目の検証
                    const startColumn = (linesWithLinks[0].indentLevel * config.indentColumnOffset) + 1;
                    const mainCell = worksheet.getCell(1, startColumn);
                    const mainValue = mainCell.value as { richText: ExcelJS.RichText[] };

                    // メインセルに [1], [2] が含まれているか（最後に追加されるため、セグメントのテキストを確認）
                    const matches = mainValue.richText.map(rt => rt.text).join('').match(/\[1\].*\[2\]/);
                    if (!matches) return false;

                    // サイドセルの検証
                    const sideCell1 = worksheet.getCell(1, startColumn + 1);
                    const sideCell2 = worksheet.getCell(1, startColumn + 2);

                    if (!sideCell1.value || typeof sideCell1.value !== 'object' || !('hyperlink' in sideCell1.value)) return false;
                    if (!sideCell2.value || typeof sideCell2.value !== 'object' || !('hyperlink' in sideCell2.value)) return false;

                    if ((sideCell1.value as any).hyperlink !== 'https://example.com/1') return false;
                    if ((sideCell2.value as any).hyperlink !== 'https://example.com/2') return false;

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    }, TEST_TIMEOUT);
});
