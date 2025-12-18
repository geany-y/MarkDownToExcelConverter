# Markdown to Excel Converter

MarkdownファイルをExcelファイルに変換するElectronアプリケーションです。

## 機能

- Markdownファイルの構造とインデントを保持
- Excelの方眼紙形式で出力
- Markdownの書式をExcelの書式に変換
- シンプルなGUIインターフェース

## 開発環境のセットアップ

### 必要な環境

- Node.js (v18以上)
- npm

### インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# アプリケーションの起動
npm start
```

### 開発

```bash
# 開発モードで起動
npm run dev

# テストの実行
npm test

# テストの監視モード
npm run test:watch
```

### ビルド

```bash
# 配布用パッケージの作成
npm run dist
```

## プロジェクト構造

```
├── src/
│   ├── types/           # TypeScript型定義
│   ├── test-utils/      # テストユーティリティ
│   └── main.ts          # Electronメインプロセス
├── renderer/            # レンダラープロセス（UI）
├── dist/               # ビルド出力
└── release/            # 配布パッケージ
```

## ライセンス

MIT
