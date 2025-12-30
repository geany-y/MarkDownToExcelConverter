# 技術設計書 (Technical Design)

## 1. アーキテクチャ
```
[Markdownファイル] → [Markdown Parser] → [構造化データ] → [Excel Generator] → [Excelファイル]
```

### 主要プロセスの責任
- **Main Process (Electron)**: アプリのライフサイクル、IPCハンドラー、ダイアログ管理。
- **Renderer Process (UI)**: ファイル選択UI、ユーザーインタラクション。
- **Parser Module**: 行単位の解析、インデント検出、Markdown要素の分類。
- **Generator Module**: ExcelJSを使用したExcelワークブック生成、方眼紙レイアウト、書式適用。

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
- 列幅: 15.0
- 行高さ: 20.0
- インデントオフセット: 1列
- 基本フォント: Arial / 等幅フォント: Consolas
- 見出しサイズ: H1=18, H2=16, H3=14...

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
