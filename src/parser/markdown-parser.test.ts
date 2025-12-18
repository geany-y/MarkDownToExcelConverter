import { MarkdownParser } from './markdown-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('MarkdownParser', () => {
    let parser: MarkdownParser;
    let testFilePath: string;

    beforeEach(() => {
        parser = new MarkdownParser();
        testFilePath = path.join(__dirname, 'test-markdown.md');
    });

    afterEach(() => {
        // テストファイルが存在する場合は削除
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    describe('parseFile', () => {
        it('存在しないファイルに対してエラーを投げる', async () => {
            const nonExistentPath = 'non-existent-file.md';
            await expect(parser.parseFile(nonExistentPath)).rejects.toThrow('ファイルが見つかりません');
        });

        it('基本的なMarkdownファイルを正しく解析する', async () => {
            const testContent = `# 見出し1
段落テキスト
- リスト項目1
- リスト項目2

## 見出し2
    インデントされたテキスト`;

            fs.writeFileSync(testFilePath, testContent, 'utf8');

            const document = await parser.parseFile(testFilePath);

            expect(document.lines).toHaveLength(7);
            expect(document.metadata.fileName).toBe('test-markdown.md');
            expect(document.metadata.totalLines).toBe(7);

            // 見出し1の確認
            expect(document.lines[0].lineType).toBe('header');
            expect(document.lines[0].content).toBe('見出し1');
            expect(document.lines[0].indentLevel).toBe(0);

            // 段落の確認
            expect(document.lines[1].lineType).toBe('paragraph');
            expect(document.lines[1].content).toBe('段落テキスト');

            // リスト項目の確認
            expect(document.lines[2].lineType).toBe('list_item');
            expect(document.lines[2].content).toBe('リスト項目1');

            // 空行の確認
            expect(document.lines[4].lineType).toBe('empty');
            expect(document.lines[4].content).toBe('');

            // インデントされたテキストの確認
            expect(document.lines[6].indentLevel).toBe(1);
            expect(document.lines[6].content).toBe('インデントされたテキスト');
        });

        it('インデントレベルを正しく検出する', async () => {
            const testContent = `テキスト
    4スペースインデント
        8スペースインデント
\tタブインデント
\t\t2タブインデント`;

            fs.writeFileSync(testFilePath, testContent, 'utf8');

            const document = await parser.parseFile(testFilePath);

            expect(document.lines[0].indentLevel).toBe(0);
            expect(document.lines[1].indentLevel).toBe(1);
            expect(document.lines[2].indentLevel).toBe(2);
            expect(document.lines[3].indentLevel).toBe(1); // 1タブ = 4スペース = レベル1
            expect(document.lines[4].indentLevel).toBe(2); // 2タブ = 8スペース = レベル2
        });

        it('様々な行タイプを正しく識別する', async () => {
            const testContent = `# 見出し1
## 見出し2
段落テキスト
- リスト項目
1. 番号付きリスト
\`\`\`
コードブロック
> 引用
---
| 表 | ヘッダー |`;

            fs.writeFileSync(testFilePath, testContent, 'utf8');

            const document = await parser.parseFile(testFilePath);

            expect(document.lines[0].lineType).toBe('header');
            expect(document.lines[1].lineType).toBe('header');
            expect(document.lines[2].lineType).toBe('paragraph');
            expect(document.lines[3].lineType).toBe('list_item');
            expect(document.lines[4].lineType).toBe('list_item');
            expect(document.lines[5].lineType).toBe('code_block');
            expect(document.lines[6].lineType).toBe('paragraph'); // コードブロック内容
            expect(document.lines[7].lineType).toBe('quote');
            expect(document.lines[8].lineType).toBe('horizontal_rule');
            expect(document.lines[9].lineType).toBe('table');
        });
    });
});
