import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseMarkdownFile } from './parser/markdown-parser';
import { writeExcel } from './writer/excel-writer';
import { defaultExcelConfig } from './types';

console.log('Main process starting...');

// WSL環境/Linux環境でのビデオドライバ問題を回避するため、ハードウェアアクセラレーションを無効化
app.disableHardwareAcceleration();

/**
 * メインウィンドウを取得する
 * BrowserWindow.getAllWindows()から最初のウィンドウを返す
 */
function getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
}

/**
 * メインウィンドウを作成する
 */
function createWindow(): BrowserWindow {
    console.log('Creating window...');
    const window = new BrowserWindow({
        height: 600,
        width: 800,
        title: 'AntiGravity - Markdown to Excel Converter',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 読み込み状態の監視用イベント
    window.webContents.on('did-finish-load', () => {
        console.log('Window loaded successfully');
    });

    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error(`Failed to load window: ${errorCode} - ${errorDescription}`);
        console.error(`Attempted URL: ${validatedURL}`);
    });

    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log(`Loading file: ${indexPath}`);

    // レンダラープロセスのHTMLファイルを読み込み
    window.loadFile(indexPath).catch(err => {
        console.error('Error during window.loadFile:', err);
    });

    return window;
}

/**
 * IPCハンドラーを設定する
 */
function setupIpcHandlers(): void {
    console.log('Setting up IPC handlers...');

    // 入力ファイル選択ダイアログ
    ipcMain.handle('select-input-file', async () => {
        console.log('IPC: select-input-file called');
        const mainWindow = getMainWindow();
        if (!mainWindow) {
            return null;
        }

        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Markdown Files', extensions: ['md', 'markdown'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        return result.canceled ? null : result.filePaths[0];
    });

    // 出力ファイル選択ダイアログ
    ipcMain.handle('select-output-file', async () => {
        console.log('IPC: select-output-file called');
        const mainWindow = getMainWindow();
        if (!mainWindow) {
            return null;
        }

        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'Excel Files', extensions: ['xlsx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        return result.canceled ? null : result.filePath;
    });

    // Markdown から Excel への変換実行
    ipcMain.handle('convert-md-to-excel', async (_event, inputPath: string, outputPath: string) => {
        console.log(`IPC: convert-md-to-excel called. Input: ${inputPath}, Output: ${outputPath}`);
        try {
            // 1. Markdown の解析
            const document = await parseMarkdownFile(inputPath);

            // 2. Excel Buffer の生成 (デフォルト設定を使用、既存ファイルがあれば読み込む)
            const excelBuffer = await writeExcel(document, defaultExcelConfig, outputPath);

            // 3. ファイルへの書き出し
            await fs.writeFile(outputPath, excelBuffer);

            console.log('Conversion successful');
            return { success: true };
        } catch (error) {
            console.error('Conversion error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    });

    console.log('IPC handlers registered: select-input-file, select-output-file, convert-md-to-excel');
}

// Electronの初期化が完了したらセットアップ
app.whenReady().then(() => {
    console.log('App is ready. Setting up IPC and creating window...');
    setupIpcHandlers();
    createWindow();
}).catch(err => {
    console.error('Failed to initialize app:', err);
});

// すべてのウィンドウが閉じられたらアプリを終了（macOS以外）
app.on('window-all-closed', () => {
    console.log('All windows closed. Quitting app...');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// アプリ終了時にプロセスを確実に落とす (WSL環境対策)
app.on('quit', () => {
    console.log('App quit event received. Exiting process...');
    process.exit(0);
});

// macOSでDockアイコンがクリックされた時にウィンドウを再作成
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
