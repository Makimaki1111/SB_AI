import { SingleUI } from './SingleUI.js';
import { SingleBattleClient } from './SingleBattleClient.js';

$(() => {
    const ui = new SingleUI();
    const client = new SingleBattleClient(ui);

    // 既存の HTML 内インラインスクリプトやデバッグ用にグローバル露出（暫定）
    window.battleClient = client;
    window.ui = ui;

    // WebSocket URL の生成ロジック
    const getWSUrl = () => {
        let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        let host = window.location.host;
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            if (window.location.port !== "8000") {
                host = "localhost:8000";
            }
        } else if (!host || window.location.protocol === 'file:') {
            host = "localhost:8000";
            protocol = "ws:";
        }
        return `${protocol}//${host}/ws`;
    };

    const wsUrl = getWSUrl();

    // --- レガシーHTMLスクリプト用ブリッジ ---
    window.startBattle = (mode, roomId = null, p1MaxLives = 1, p2MaxLives = 1) => {
        if (!client.sock || client.sock.readyState !== WebSocket.OPEN) {
            client.connect(wsUrl);
            const checkReady = setInterval(() => {
                if (client.sock.readyState === WebSocket.OPEN) {
                    clearInterval(checkReady);
                    initiate();
                }
            }, 100);
        } else {
            initiate();
        }

        function initiate() {
            if (mode === 'player') {
                client.startMatch(p1MaxLives);
            } else if (mode === 'cpu') {
                client.startCpuBattle(p1MaxLives, p2MaxLives);
            } else if (mode === 'room') {
                client.joinPrivateRoom(roomId, p1MaxLives, p2MaxLives);
            }
        }
    };

    window.backToTitle = () => ui.showTitleScreen();

    // 入力・送信イベント
    $('#submit').on('click', () => {
        const word = ui.input.val();
        if (word) {
            client.sendWord(word);
            ui.clearInput();
            ui.disableInput();
            ui.hideCheckResult();
        }
    });

    ui.input.selector.on('keypress', (e) => {
        if (e.which === 13) {
            $('#submit').click();
        }
    });

    ui.input.selector.on('input', () => {
        const word = ui.input.val();
        if (word) {
            client.sendIncludeCheck(word);
        } else {
            ui.hideCheckResult();
        }
    });

    // ロビー画面のイベントバインド
    $('#vs-cpu-btn').on('click', () => {
        client.connect(wsUrl);
        // 接続完了後にバトル開始（本来は onOpen でやるべきだが、今は script.js の流れに合わせる）
        setTimeout(() => {
            client.startCpuBattle();
            ui.showBattleScreen();
        }, 500);
    });

    $('#random-match-btn').on('click', () => {
        client.connect(wsUrl);
        setTimeout(() => {
            client.startMatch();
            ui.showMessage("対戦相手を探しています...");
        }, 500);
    });
});
