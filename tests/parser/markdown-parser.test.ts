import { parseMarkdownFile } from '@/parser/markdown-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('parseMarkdownFile', () => {
    const testFilePath = path.join(__dirname, 'test-markdown.md');

    afterEach(() => {
        // テストファイルが存在する場合は削除
        if (fs.existsSync(testFilePath)) {
            try { fs.unlinkSync(testFilePath); } catch (e) { }
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
        expect(document.lines[0].plainText).toBe('見出し1');
        expect(document.lines[0].indentLevel).toBe(0);

        // 段落の確認
        expect(document.lines[1].lineType).toBe('paragraph');
        expect(document.lines[1].plainText).toBe('段落テキスト');

        // リスト項目の確認
        expect(document.lines[2].lineType).toBe('list_item');
        expect(document.lines[2].plainText).toBe('リスト項目1');

        // 空行の確認
        expect(document.lines[4].lineType).toBe('empty');
        expect(document.lines[4].plainText).toBe('');

        // インデントされたテキストの確認
        expect(document.lines[6].indentLevel).toBe(1);
        expect(document.lines[6].plainText).toBe('インデントされたテキスト');
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
        expect(crlfDocument.lines[0].plainText).toBe('行1');
        expect(crlfDocument.lines[1].plainText).toBe('行2');
        expect(crlfDocument.lines[2].plainText).toBe('行3');

        // macOS形式（CR）のテストファイル
        const crContent = '行A\r行B\r行C';
        fs.writeFileSync(testFilePath, crContent, 'utf8');

        const crDocument = await parseMarkdownFile(testFilePath);
        expect(crDocument.lines).toHaveLength(3);
        expect(crDocument.lines[0].plainText).toBe('行A');
        expect(crDocument.lines[1].plainText).toBe('行B');
        expect(crDocument.lines[2].plainText).toBe('行C');

        // Unix形式（LF）のテストファイル
        const lfContent = '行X\n行Y\n行Z';
        fs.writeFileSync(testFilePath, lfContent, 'utf8');

        const lfDocument = await parseMarkdownFile(testFilePath);
        expect(lfDocument.lines).toHaveLength(3);
        expect(lfDocument.lines[0].plainText).toBe('行X');
        expect(lfDocument.lines[1].plainText).toBe('行Y');
        expect(lfDocument.lines[2].plainText).toBe('行Z');
    });

    it('様々な行タイプを正しく識別する', async () => {
        const testContent = `# 見出し1
## 見出し2
段落テキスト
- リスト項目
1. 番号付きリスト
\`\`\`
コードブロック
\`\`\`
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
        expect(document.lines[7].lineType).toBe('code_block'); // コードブロック終了
        expect(document.lines[8].lineType).toBe('quote');
        expect(document.lines[9].lineType).toBe('horizontal_rule');
        expect(document.lines[10].lineType).toBe('table');
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
        expect(document.lines[0].plainText).toBe('番号リスト一つ目');
        expect(document.lines[0].indentLevel).toBe(0);

        // 2. 番号リスト2つ目
        expect(document.lines[1].lineType).toBe('list_item');
        expect(document.lines[1].plainText).toBe('番号リスト2つ目');
        expect(document.lines[1].indentLevel).toBe(0);

        // インデントした段落（実際はリスト項目として認識される）
        expect(document.lines[2].lineType).toBe('list_item');
        expect(document.lines[2].plainText).toBe('インデントした段落(2に属する)');
        expect(document.lines[2].indentLevel).toBe(1);

        // さらにインデントした番号付きリスト一つ目
        expect(document.lines[3].lineType).toBe('list_item');
        expect(document.lines[3].plainText).toBe('さらにインデントした番号付きリスト一つ目');
        expect(document.lines[3].indentLevel).toBe(1);

        // さらにインデントした番号付きリスト二つ目
        expect(document.lines[4].lineType).toBe('list_item');
        expect(document.lines[4].plainText).toBe('さらにインデントした番号付きリスト二つ目');
        expect(document.lines[4].indentLevel).toBe(1);

        // 3. 番号リスト3つ目
        expect(document.lines[5].lineType).toBe('list_item');
        expect(document.lines[5].plainText).toBe('番号リスト3つ目');
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
        expect(document.lines[0].plainText).toBe('通常のテキスト');
        expect(document.lines[0].lineType).toBe('paragraph');

        // 取り消し線のテキスト（現在は記法を除去してプレーンテキストとして処理）
        expect(document.lines[1].plainText).toBe('取り消し線のテキスト');
        expect(document.lines[1].lineType).toBe('paragraph');

        // 部分的に取り消しされたテキスト
        expect(document.lines[2].plainText).toBe('部分的に取り消しされたテキスト');
        expect(document.lines[2].lineType).toBe('paragraph');

        // 複数の取り消し線
        expect(document.lines[3].plainText).toBe('複数の単語が取り消しされる場合');
        expect(document.lines[3].lineType).toBe('paragraph');
    });

    it('太字記法を正しく処理する（記法除去と書式設定）', async () => {
        const testContent = `通常のテキスト
**太字のテキスト**
__太字のテキスト2__
部分的に**太字**されたテキスト
**複数の**単語が**太字**される場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(5);

        expect(document.lines[0].plainText).toBe('通常のテキスト');
        expect(document.lines[1].plainText).toBe('太字のテキスト');
        expect(document.lines[2].plainText).toBe('太字のテキスト2');
        expect(document.lines[3].plainText).toBe('部分的に太字されたテキスト');
        expect(document.lines[4].plainText).toBe('複数の単語が太字される場合');
    });

    it('斜体記法を正しく処理する（記法除去と書式設定）', async () => {
        const testContent = `通常のテキスト
*斜体のテキスト*
_斜体のテキスト2_
部分的に*斜体*されたテキスト
*複数の*単語が*斜体*される場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(5);

        expect(document.lines[0].plainText).toBe('通常のテキスト');
        expect(document.lines[1].plainText).toBe('斜体のテキスト');
        expect(document.lines[2].plainText).toBe('斜体のテキスト2');
        expect(document.lines[3].plainText).toBe('部分的に斜体されたテキスト');
        expect(document.lines[4].plainText).toBe('複数の単語が斜体される場合');
    });

    it('インラインコード記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
\`インラインコード\`
部分的に\`コード\`が含まれるテキスト
\`複数の\`コードが\`含まれる\`場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].plainText).toBe('通常のテキスト');
        expect(document.lines[1].plainText).toBe('インラインコード');
        expect(document.lines[1].richText[0].font?.code).toBe(true); // コードフラグ確認

        expect(document.lines[2].plainText).toBe('部分的にコードが含まれるテキスト');
        expect(document.lines[3].plainText).toBe('複数のコードが含まれる場合');
    });

    it('リンク記法を正しく処理する（記法保持）', async () => {
        const testContent = `通常のテキスト
[リンクテキスト](https://example.com)
部分的に[リンク](https://test.com)が含まれるテキスト
[複数の](https://a.com)リンクが[含まれる](https://b.com)場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].plainText).toBe('通常のテキスト');
        expect(document.lines[1].plainText).toBe('リンクテキスト');
        expect(document.lines[1].richText[0].link?.target).toBe('https://example.com'); // リンク先URL確認

        expect(document.lines[2].plainText).toBe('部分的にリンクが含まれるテキスト');
        expect(document.lines[2].richText[1].link?.target).toBe('https://test.com'); // 埋め込みリンク確認
        expect(document.lines[3].plainText).toBe('複数のリンクが含まれる場合');
    });

    it('括弧を含むURLを正しく処理する', async () => {
        const testContent = `[balanced](http://example.com/foo(bar))
[escaped](http://example.com/foo\\))
[break](http://example.com/foo)bar)`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(3);

        // バランスの取れた括弧はURLの一部として認識される
        expect(document.lines[0].richText[0].link?.target).toBe('http://example.com/foo(bar)');

        // エスケープされた閉じ括弧はURLの一部として認識される
        expect(document.lines[1].richText[0].link?.target).toBe('http://example.com/foo)');

        // バランスしていない閉じ括弧はリンクの終了として扱われる
        expect(document.lines[2].richText[0].link?.target).toBe('http://example.com/foo');
        expect(document.lines[2].richText[1].text).toBe('bar)');
    });

    it('画像記法を正しく処理する', async () => {
        const testContent = `![代替テキスト](https://example.com/image.png)
画像の後にテキスト`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(2);

        // 画像の確認
        expect(document.lines[0].plainText).toBe('代替テキスト'); // 画像は代替テキストとして表示
        expect(document.lines[0].richText[0].image).toBeDefined();
        expect(document.lines[0].richText[0].image?.src).toBe('https://example.com/image.png');
        expect(document.lines[0].richText[0].image?.alt).toBe('代替テキスト');
    });

    it('複合的なインライン記法を正しく処理する（記法除去と書式設定）', async () => {
        const testContent = `**太字**と*斜体*と\`コード\`と[リンク](https://example.com)
~~取り消し線~~と**太字**の組み合わせ
***太字斜体***
**太字の中に*斜体*が含まれる**場合`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        expect(document.lines[0].plainText).toBe('太字と斜体とコードとリンク');
        expect(document.lines[1].plainText).toBe('取り消し線と太字の組み合わせ');
        expect(document.lines[2].plainText).toBe('太字斜体');
        expect(document.lines[3].plainText).toBe('太字の中に斜体が含まれる場合');
    });

    it('エスケープされたインライン記法を正しく処理する（書式適用されない）', async () => {
        const testContent = `\\*\\*エスケープされた太字\\*\\*
\\*イタリックではない\\*
\\~\\~取り消し線ではない\\~\\~`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(3);

        // 太字ではないことの確認
        expect(document.lines[0].plainText).toBe('**エスケープされた太字**');
        expect(document.lines[0].richText[0].font?.bold).toBeUndefined(); // 太字ではない

        // イタリックではないことの確認
        expect(document.lines[1].plainText).toBe('*イタリックではない*');
        expect(document.lines[1].richText[0].font?.italic).toBeUndefined(); // イタリックではない

        // 取り消し線ではないことの確認
        expect(document.lines[2].plainText).toBe('~~取り消し線ではない~~');
        expect(document.lines[2].richText[0].font?.strike).toBeUndefined(); // 取り消し線ではない
    });

    it('アンダースコアによる斜体の制限（Intra-word emphasis）を正しく処理する（更新済み）', async () => {
        const testContent = `foo_bar_baz
記号を含む_text_case
通常の _斜体_ ケース`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(3);

        // foo_bar_baz は斜体にならない（Intra-word restriction）
        expect(document.lines[0].plainText).toBe('foo_bar_baz');
        expect(document.lines[0].richText[0].font?.italic).toBeUndefined();

        // 記号を含む_text_case は斜体にならない（Intra-word restriction）
        expect(document.lines[1].plainText).toBe('記号を含む_text_case');

        // 通常の _斜体_ ケース は斜体になる（スペースで区切られているため有効）
        expect(document.lines[2].plainText).toBe('通常の 斜体 ケース');
        const italicSegment = document.lines[2].richText.find(s => s.font?.italic === true);
        expect(italicSegment).toBeDefined();
        expect(italicSegment?.text).toBe('斜体');
    });

    it('複合的な書式（リンクを含む）および未閉塞タグ（エッジケース）を正しく処理する', async () => {
        const testContent = `*test@example.com*
**[Google](https://google.com)**
*Unclosed Italic
**Unclosed Bold`;

        fs.writeFileSync(testFilePath, testContent, 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(4);

        // 1. 斜体の中の自動リンク (*test@example.com*)
        // Property 17除外パターンの検証
        const line1 = document.lines[0];
        // 期待値: テキストはメールアドレス、斜体ON、リンク情報あり
        // NOTE: セグメント分割される可能性があるため、リンク部分を探す
        const emailSegment = line1.richText.find(s => s.link?.target === 'mailto:test@example.com');
        expect(emailSegment).toBeDefined();
        expect(emailSegment?.text).toBe('test@example.com');
        expect(emailSegment?.font?.italic).toBe(true);

        // 2. 太字の中のMarkdownリンク (**[Google](https://google.com)**)
        const line2 = document.lines[1];
        const linkSegment = line2.richText.find(s => s.link?.target === 'https://google.com');
        expect(linkSegment).toBeDefined();
        expect(linkSegment?.text).toBe('Google');
        expect(linkSegment?.font?.bold).toBe(true);
        expect(linkSegment?.font?.underline).toBe(true); // リンクは下線付き

        // 3. 閉じていないアスタリスク (*Unclosed Italic)
        const line3 = document.lines[2];
        expect(line3.plainText).toBe('*Unclosed Italic');
        // 全体のテキストとしてパースされるはず（ただし実装によってはセグメント分割されるかもだが、italicフラグはないはず）
        const italicSegment = line3.richText.find(s => s.font?.italic === true);
        expect(italicSegment).toBeUndefined();

        // 4. 閉じていない太字 (**Unclosed Bold)
        const line4 = document.lines[3];
        expect(line4.plainText).toBe('**Unclosed Bold');
        const boldSegment = line4.richText.find(s => s.font?.bold === true);
        expect(boldSegment).toBeUndefined();
    });
});
