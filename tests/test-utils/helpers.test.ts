import * as fc from 'fast-check';
import {
    createTempFile,
    deleteTempFile,
    fileExists,
    readFileContent,
    isValidDocumentLines,
    isValidDocument,
    isValidExcelConfig,
    calculateIndentLevel,
    getLineType,
    createMockDocumentLine,
    createMockDocument
} from '../../src/test-utils/helpers';
import { LineType } from '../../src/types';
import { defaultExcelConfig } from '../../src/config';

describe('Test Helpers', () => {
    describe('ファイル操作ヘルパー', () => {
        it('一時ファイルの作成と削除ができること', () => {
            const content = 'テストコンテンツ';
            const filePath = createTempFile(content, '.md');

            expect(fileExists(filePath)).toBe(true);
            expect(readFileContent(filePath)).toBe(content);

            deleteTempFile(filePath);
            expect(fileExists(filePath)).toBe(false);
        });
    });

    describe('バリデーションヘルパー', () => {
        it('有効なExcelConfigを正しく検証すること', () => {
            expect(isValidExcelConfig(defaultExcelConfig)).toBe(true);
        });

        it('無効なExcelConfigを正しく検証すること', () => {
            const invalidConfig = { ...defaultExcelConfig, cellWidth: -1 };
            expect(isValidExcelConfig(invalidConfig)).toBe(false);
        });

        it('有効なDocumentLineを正しく検証すること', () => {
            const validLine = createMockDocumentLine();
            expect(isValidDocumentLines([validLine])).toBe(true);
        });

        it('有効なDocumentを正しく検証すること', () => {
            const validDoc = createMockDocument();
            expect(isValidDocument(validDoc)).toBe(true);
        });
    });

    describe('インデント計算', () => {
        it('スペースインデントを正しく計算すること', () => {
            expect(calculateIndentLevel('    テキスト')).toBe(1);
            expect(calculateIndentLevel('        テキスト')).toBe(2);
            expect(calculateIndentLevel('テキスト')).toBe(0);
        });

        it('タブインデントを正しく計算すること', () => {
            expect(calculateIndentLevel('\tテキスト')).toBe(1);
            expect(calculateIndentLevel('\t\tテキスト')).toBe(2);
        });

        it('混在インデントを正しく計算すること', () => {
            expect(calculateIndentLevel('  \tテキスト')).toBe(1); // 2スペース + 1タブ = 6文字 = 1レベル
        });
    });

    describe('行タイプ判定', () => {
        it('見出しを正しく判定すること', () => {
            expect(getLineType('# 見出し1')).toBe(LineType.Header);
            expect(getLineType('## 見出し2')).toBe(LineType.Header);
            expect(getLineType('### 見出し3')).toBe(LineType.Header);
        });

        it('リスト項目を正しく判定すること', () => {
            expect(getLineType('- リスト項目')).toBe(LineType.ListItem);
            expect(getLineType('* リスト項目')).toBe(LineType.ListItem);
            expect(getLineType('+ リスト項目')).toBe(LineType.ListItem);
            expect(getLineType('1. 番号付きリスト')).toBe(LineType.ListItem);
        });

        it('コードブロックを正しく判定すること', () => {
            expect(getLineType('```')).toBe(LineType.CodeBlock);
            expect(getLineType('```javascript')).toBe(LineType.CodeBlock);
        });

        it('引用を正しく判定すること', () => {
            expect(getLineType('> 引用テキスト')).toBe(LineType.Quote);
        });

        it('水平線を正しく判定すること', () => {
            expect(getLineType('---')).toBe(LineType.HorizontalRule);
            expect(getLineType('***')).toBe(LineType.HorizontalRule);
            expect(getLineType('___')).toBe(LineType.HorizontalRule);
        });

        it('空行を正しく判定すること', () => {
            expect(getLineType('')).toBe(LineType.Empty);
            expect(getLineType('   ')).toBe(LineType.Empty);
        });

        it('段落を正しく判定すること', () => {
            expect(getLineType('通常のテキスト')).toBe(LineType.Paragraph);
        });
    });

    describe('プロパティベーステスト', () => {
        it('任意のインデントレベルが非負の値であること', () => {
            fc.assert(fc.property(
                fc.string(),
                (line) => {
                    const indentLevel = calculateIndentLevel(line);
                    return indentLevel >= 0;
                }
            ), { numRuns: 100 });
        });

        it('任意の行タイプが有効な値であること', () => {
            fc.assert(fc.property(
                fc.string(),
                (line) => {
                    const lineType = getLineType(line);
                    const validTypes = Object.values(LineType);
                    return validTypes.includes(lineType);
                }
            ), { numRuns: 100 });
        });
    });
});
