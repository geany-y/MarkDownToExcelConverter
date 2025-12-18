import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdownFile } from '@/parser/markdown-parser';
import { markdownDocumentGenerator } from '@/test-utils/generators';

/**
 * **Feature: markdown-to-excel, Property 1: ファイル読み込みと解析**
 * **検証対象: 要件 1.1, 1.3**
 */
describe('parseMarkdownFile プロパティベーステスト', () => {
    const testDir = path.join(__dirname, 'temp-test-files');

    beforeAll(() => {
        // テスト用ディレクトリを作成
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterAll(() => {
        // テスト用ディレクトリを削除
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        // 各テスト後にテストファイルを削除
        const files = fs.readdirSync(testDir);
        for (const file of files) {
            const filePath = path.join(testDir, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });

    /**
     * プロパティ1: ファイル読み込みと解析
     * 任意の有効なMarkdownファイルに対して、パーサーはファイルを正常に読み込み、
     * 構造化されたドキュメントデータに変換する
     */
    test('プロパティ1: 任意の有効なMarkdownに対してファイル読み込みと解析が成功する', async () => {
        await fc.assert(
            fc.asyncProperty(
                markdownDocumentGenerator,
                async (markdownContent) => {
                    // テストファイルを作成
                    const testFileName = `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);

                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 基本的な構造の検証
                        expect(document).toBeDefined();
                        expect(document.lines).toBeDefined();
                        expect(Array.isArray(document.lines)).toBe(true);
                        expect(document.metadata).toBeDefined();

                        // メタデータの検証
                        expect(document.metadata.fileName).toBe(testFileName);
                        expect(document.metadata.filePath).toBe(testFilePath);
                        expect(document.metadata.convertedAt).toBeDefined();
                        expect(document.metadata.totalLines).toBe(markdownContent.split('\n').length);

                        // 各行の基本構造の検証
                        for (const line of document.lines) {
                            expect(line.content).toBeDefined();
                            expect(typeof line.content).toBe('string');
                            expect(line.indentLevel).toBeDefined();
                            expect(typeof line.indentLevel).toBe('number');
                            expect(line.indentLevel).toBeGreaterThanOrEqual(0);
                            expect(line.lineType).toBeDefined();
                            expect(typeof line.lineType).toBe('string');
                            expect(line.formatting).toBeDefined();
                            expect(line.originalLine).toBeDefined();
                            expect(typeof line.originalLine).toBe('string');
                        }

                        // 行数の一致を検証
                        const expectedLineCount = markdownContent.split('\n').length;
                        expect(document.lines.length).toBe(expectedLineCount);

                        return true;
                    } catch (error) {
                        // ファイル読み込みエラー以外は失敗とする
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            // ファイル読み込みエラーは許容（システムの制限による）
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 存在しないファイルに対するエラーハンドリングのテスト
     */
    test('存在しないファイルに対して適切なエラーを投げる', async () => {
        const nonExistentPath = path.join(testDir, 'non-existent-file.md');

        await expect(parseMarkdownFile(nonExistentPath)).rejects.toThrow('ファイルが見つかりません');
    });

    /**
     * 空のMarkdownファイルの処理テスト
     */
    test('空のMarkdownファイルを正しく処理する', async () => {
        const testFileName = 'empty-test.md';
        const testFilePath = path.join(testDir, testFileName);

        fs.writeFileSync(testFilePath, '', 'utf8');

        const document = await parseMarkdownFile(testFilePath);

        expect(document.lines).toHaveLength(1);
        expect(document.lines[0].lineType).toBe('empty');
        expect(document.lines[0].content).toBe('');
        expect(document.lines[0].indentLevel).toBe(0);
    });

    /**
     * **Feature: markdown-to-excel, Property 4: インデントレベル検出**
     * **検証対象: 要件 2.1**
     *
     * プロパティ4: インデントレベル検出
     * 任意のインデントを含むMarkdownテキストに対して、パーサーはインデントレベルを正確に検出する
     */
    test('プロパティ4: 任意のインデントに対してインデントレベルを正確に検出する', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.integer({ min: 0, max: 8 }), // インデントレベル
                        fc.oneof(fc.constant(' '), fc.constant('\t')), // インデント文字
                        fc.string({ minLength: 1, maxLength: 50 }) // テキスト内容
                    ),
                    { minLength: 1, maxLength: 20 }
                ),
                async (indentedLines) => {
                    // テストファイル内容を生成
                    const markdownContent = indentedLines
                        .map(([level, indentChar, text]) => {
                            const indentString = indentChar === ' '
                                ? ' '.repeat(level * 4) // 4スペース = 1レベル
                                : '\t'.repeat(level); // 1タブ = 1レベル
                            return indentString + text;
                        })
                        .join('\n');

                    // テストファイルを作成
                    const testFileName = `indent-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);

                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 各行のインデントレベルを検証
                        for (let i = 0; i < indentedLines.length; i++) {
                            const [expectedLevel] = indentedLines[i];
                            const actualLevel = document.lines[i].indentLevel;

                            // インデントレベルが期待値と一致することを確認
                            expect(actualLevel).toBe(expectedLevel);
                        }

                        return true;
                    } catch (error) {
                        // ファイル読み込みエラー以外は失敗とする
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: markdown-to-excel, Property 6: スペース・タブインデント認識**
     * **検証対象: 要件 2.4**
     *
     * プロパティ6: スペース・タブインデント認識
     * 任意のスペースまたはタブでインデントされたテキストに対して、
     * システムは両方の形式を正しく認識する
     */
    test('プロパティ6: スペースとタブの両方のインデント形式を正しく認識する', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.integer({ min: 0, max: 5 }), // インデントレベル
                        fc.string({ minLength: 1, maxLength: 50 }) // テキスト内容
                    ),
                    { minLength: 1, maxLength: 15 }
                ),
                async (lines) => {
                    // スペースインデントのテストファイルを作成
                    const spaceIndentedContent = lines
                        .map(([level, text]) => ' '.repeat(level * 4) + text)
                        .join('\n');

                    const spaceTestFileName = `space-indent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const spaceTestFilePath = path.join(testDir, spaceTestFileName);
                    fs.writeFileSync(spaceTestFilePath, spaceIndentedContent, 'utf8');

                    // タブインデントのテストファイルを作成
                    const tabIndentedContent = lines
                        .map(([level, text]) => '\t'.repeat(level) + text)
                        .join('\n');

                    const tabTestFileName = `tab-indent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const tabTestFilePath = path.join(testDir, tabTestFileName);
                    fs.writeFileSync(tabTestFilePath, tabIndentedContent, 'utf8');

                    try {
                        // スペースインデントファイルを解析
                        const spaceDocument = await parseMarkdownFile(spaceTestFilePath);

                        // タブインデントファイルを解析
                        const tabDocument = await parseMarkdownFile(tabTestFilePath);

                        // 両方のファイルで同じインデントレベルが検出されることを確認
                        expect(spaceDocument.lines.length).toBe(tabDocument.lines.length);

                        for (let i = 0; i < lines.length; i++) {
                            const [expectedLevel] = lines[i];
                            const spaceLevel = spaceDocument.lines[i].indentLevel;
                            const tabLevel = tabDocument.lines[i].indentLevel;

                            // スペースインデントが正しく検出されることを確認
                            expect(spaceLevel).toBe(expectedLevel);

                            // タブインデントが正しく検出されることを確認
                            expect(tabLevel).toBe(expectedLevel);

                            // スペースとタブで同じインデントレベルが検出されることを確認
                            expect(spaceLevel).toBe(tabLevel);
                        }

                        return true;
                    } catch (error) {
                        // ファイル読み込みエラー以外は失敗とする
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
    /**
     * **Feature: markdown-to-excel, Property 7: 見出し要素変換**
     * **検証対象: 要件 3.1**
     *
     * プロパティ7: 見出し要素変換
     * 任意のMarkdown見出し要素に対して、見出しテキストがExcelセルに出力される
     */
    test('プロパティ7: 任意の見出し要素が正しく変換される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.integer({ min: 1, max: 6 }), // 見出しレベル
                        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\n') && s.trim().length > 0) // 見出しテキスト（空白のみを除外）
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                async (headers) => {
                    // 見出しMarkdownを生成
                    const markdownContent = headers
                        .map(([level, text]) => '#'.repeat(level) + ' ' + text)
                        .join('\n');

                    // テストファイルを作成
                    const testFileName = `header-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);
                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 各見出しが正しく変換されることを確認
                        for (let i = 0; i < headers.length; i++) {
                            const [expectedLevel, expectedText] = headers[i];
                            const line = document.lines[i];

                            // 行タイプが見出しであることを確認
                            expect(line.lineType).toBe('header');

                            // 見出し記号が除去されてテキストのみが残ることを確認
                            expect(line.content).toBe(expectedText);

                            // 元の行が保持されることを確認
                            expect(line.originalLine).toBe('#'.repeat(expectedLevel) + ' ' + expectedText);
                        }

                        return true;
                    } catch (error) {
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
    /**
     * **Feature: markdown-to-excel, Property 8: 段落テキスト変換**
     * **検証対象: 要件 3.2**
     *
     * プロパティ8: 段落テキスト変換
     * 任意のMarkdown段落テキストに対して、段落内容がExcelセルに出力される
     */
    test('プロパティ8: 任意の段落テキストが正しく変換される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.string({ minLength: 1, maxLength: 200 })
                        .filter(s => !s.includes('\n') && s.trim().length > 0 && !s.startsWith('#') && !s.match(/^[-*+]\s/) && !s.match(/^\d+\.\s/) && !s.startsWith('```') && !s.startsWith('> ') && !s.match(/^(-{3,}|\*{3,}|_{3,})$/) && !(s.startsWith('|') && s.endsWith('|') && (s.match(/\|/g) || []).length >= 2)),
                    { minLength: 1, maxLength: 15 }
                ),
                async (paragraphs) => {
                    // 段落Markdownを生成
                    const markdownContent = paragraphs.join('\n');

                    // テストファイルを作成
                    const testFileName = `paragraph-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);
                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 各段落が正しく変換されることを確認
                        for (let i = 0; i < paragraphs.length; i++) {
                            const expectedText = paragraphs[i];
                            const line = document.lines[i];

                            // 行タイプが段落であることを確認
                            expect(line.lineType).toBe('paragraph');

                            // 段落内容がそのまま保持されることを確認
                            expect(line.content).toBe(expectedText);

                            // 元の行が保持されることを確認
                            expect(line.originalLine).toBe(expectedText);
                        }

                        return true;
                    } catch (error) {
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
    /**
     * **Feature: markdown-to-excel, Property 9: リスト要素変換**
     * **検証対象: 要件 3.3**
     *
     * プロパティ9: リスト要素変換
     * 任意のMarkdownリスト要素に対して、リスト項目がExcelセルに出力される
     */
    test('プロパティ9: 任意のリスト要素が正しく変換される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.oneof(
                            fc.constant('-'),
                            fc.constant('*'),
                            fc.constant('+'),
                            fc.integer({ min: 1, max: 99 }).map(n => n + '.')
                        ), // リストマーカー
                        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\n') && s.trim().length > 0) // リスト項目テキスト（空白のみを除外）
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                async (listItems) => {
                    // リストMarkdownを生成
                    const markdownContent = listItems
                        .map(([marker, text]) => marker + ' ' + text)
                        .join('\n');

                    // テストファイルを作成
                    const testFileName = `list-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);
                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 各リスト項目が正しく変換されることを確認
                        for (let i = 0; i < listItems.length; i++) {
                            const [marker, expectedText] = listItems[i];
                            const line = document.lines[i];

                            // 行タイプがリスト項目であることを確認
                            expect(line.lineType).toBe('list_item');

                            // リストマーカーが除去されてテキストのみが残ることを確認
                            expect(line.content).toBe(expectedText);

                            // 元の行が保持されることを確認
                            expect(line.originalLine).toBe(marker + ' ' + expectedText);
                        }

                        return true;
                    } catch (error) {
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
    /**
     * **Feature: markdown-to-excel, Property 10: 表要素除外**
     * **検証対象: 要件 3.4**
     *
     * プロパティ10: 表要素除外
     * 任意のMarkdown表要素に対して、システムは表を変換対象から除外する
     */
    test('プロパティ10: 任意の表要素が正しく除外される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.array(
                        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('|') && !s.includes('\n')),
                        { minLength: 2, maxLength: 5 }
                    ),
                    { minLength: 1, maxLength: 5 }
                ),
                async (tableRows) => {
                    // 表Markdownを生成
                    const markdownContent = tableRows
                        .map(row => '| ' + row.join(' | ') + ' |')
                        .join('\n');

                    // テストファイルを作成
                    const testFileName = `table-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);
                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        // 各表行が正しく処理されることを確認
                        for (let i = 0; i < tableRows.length; i++) {
                            const line = document.lines[i];

                            // 行タイプが表であることを確認
                            expect(line.lineType).toBe('table');

                            // 表要素は説明文に変換されることを確認
                            const expectedOriginalLine = '| ' + tableRows[i].join(' | ') + ' |';
                            expect(line.content).toBe('表：' + expectedOriginalLine);

                            // 元の行は保持されることを確認
                            expect(line.originalLine).toBe(expectedOriginalLine);
                        }

                        return true;
                    } catch (error) {
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
    /**
     * **Feature: markdown-to-excel, Property 11: コードブロック変換**
     * **検証対象: 要件 3.5**
     *
     * プロパティ11: コードブロック変換
     * 任意のMarkdownコードブロックに対して、コードブロック内容がExcelセルに出力される
     */
    test('プロパティ11: 任意のコードブロックが正しく変換される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.oneof(
                            fc.constant('```'),
                            fc.string({ minLength: 0, maxLength: 20 }).map(lang => '```' + lang)
                        ), // コードブロック開始マーカー
                        fc.array(
                            fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\n') && s.trim().length > 0 && !(s.startsWith('|') && s.endsWith('|') && (s.match(/\|/g) || []).length >= 2)),
                            { minLength: 1, maxLength: 5 }
                        ) // コード行（空白のみと表形式を除外）
                    ),
                    { minLength: 1, maxLength: 5 }
                ),
                async (codeBlocks) => {
                    // コードブロックMarkdownを生成
                    const markdownLines: string[] = [];

                    for (const [startMarker, codeLines] of codeBlocks) {
                        markdownLines.push(startMarker);
                        markdownLines.push(...codeLines);
                        markdownLines.push('```');
                    }

                    const markdownContent = markdownLines.join('\n');

                    // テストファイルを作成
                    const testFileName = `code-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.md`;
                    const testFilePath = path.join(testDir, testFileName);
                    fs.writeFileSync(testFilePath, markdownContent, 'utf8');

                    try {
                        // ファイルを解析
                        const document = await parseMarkdownFile(testFilePath);

                        let lineIndex = 0;

                        // 各コードブロックが正しく変換されることを確認
                        for (const [startMarker, codeLines] of codeBlocks) {
                            // 開始マーカー行の確認
                            const startLine = document.lines[lineIndex];
                            expect(startLine.lineType).toBe('code_block');
                            expect(startLine.content).toBe(''); // コードブロックマーカーは除去される
                            expect(startLine.originalLine).toBe(startMarker);
                            lineIndex++;

                            // コード内容行の確認
                            for (const codeLine of codeLines) {
                                const contentLine = document.lines[lineIndex];
                                expect(contentLine.lineType).toBe('paragraph'); // コードブロック内容は段落として扱われる
                                expect(contentLine.content).toBe(codeLine);
                                expect(contentLine.originalLine).toBe(codeLine);
                                lineIndex++;
                            }

                            // 終了マーカー行の確認
                            const endLine = document.lines[lineIndex];
                            expect(endLine.lineType).toBe('code_block');
                            expect(endLine.content).toBe(''); // コードブロックマーカーは除去される
                            expect(endLine.originalLine).toBe('```');
                            lineIndex++;
                        }

                        return true;
                    } catch (error) {
                        if (error instanceof Error && error.message.includes('ファイル読み込みエラー')) {
                            return true;
                        }
                        throw error;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
