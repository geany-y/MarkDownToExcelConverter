import { writeExcel } from '@/writer/excel-writer';
import { Document, defaultExcelConfig } from '@/types';
import * as ExcelJS from 'exceljs';

describe('ExcelWriter', () => {
    it('正常にExcelファイルを生成してBufferを返す', async () => {
        // テスト用ドキュメント作成
        const document: Document = {
            lines: [
                {
                    richText: [
                        { text: '通常のテキスト', font: {} },
                        { text: '太字テキスト', font: { bold: true } }
                    ],
                    plainText: '通常のテキスト太字テキスト',
                    indentLevel: 0,
                    lineType: 'paragraph',
                    formatting: {
                        isQuote: false,
                        isHorizontalRule: false,
                        headerLevel: 0,
                        backgroundColor: '',
                        fontSize: 11,
                        leftBorderColor: '',
                        bottomBorderColor: ''
                    },
                    originalLine: '通常のテキスト**太字テキスト**'
                }
            ],
            metadata: {
                fileName: 'test.md',
                filePath: '/path/to/test.md',
                convertedAt: new Date().toISOString(),
                totalLines: 1
            }
        };

        const excelBuffer = await writeExcel(document, defaultExcelConfig);

        // Bufferが生成されていることを確認
        expect(excelBuffer).toBeDefined();
        expect(excelBuffer.length).toBeGreaterThan(0);

        // ExcelJSで読み込んで内容を確認
        const workbook = new ExcelJS.Workbook();
        // 実行環境におけるBuffer型の定義不一致を解消するため、メソッドの引数型を直接指定してキャスト
        await workbook.xlsx.load(excelBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
        // シート名を特定できないため、インデックスで取得（最初のシート）
        // 実装では addWorksheet を呼んでいるため、必ず最後に追加されたシート、あるいは唯一のシートになるはず
        const worksheet = workbook.worksheets[0];
        expect(worksheet).toBeDefined();

        // 内容確認
        const cell = worksheet?.getCell(1, 1);
        // anyを避け、必要なプロパティを持つ型としてキャスト
        const cellValue = cell?.value as { richText: ExcelJS.RichText[] };
        expect(cellValue.richText).toBeDefined();
        expect(cellValue.richText[0].text).toBe('通常のテキスト');
        expect(cellValue.richText[1].text).toBe('太字テキスト');
        expect(cellValue.richText[1].font?.bold).toBe(true);
    });
});
