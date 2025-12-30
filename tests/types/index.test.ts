import { defaultExcelConfig } from '../../src/config';
import { isValidExcelConfig } from '../../src/test-utils/helpers';

describe('Types', () => {
    describe('defaultExcelConfig', () => {
        it('デフォルト設定が有効な構造を持つこと', () => {
            expect(isValidExcelConfig(defaultExcelConfig)).toBe(true);
        });

        it('デフォルト設定が期待される値を持つこと', () => {
            expect(defaultExcelConfig.cellWidth).toBe(3.0);
            expect(defaultExcelConfig.rowHeight).toBe(20.0);
            expect(defaultExcelConfig.indentColumnOffset).toBe(1);
            expect(defaultExcelConfig.fontName).toBe('Meiryo');
            expect(defaultExcelConfig.codeFontName).toBe('Consolas');
            expect(defaultExcelConfig.baseFontSize).toBe(11);
        });

        it('見出しレベル別フォントサイズが定義されていること', () => {
            expect(defaultExcelConfig.headerFontSizes[1]).toBe(18);
            expect(defaultExcelConfig.headerFontSizes[2]).toBe(16);
            expect(defaultExcelConfig.headerFontSizes[3]).toBe(14);
            expect(defaultExcelConfig.headerFontSizes[4]).toBe(12);
            expect(defaultExcelConfig.headerFontSizes[5]).toBe(11);
            expect(defaultExcelConfig.headerFontSizes[6]).toBe(10);
        });

        it('背景色が16進数形式で定義されていること', () => {
            // 6桁または8桁の16進数（ARGB含む）を許容
            const hexPattern = /^[0-9A-F]{6}([0-9A-F]{2})?$/i;
            expect(defaultExcelConfig.codeBackgroundColor).toMatch(hexPattern);
            expect(defaultExcelConfig.quoteBackgroundColor).toMatch(hexPattern);
            expect(defaultExcelConfig.imageBackgroundColor).toMatch(hexPattern);
            expect(defaultExcelConfig.codeColor).toMatch(hexPattern);
            expect(defaultExcelConfig.inlineCodeColor).toMatch(hexPattern);
            expect(defaultExcelConfig.linkColor).toMatch(hexPattern);
            expect(defaultExcelConfig.imageAltColor).toMatch(hexPattern);
        });
    });
});
