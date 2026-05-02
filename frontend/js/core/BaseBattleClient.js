import { BGM_MAP } from './Constants.js';

/**
 * BaseBattleClient クラス
 * WebSocket通信、バトル状態管理、イベントディスパッチの共通ロジックを定義します
 */
export class BaseBattleClient {
    constructor(ui) {
        this.ui = ui;
        this.sock = null;
        this.state = null;
        this.idToUiMap = {}; // UUID -> "p1a", "ally" 等のUIスロット名
        this.isProcessingEvents = false;
        this.eventQueue = [];
        this.playerId = localStorage.getItem("sb_player_id");
    }

    // --- 通信管理 ---

    connect(url) {
        return new Promise((resolve, reject) => {
            this.sock = new WebSocket(url);
            this.sock.onopen = () => {
                console.log("WebSocket Connected to:", url);
                resolve();
            };
            this.sock.onerror = (err) => reject(err);
            this.sock.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
            this.sock.onclose = () => this.handleClose();
        });
    }

    send(data) {
        if (this.sock && this.sock.readyState === WebSocket.OPEN) {
            this.sock.send(JSON.stringify(data));
        }
    }

    // --- メッセージ受信ハンドラ ---

    async handleMessage(data) {
        // 時差補正用の受信時刻
        data._receivedAt = Date.now();

        switch (data.type) {
            case "made_room":
            case "double_room_joined":
                await this.onBattleStart(data);
                break;
            case "accepted":
            case "turn_result":
                await this.onTurnResult(data);
                break;
            case "error":
                this.ui.setWaitMessage(data.message, 2000);
                break;
            case "opponent_disconnected":
                this.onOpponentDisconnected(data);
                break;
            default:
                console.warn("Unhandled message type:", data.type);
        }
    }

    // --- 抽象化されたイベントハンドラ ---

    async onBattleStart(data) {
        this.state = data.state;
        this.idToUiMap = data.info.id_to_ui_map;
        
        // 描画
        this.ui.render(this.state, data.info);
        this.ui.showMessage("バトルスタート！", 1500);
    }

    async onTurnResult(data) {
        // キューイング（演出中の割り込み防止）
        if (this.isProcessingEvents) {
            this.eventQueue.push(data);
            return;
        }

        this.isProcessingEvents = true;
        this.state = data.state;
        
        // 演出実行 (BaseUI または各サブクラスで実装)
        await this.ui.processTurnResult(data);
        
        this.isProcessingEvents = false;
        
        // 次のイベントがあれば処理
        if (this.eventQueue.length > 0) {
            const next = this.eventQueue.shift();
            this.onTurnResult(next);
        }
    }

    onOpponentDisconnected(data) {
        this.ui.showMessage("相手が切断しました", 0);
        this.ui.stopTimer();
        // 共通の終了処理
    }

    handleClose() {
        console.log("WebSocket Closed");
    }

    // --- 共通アクション ---

    sendWord(word, targetId = null) {
        this.send({
            type: "submit_word",
            info: {
                room_id: this.state.room_id,
                player_id: this.playerId,
                word: word,
                target_id: targetId
            }
        });
    }

    sendChangeAbility(abilityId, charId = null) {
        this.send({
            type: "change_ability",
            info: {
                room_id: this.state.room_id,
                player_id: this.playerId,
                char_id: charId,
                ability_id: abilityId
            }
        });
    }
}
