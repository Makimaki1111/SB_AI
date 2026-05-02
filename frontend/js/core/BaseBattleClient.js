export class BaseBattleClient {
    constructor(ui) {
        this.ui = ui;
        this.sock = null;
        this.state = null;
        this.info = null;
        
        // プレイヤーIDの取得または生成
        let pid = localStorage.getItem("sb_player_id");
        if (!pid) {
            pid = "player_" + Math.random().toString(36).substring(2, 9);
            localStorage.setItem("sb_player_id", pid);
        }
        this.playerId = pid;
        console.log("Player ID initialized:", this.playerId);
        
        // 特性情報の保持
        this.allAbilities = null;
        
        // イベント（アニメーション）処理用
        this.isProcessingEvents = false;
        this.eventQueue = [];
    }

    connect(url) {
        // すでに接続済み、または接続試行中なら何もしない
        if (this.sock && (this.sock.readyState === WebSocket.OPEN || this.sock.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket is already connecting or open.");
            return;
        }

        console.log("Connecting to WebSocket:", url);
        if (this.sock) this.sock.close();
        this.sock = new WebSocket(url);
        this.sock.onopen = (e) => this.onOpen(e);
        this.sock.onmessage = (e) => this.onMessage(JSON.parse(e.data));
        this.sock.onclose = (e) => this.onClose(e);
        this.sock.onerror = (e) => this.onError(e);
    }

    onOpen(e) {
        console.log("Connected to Battle Server");
    }

    onMessage(data) {
        // 全特性情報の更新
        if (data.info && data.info.all_abilities) {
            this.allAbilities = data.info.all_abilities;
        }

        // バックエンドの新構造（BattleResponse）を判定
        if (data.state && data.info) {
            this.state = data.state;
            this.info = data.info;
            
            // UI全体の再描画（不一致バグの解消ポイント）
            this.ui.render(this.state, this.info, this.allAbilities);

            // イベント（ダメージ演出等）があれば処理
            if (data.events && data.events.length > 0) {
                this.handleEvents(data.events);
            }
        }

        // その他（エラー等）の処理
        if (data.type === "pre_check") {
            this.ui.showCheckResult(data);
        } else if (data.type === "error") {
            alert(data.message);
        }
    }

    async handleEvents(events) {
        for (const event of events) {
            // メッセージ表示と音
            if (event.message) {
                this.ui.showMessage(event.message);
            }
            this.ui.playEventSound(event.type, event.message);

            // ここに各イベントタイプごとの演出（ダメージアニメ等）を追加可能
            
            // 演出の余韻
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    sendWord(word, targetId = null) {
        if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;

        const payload = {
            type: this.getSubmitWordType(),
            info: {
                room_id: this.state.room_id,
                player_id: this.playerId,
                word: word,
                target_id: targetId
            }
        };
        this.sock.send(JSON.stringify(payload));
    }

    sendIncludeCheck(word) {
        if (!this.sock || this.sock.readyState !== WebSocket.OPEN || !this.state) return;
        this.sock.send(JSON.stringify({
            type: "include_check",
            info: {
                room_id: this.state.room_id,
                word: word
            }
        }));
    }

    // シングルとダブルでメッセージタイプが違うためオーバーライド用
    getSubmitWordType() {
        return "submit_word";
    }

    onClose(e) {
        console.log("WebSocket closed");
    }

    onError(e) {
        console.error("WebSocket error:", e);
    }
}
