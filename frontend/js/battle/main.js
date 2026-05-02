import { SingleUI } from './SingleUI.js';
import { SingleBattleClient } from './SingleBattleClient.js';

// グローバルインスタンスの作成
const ui = new SingleUI();
const client = new SingleBattleClient(ui);

/**
 * HTML側から呼ばれるエントリーポイントをグローバルに公開
 */
window.startBattle = async function(mode, roomId = null, p1MaxLives = 1, p2MaxLives = 1) {
    console.log(`Starting ${mode} battle...`);
    
    // UIの初期化と画面遷移
    ui.reset();
    
    // WebSocket接続
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        if (window.location.port !== "8000") host = "localhost:8000";
    }
    const url = `${protocol}//${host}/ws`;
    
    try {
        await client.connect(url);
        
        if (mode === 'cpu') {
            client.startCpuBattle(p1MaxLives, p2MaxLives);
        } else {
            client.startMatch(p1MaxLives);
        }
    } catch (err) {
        console.error("Connection failed:", err);
        ui.showMessage("サーバーに接続できませんでした。");
    }
};

// 単語送信ボタンなどのイベントリスナー
$('#submit-btn').on('click', () => {
    const word = ui.input.val();
    if (word) {
        client.sendWord(word);
        ui.clearInput();
        ui.disableInput();
    }
});

$('#word-input').on('keypress', (e) => {
    if (e.which === 13) { // Enter
        $('#submit-btn').click();
    }
});

console.log("SingleBattle Module Loaded.");
