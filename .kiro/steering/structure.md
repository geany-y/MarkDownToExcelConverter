# プロジェクト構造

## ディレクトリ構成

```
├── src/                    # TypeScriptソースコード
│   ├── main.ts            # Electronメインプロセスのエントリーポイント
│   ├── parser/            # Markdown解析ロジック
│   ├── test-utils/        # テストユーティリティとヘルパー
│   └── types/             # TypeScript型定義
├── renderer/              # Electronレンダラープロセス（UI）
├── dist/                  # コンパイル済みTypeScript出力
├── release/               # 配布パッケージ
└── node_modules/          # 依存関係
```

## コード構成パターン

### メインプロセス（`src/main.ts`）
- Electronアプリのライフサイクル管理
- ファイルダイアログ用のIPCハンドラー
- ウィンドウの作成と管理
- 開発環境と本番環境の処理分岐

### パーサーモジュール（`src/parser/`）
- ファイル処理用の`MarkdownParser`クラス
- インデント検出を伴う行単位の解析
- Markdown構文の認識と分類
- 構造化された`Document`形式への型変換

### 型システム（`src/types/`）
- コアインターフェース：`DocumentLine`、`FormatInfo`、`Document`
- Excel設定の型とデフォルト値
- 詳細なJSDocを含む集約された型定義

### テストユーティリティ（`src/test-utils/`）
- 共有テストヘルパーとジェネレーター
- fast-checkによるプロパティベーステストサポート
- 再利用可能なテストデータ作成関数

## 命名規則
- **ファイル**: kebab-case（例：`markdown-parser.ts`）
- **クラス**: PascalCase（例：`MarkdownParser`）
- **インターフェース**: PascalCase（例：`DocumentLine`）
- **関数**: 説明的な名前のcamelCase
- **定数**: 設定用はcamelCase、真の定数はUPPER_CASE

## パスエイリアス
- `@/*` は `src/*` にマップされ、よりクリーンなインポートを実現
- `@/types/*` は型のインポート用
- `@/test-utils/*` はテストユーティリティ用
