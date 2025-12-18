const { ipcRenderer } = require("electron");

// アプリケーション状態を管理するオブジェクト
const appState = {
    inputFilePath: "",
    outputFilePath: "",
};

// UI要素を取得するヘルパー関数
function getUIElements() {
    return {
        inputFileInput: document.getElementById("inputFile"),
        outputFileInput: document.getElementById("outputFile"),
        convertBtn: document.getElementById("convertBtn"),
        messageDiv: document.getElementById("message"),
    };
}

// 変換ボタンの状態を更新
function updateConvertButton() {
    const { convertBtn } = getUIElements();
    convertBtn.disabled = !(appState.inputFilePath && appState.outputFilePath);
}

// メッセージを表示
function showMessage(text, type) {
    const { messageDiv } = getUIElements();
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = "block";

    if (type !== "success") {
        return;
    }

    setTimeout(() => {
        messageDiv.style.display = "none";
    }, 3000);
}

// 入力ファイルを選択
async function selectInputFile() {
    const filePath = await ipcRenderer.invoke("select-input-file");
    if (!filePath) {
        return; // キャンセルされた場合は何もしない
    }

    appState.inputFilePath = filePath;
    const { inputFileInput } = getUIElements();
    inputFileInput.value = filePath;
    updateConvertButton();
}

// 出力ファイルを選択
async function selectOutputFile() {
    const filePath = await ipcRenderer.invoke("select-output-file");
    if (!filePath) {
        return; // キャンセルされた場合は何もしない
    }

    appState.outputFilePath = filePath;
    const { outputFileInput } = getUIElements();
    outputFileInput.value = filePath;
    updateConvertButton();
}

// ファイルを変換
async function convertFile() {
    const { convertBtn } = getUIElements();

    try {
        convertBtn.disabled = true;
        showMessage("変換を開始しています...", "info");

        // TODO: 実際の変換処理を実装
        // 現在はプレースホルダー
        const inputPath = appState.inputFilePath;
        const outputPath = appState.outputFilePath;

        // 変換処理のシミュレーション
        await new Promise((resolve) => setTimeout(resolve, 1000));

        showMessage("変換が完了しました！", "success");
    } catch (error) {
        showMessage(`エラーが発生しました: ${error.message}`, "error");
    } finally {
        convertBtn.disabled = false;
        updateConvertButton();
    }
}

// グローバルスコープに関数を公開（HTMLから呼び出すため）
window.selectInputFile = selectInputFile;
window.selectOutputFile = selectOutputFile;
window.convertFile = convertFile;
