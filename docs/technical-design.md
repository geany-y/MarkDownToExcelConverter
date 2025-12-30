# 技術設計書 (Technical Design)

## 1. アーキテクチャ
```
[Markdownファイル] → [Markdown Parser] → [構造化データ] → [Excel Generator] → [Excelファイル]
```

### 主要プロセスの責任
- **Main Process (Electron)**: アプリのライフサイクル、IPCハンドラー、ダイアログ管理、WSL環境対策（GPU無効化）。
- **Renderer Process (UI)**: ファイル選択UI、ユーザーインタラクション。
- **Parser Module**: 行単位の解析、インデント検出、Markdown要素の分類、リスト連番の自動振り直し。
- **Generator Module**: ExcelJSを使用したExcelワークブック生成、方眼紙レイアウト、書式適用、既存ファイルへのシート追加、巻末リンク一覧の自動生成。

## 2. データモデル

### DocumentLine
解析された各行のデータ構造。
- `richText`: `RichTextSegment[]` (書式情報付きテキスト)
- `plainText`: プレーンテキスト
- `indentLevel`: 0からのインデント階層
- `lineType`: 要素の分類 (`header`, `paragraph` 等)
- `formatting`: 行単位の書式情報 (`FormatInfo`)

### ExcelConfig
生成時のレイアウト設定（デフォルト値）。
- 列幅: 3.0 (方眼紙形式)
- 行高さ: 20.0
- インデントオフセット: 1列
- 基本フォント: Meiryo (メイリオ)
- コード用フォント: MS Gothic (ＭＳ ゴシック) / Consolas
- 見出しサイズ: H1=20, H2=18, H3=16, H4=14... (すべて太字)
- インラインコード: 文字色変更 (#A31515)
- コードブロック: 文字色変更 (DarkBlue)
- リスト項目: 箇条書きは「・ 」、番号付きは「1. 2. 3. 」の自動連番
- 巻末セクション: 出現したURLを一覧化する「リンク」セクションの自動追加

## 3. 正確性プロパティ (一部抜粋)
- **Property 1 (解析)**: 任意の有効なMarkdownを構造化データに変換可能であること。
- **Property 4 (インデント)**: インデントレベルを正確に検出すること。
- **Property 12 (レイアウト)**: 生成されたExcelが統一された方眼紙形式であること。
- **Property 16 (太字)**: Markdownの太字記法がExcelのリッチテキスト書式に正しく変換されること。

## 4. 技術スタック
- **核心**: Electron, TypeScript, Node.js
- **外部ライブラリ**: ExcelJS (Excel生成), Marked (Markdown解析)
- **テスト**: Jest, fast-check (プロパティベーステスト)
- **ビルド**: electron-builder

## 5. 命名・構造規則
- ファイル名: `kebab-case`
- クラス/インターフェース: `PascalCase`
- パスエイリアス: `@/*` -> `src/*`
- 早期リターン/ガード節の積極活用（ネストの回避）
