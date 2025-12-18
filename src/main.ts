import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';

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
    const window = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // レンダラープロセスのHTMLファイルを読み込み
    window.loadFile(path.join(__dirname, '../renderer/index.html'));

    // 開発時はDevToolsを開く
    if (process.env.NODE_ENV === 'development') {
        window.webContents.openDevTools();
    }

    return window;
}

/**
 * IPCハンドラーを設定する
 */
function setupIpcHandlers(): void {
    // 入力ファイル選択ダイアログ
    ipcMain.handle('select-input-file', async () => {
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
}

// Electronの初期化が完了したらウィンドウを作成
app.whenReady().then(() => {
    createWindow();
    setupIpcHandlers();
});

// すべてのウィンドウが閉じられたらアプリを終了（macOS以外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOSでDockアイコンがクリックされた時にウィンドウを再作成
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
