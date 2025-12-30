const { ipcRenderer } = require("electron");

// アプリケーション状態を管理するオブジェクト
const appState = {
    inputFilePath: "",
    outputFilePath: "",
    isConverting: false
};

// UI要素を取得
const elements = {
    inputDisplay: document.getElementById("inputFileDisplay"),
    outputDisplay: document.getElementById("outputFileDisplay"),
    convertBtn: document.getElementById("convertBtn"),
    btnText: document.getElementById("btnText"),
    statusMessage: document.getElementById("statusMessage"),
};

/**
 * 変換ボタンの状態を更新
 */
function updateUIState() {
    const canConvert = appState.inputFilePath && appState.outputFilePath && !appState.isConverting;
    elements.convertBtn.disabled = !canConvert;

    if (appState.isConverting) {
        elements.btnText.innerHTML = '<span class="spinner"></span> 変換中...';
    } else {
        elements.btnText.textContent = "変換を開始する";
    }
}

/**
 * ステータスメッセージを表示
 */
function showStatus(text, type) {
    elements.statusMessage.textContent = text;
    elements.statusMessage.className = `status-${type}`;
    elements.statusMessage.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            elements.statusMessage.style.display = "none";
        }, 5000);
    }
}

/**
 * 入力ファイルを選択
 */
async function handleSelectInput() {
    const filePath = await ipcRenderer.invoke("select-input-file");
    if (filePath) {
        appState.inputFilePath = filePath;
        elements.inputDisplay.textContent = filePath;
        updateUIState();
    }
}

/**
 * 保存先ファイルを選択
 */
async function handleSelectOutput() {
    const filePath = await ipcRenderer.invoke("select-output-file");
    if (filePath) {
        appState.outputFilePath = filePath;
        elements.outputDisplay.textContent = filePath;
        updateUIState();
    }
}

/**
 * 変換実行
 */
async function handleConvert() {
    if (!appState.inputFilePath || !appState.outputFilePath || appState.isConverting) {
        return;
    }

    try {
        appState.isConverting = true;
        updateUIState();
        showStatus("Markdown を解析して Excel を生成しています...", "info");

        console.log(`Starting conversion: ${appState.inputFilePath} -> ${appState.outputFilePath}`);

        // メインプロセスの変換ハンドラーを呼び出し
        const result = await ipcRenderer.invoke(
            "convert-md-to-excel",
            appState.inputFilePath,
            appState.outputFilePath
        );

        console.log('Conversion result received:', result);

        if (result.success) {
            showStatus("変換が正常に完了しました！", "success");
        } else {
            throw new Error(result.error || "不明なエラーが発生しました");
        }
    } catch (error) {
        console.error('Conversion failed:', error);
        showStatus(`エラー: ${error.message}`, "error");
    } finally {
        appState.isConverting = false;
        updateUIState();
    }
}

// グローバルに公開（HTML から呼び出すため）
window.handleSelectInput = handleSelectInput;
window.handleSelectOutput = handleSelectOutput;
window.handleConvert = handleConvert;
