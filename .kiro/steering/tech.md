# 技術スタック

## コア技術
- **Electron**: デスクトップアプリケーションフレームワーク
- **TypeScript**: 厳格な型チェックを有効にした主要言語
- **Node.js**: ランタイム環境（v18以上）
- **ExcelJS**: Excelファイル生成ライブラリ
- **Marked**: Markdown解析ライブラリ

## 開発ツール
- **Jest**: ts-jestプリセットを使用したテストフレームワーク
- **fast-check**: プロパティベーステストライブラリ
- **electron-builder**: アプリケーションのパッケージングと配布

## ビルドシステム
- **TypeScriptコンパイラ**: src/をdist/にコンパイル
- **ターゲット**: ES2020、CommonJSモジュール
- **ソースマップ**: デバッグ用に有効化

## よく使うコマンド

### 開発
```bash
npm run dev          # TypeScriptビルド後にElectronを起動
npm run build        # TypeScriptをdist/にコンパイル
npm start            # ビルド後にアプリケーションを起動
```

### テスト
```bash
npm test             # 全テストを実行
npm run test:watch   # テストの監視モード
```

### 配布
```bash
npm run pack         # インストーラーなしでパッケージ化
npm run dist         # 配布用パッケージを作成
```

## プロジェクト設定
- **TypeScript**: 厳格モード有効、パスエイリアス設定済み（@/*）
- **Jest**: Node環境、カバレッジレポート有効
- **Electron Builder**: マルチプラットフォームビルド（Windows NSIS、macOS DMG、Linux AppImage）

## アーキテクチャパターン
- **メインプロセス**: Electronアプリのライフサイクル、IPCハンドラー、ウィンドウ管理
- **レンダラープロセス**: ファイルダイアログとユーザーインタラクションを含むUI層
- **パーサーモジュール**: インデント検出を伴う行単位のMarkdown解析
- **型システム**: ドキュメント構造とExcel設定の集約されたインターフェース
