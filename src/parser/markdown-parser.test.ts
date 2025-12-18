import { parseMarkdownFile } from '@/parser/markdown-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('parseMarkdownFile', () => {
    const testFilePath = path.join(__dirname, 'test-markdown.md');

    afterEach(() => {
        // テストファイルが存在する場合は削除
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    it('存在しないファイルに対してエラーを投げる', async () => {
        const nonExistentPath = 'non-existent-file.md';
        await expect(parseMarkdownFile(nonExistentPath)).rejects.toThrow('ファイルが見つかりません');
    });

    it('基本的なMarkdownファイルを正しく解析する', async () => {
        const testContent = `# 見出し1
段落テキスト
- リスト項目1
- リスト項目2

## 見出し2
    インデントされたテキスト`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

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

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines[0].indentLevel).toBe(0);
        expect(document.lines[1].indentLevel).toBe(1);
        expect(document.lines[2].indentLevel).toBe(2);
        expect(document.lines[3].indentLevel).toBe(1); // 1タブ = 4スペース = レベル1
        expect(document.lines[4].indentLevel).toBe(2); // 2タブ = 8スペース = レベル2
    });

    it('混在インデント形式を正しく処理する', async () => {
        const testContent = `テキスト
\t スペースとタブの混在
  \tタブとスペースの混在
\t\t  複雑な混在`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines[0].indentLevel).toBe(0);
        expect(document.lines[1].indentLevel).toBe(1); // 1タブ + 1スペース = 5文字 = レベル1
        expect(document.lines[2].indentLevel).toBe(1); // 2スペース + 1タブ = 6文字 = レベル1
        expect(document.lines[3].indentLevel).toBe(2); // 2タブ + 2スペース = 10文字 = レベル2
    });

    it('各種改行コードを正しく処理する', async () => {
        // Windows形式（CRLF）のテストファイル
        const crlfContent = '行1\r\n行2\r\n行3';
        fs.writeFileSync(testFilePath, crlfContent, 'utf8');

        const crlfDocument = await parseMarkdownFile(testFilePath);
        expect(crlfDocument.lines).toHaveLength(3);
        expect(crlfDocument.lines[0].content).toBe('行1');
        expect(crlfDocument.lines[1].content).toBe('行2');
        expect(crlfDocument.lines[2].content).toBe('行3');

        // macOS形式（CR）のテストファイル
        const crContent = '行A\r行B\r行C';
        fs.writeFileSync(testFilePath, crContent, 'utf8');

        const crDocument = await parseMarkdownFile(testFilePath);
        expect(crDocument.lines).toHaveLength(3);
        expect(crDocument.lines[0].content).toBe('行A');
        expect(crDocument.lines[1].content).toBe('行B');
        expect(crDocument.lines[2].content).toBe('行C');

        // Unix形式（LF）のテストファイル
        const lfContent = '行X\n行Y\n行Z';
        fs.writeFileSync(testFilePath, lfContent, 'utf8');

        const lfDocument = await parseMarkdownFile(testFilePath);
        expect(lfDocument.lines).toHaveLength(3);
        expect(lfDocument.lines[0].content).toBe('行X');
        expect(lfDocument.lines[1].content).toBe('行Y');
        expect(lfDocument.lines[2].content).toBe('行Z');
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

        const document = await parseMarkdownFile(testFilePath);

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

    it('複雑なネストしたリスト構造を正しく処理する', async () => {
        const testContent = `1. 番号リスト一つ目
2. 番号リスト2つ目
    - インデントした段落(2に属する)
    1. さらにインデントした番号付きリスト一つ目
    2. さらにインデントした番号付きリスト二つ目
3. 番号リスト3つ目`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        // 各行の解析結果を確認
        expect(document.lines).toHaveLength(6);

        // 1. 番号リスト一つ目
        expect(document.lines[0].lineType).toBe('list_item');
        expect(document.lines[0].content).toBe('番号リスト一つ目');
        expect(document.lines[0].indentLevel).toBe(0);

        // 2. 番号リスト2つ目
        expect(document.lines[1].lineType).toBe('list_item');
        expect(document.lines[1].content).toBe('番号リスト2つ目');
        expect(document.lines[1].indentLevel).toBe(0);

        // インデントした段落（実際はリスト項目として認識される）
        expect(document.lines[2].lineType).toBe('list_item');
        expect(document.lines[2].content).toBe('インデントした段落(2に属する)');
        expect(document.lines[2].indentLevel).toBe(1);

        // さらにインデントした番号付きリスト一つ目
        expect(document.lines[3].lineType).toBe('list_item');
        expect(document.lines[3].content).toBe('さらにインデントした番号付きリスト一つ目');
        expect(document.lines[3].indentLevel).toBe(1);

        // さらにインデントした番号付きリスト二つ目
        expect(document.lines[4].lineType).toBe('list_item');
        expect(document.lines[4].content).toBe('さらにインデントした番号付きリスト二つ目');
        expect(document.lines[4].indentLevel).toBe(1);

        // 3. 番号リスト3つ目
        expect(document.lines[5].lineType).toBe('list_item');
        expect(document.lines[5].content).toBe('番号リスト3つ目');
        expect(document.lines[5].indentLevel).toBe(0);
    });

    it('取り消し線記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
~~取り消し線のテキスト~~
部分的に~~取り消し~~されたテキスト
~~複数の~~単語が~~取り消し~~される場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        // 通常のテキスト
        expect(document.lines[0].content).toBe('通常のテキスト');
        expect(document.lines[0].lineType).toBe('paragraph');

        // 取り消し線のテキスト（タスク2では記法を保持）
        expect(document.lines[1].content).toBe('~~取り消し線のテキスト~~');
        expect(document.lines[1].lineType).toBe('paragraph');

        // 部分的に取り消しされたテキスト
        expect(document.lines[2].content).toBe('部分的に~~取り消し~~されたテキスト');
        expect(document.lines[2].lineType).toBe('paragraph');

        // 複数の取り消し線
        expect(document.lines[3].content).toBe('~~複数の~~単語が~~取り消し~~される場合');
        expect(document.lines[3].lineType).toBe('paragraph');
    });

    it('太字記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
**太字のテキスト**
__太字のテキスト2__
部分的に**太字**されたテキスト
**複数の**単語が**太字**される場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(5);

        expect(document.lines[0].content).toBe('通常のテキスト');
        expect(document.lines[1].content).toBe('**太字のテキスト**');
        expect(document.lines[2].content).toBe('__太字のテキスト2__');
        expect(document.lines[3].content).toBe('部分的に**太字**されたテキスト');
        expect(document.lines[4].content).toBe('**複数の**単語が**太字**される場合');
    });

    it('斜体記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
*斜体のテキスト*
_斜体のテキスト2_
部分的に*斜体*されたテキスト
*複数の*単語が*斜体*される場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(5);

        expect(document.lines[0].content).toBe('通常のテキスト');
        expect(document.lines[1].content).toBe('*斜体のテキスト*');
        expect(document.lines[2].content).toBe('_斜体のテキスト2_');
        expect(document.lines[3].content).toBe('部分的に*斜体*されたテキスト');
        expect(document.lines[4].content).toBe('*複数の*単語が*斜体*される場合');
    });

    it('インラインコード記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
\`インラインコード\`
部分的に\`コード\`が含まれるテキスト
\`複数の\`コードが\`含まれる\`場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].content).toBe('通常のテキスト');
        expect(document.lines[1].content).toBe('`インラインコード`');
        expect(document.lines[2].content).toBe('部分的に`コード`が含まれるテキスト');
        expect(document.lines[3].content).toBe('`複数の`コードが`含まれる`場合');
    });

    it('リンク記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
[リンクテキスト](https://example.com)
部分的に[リンク](https://test.com)が含まれるテキスト
[複数の](https://a.com)リンクが[含まれる](https://b.com)場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].content).toBe('通常のテキスト');
        expect(document.lines[1].content).toBe('[リンクテキスト](https://example.com)');
        expect(document.lines[2].content).toBe('部分的に[リンク](https://test.com)が含まれるテキスト');
        expect(document.lines[3].content).toBe('[複数の](https://a.com)リンクが[含まれる](https://b.com)場合');
    });

    it('複合的なインライン記法を正しく処理する（記法保持）', async () => {
        const testContent = `**太字**と*斜体*と\`コード\`と[リンク](https://example.com)
~~取り消し線~~と**太字**の組み合わせ
***太字斜体***
**太字の中に*斜体*が含まれる**場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].content).toBe('**太字**と*斜体*と`コード`と[リンク](https://example.com)');
        expect(document.lines[1].content).toBe('~~取り消し線~~と**太字**の組み合わせ');
        expect(document.lines[2].content).toBe('***太字斜体***');
        expect(document.lines[3].content).toBe('**太字の中に*斜体*が含まれる**場合');
    });
});
