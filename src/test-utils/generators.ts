import * as fc from 'fast-check';
import { DocumentLine, FormatInfo, ExcelConfig, defaultExcelConfig } from '@/types';

/**
 * Markdownテキスト生成用のジェネレーター
 */
export const markdownTextGenerator = fc.oneof(
    // 見出し
    fc.tuple(
        fc.integer({ min: 1, max: 6 }),
        fc.string({ minLength: 1, maxLength: 50 })
    ).map(([level, text]) => '#'.repeat(level) + ' ' + text),

    // 段落テキスト
    fc.string({ minLength: 1, maxLength: 200 }).filter(s => !s.startsWith('#')),

    // リスト項目
    fc.tuple(
        fc.oneof(fc.constant('-'), fc.constant('*'), fc.constant('+')),
        fc.string({ minLength: 1, maxLength: 100 })
    ).map(([marker, text]) => marker + ' ' + text),

    // 番号付きリスト
    fc.tuple(
        fc.integer({ min: 1, max: 99 }),
        fc.string({ minLength: 1, maxLength: 100 })
    ).map(([num, text]) => num + '. ' + text),

    // コードブロック
    fc.tuple(
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 100 })
    ).map(([lang, code]) => '```' + lang + '\n' + code + '\n```'),

    // 引用
    fc.string({ minLength: 1, maxLength: 100 }).map(text => '> ' + text),

    // 水平線
    fc.oneof(
        fc.constant('---'),
        fc.constant('***'),
        fc.constant('___')
    ),

    // 空行
    fc.constant('')
);

/**
 * インデント付きMarkdownテキスト生成用のジェネレーター
 */
export const indentedMarkdownGenerator = fc.tuple(
    fc.integer({ min: 0, max: 5 }), // インデントレベル
    fc.oneof(fc.constant('  '), fc.constant('\t')), // インデント文字
    markdownTextGenerator
).map(([level, indentChar, text]) => indentChar.repeat(level) + text);

/**
 * ファイルパス生成用のジェネレーター
 */
export const filePathGenerator = fc.oneof(
    // 相対パス
    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
        .map(parts => parts.join('/')),

    // 絶対パス（Unix風）
    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
        .map(parts => '/' + parts.join('/')),

    // Windows風パス
    fc.tuple(
        fc.char().filter(c => c >= 'A' && c <= 'Z'),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
    ).map(([drive, parts]) => drive + ':\\' + parts.join('\\'))
);

/**
 * Markdownファイル名生成用のジェネレーター
 */
export const markdownFileNameGenerator = fc.tuple(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.oneof(fc.constant('.md'), fc.constant('.markdown'))
).map(([name, ext]) => name + ext);

/**
 * Excelファイル名生成用のジェネレーター
 */
export const excelFileNameGenerator = fc.string({ minLength: 1, maxLength: 50 })
    .map(name => name + '.xlsx');

/**
 * FormatInfo生成用のジェネレーター
 */
export const formatInfoGenerator: fc.Arbitrary<FormatInfo> = fc.record({
    isBold: fc.boolean(),
    isItalic: fc.boolean(),
    isStrikethrough: fc.boolean(),
    isCode: fc.boolean(),
    isQuote: fc.boolean(),
    isHorizontalRule: fc.boolean(),
    headerLevel: fc.integer({ min: 0, max: 6 }),
    hyperlinkUrl: fc.oneof(
        fc.constant(''),
        fc.webUrl()
    ),
    backgroundColor: fc.oneof(
        fc.constant(''),
        fc.hexaString({ minLength: 6, maxLength: 6 })
    ),
    fontSize: fc.integer({ min: 8, max: 72 })
});

/**
 * DocumentLine生成用のジェネレーター
 */
export const documentLineGenerator: fc.Arbitrary<DocumentLine> = fc.record({
    content: fc.string({ minLength: 0, maxLength: 200 }),
    indentLevel: fc.integer({ min: 0, max: 10 }),
    lineType: fc.oneof(
        fc.constant('header'),
        fc.constant('paragraph'),
        fc.constant('list_item'),
        fc.constant('code_block'),
        fc.constant('empty')
    ),
    formatting: formatInfoGenerator,
    originalLine: fc.string({ minLength: 0, maxLength: 250 })
});

/**
 * ExcelConfig生成用のジェネレーター
 */
export const excelConfigGenerator: fc.Arbitrary<ExcelConfig> = fc.record({
    cellWidth: fc.float({ min: 5.0, max: 50.0 }),
    rowHeight: fc.float({ min: 10.0, max: 100.0 }),
    indentColumnOffset: fc.integer({ min: 1, max: 5 }),
    fontName: fc.oneof(
        fc.constant('Arial'),
        fc.constant('Calibri'),
        fc.constant('Times New Roman')
    ),
    codeFontName: fc.oneof(
        fc.constant('Consolas'),
        fc.constant('Courier New'),
        fc.constant('Monaco')
    ),
    baseFontSize: fc.integer({ min: 8, max: 16 }),
    headerFontSizes: fc.constant(defaultExcelConfig.headerFontSizes),
    codeBackgroundColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
    quoteBackgroundColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
    imageBackgroundColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
    quoteBorderColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
    horizontalRuleColor: fc.hexaString({ minLength: 6, maxLength: 6 })
});

/**
 * 複数行のMarkdownドキュメント生成用のジェネレーター
 */
export const markdownDocumentGenerator = fc.array(
    indentedMarkdownGenerator,
    { minLength: 1, maxLength: 50 }
).map(lines => lines.join('\n'));
