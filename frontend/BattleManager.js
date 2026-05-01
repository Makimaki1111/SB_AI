/**
 * Shiritori Battle Unified Battle Manager
 * Handles both Single and Double battle logic using the standardized schema.
 */
class BattleManager {
    constructor(options = {}) {
        this.mode = options.mode || 'single'; // 'single' or 'double'
        this.ui = options.ui; // UI instance (UI.js or double_UI.js)
        this.myPlayerIds = [];
        this.battleState = null;
        this.sock = null;
        this.isProcessingEvents = false;
        this.pendingMessages = [];
        this.allAbilities = {};
        this.player1_id = localStorage.getItem("sb_player_id");
        
        // ID to UI Mapping
        this.idToUiMap = {};
    }

    /**
     * Connects to the battle WebSocket
     */
    connect(url, type, info = {}) {
        console.log(`Connecting to ${url} as ${type}...`);
        this.sock = new WebSocket(url);

        this.sock.onopen = () => {
            this.sock.send(JSON.stringify({ type, info }));
        };

        this.sock.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            await this.handleMessage(data);
        };

        this.sock.onclose = () => {
            console.log("WebSocket closed");
        };
    }

    /**
     * Central message handler
     */
    async handleMessage(data) {
        switch (data.type) {
            case "made_room":
            case "init_double_battle":
                await this.initBattle(data);
                break;
            case "accepted":
                if (this.isProcessingEvents) {
                    this.pendingMessages.push(data);
                } else {
                    this.isProcessingEvents = true;
                    await this.processTurnResult(data);
                    this.isProcessingEvents = false;
                    
                    while (this.pendingMessages.length > 0) {
                        const next = this.pendingMessages.shift();
                        this.isProcessingEvents = true;
                        await this.processTurnResult(next);
                        this.isProcessingEvents = false;
                    }
                }
                break;
            case "pre_check":
                this.handlePreCheck(data);
                break;
            case "error":
                this.ui.setWaitMessage(data.message, 2000);
                this.ui.enableInput();
                break;
            case "waiting":
                this.ui.setWaitMessage(data.message || "対戦相手を待っています...");
                break;
        }
    }

    /**
     * Initialize battle state and UI
     */
    async initBattle(data) {
        this.battleState = data.state;
        this.allAbilities = data.all_abilities || {};
        
        // 自分のIDを特定
        this.myPlayerIds = [];
        for (const [id, char] of Object.entries(data.state.characters)) {
            if (char.owner_id === this.player1_id) {
                this.myPlayerIds.push(id);
            }
        }

        // ID to UI Mapping の構築
        this.idToUiMap = {};
        if (this.mode === 'single') {
            for (const id of Object.keys(data.state.characters)) {
                this.idToUiMap[id] = this.myPlayerIds.includes(id) ? "ally" : "foe";
            }
        } else {
            // ダブルは ID そのまま
            for (const id of Object.keys(data.state.characters)) {
                this.idToUiMap[id] = id;
            }
        }

        this.ui.init(data, this.idToUiMap, this);
        await this.ui.showStartMessage();
        this.handleTurnStart(data.state);
    }

    /**
     * Process turn result (word, events, state sync)
     */
    async processTurnResult(data) {
        const state = data.state;
        const events = data.events;

        // タイマー停止
        this.ui.stopTimer();

        // 単語の表示 (タイムアウトでない場合)
        const isTimeout = events.some(e => e.message && e.message.includes("時間切れ"));
        if (!isTimeout && state.word && state.last_actor_id) {
            const uiId = this.idToUiMap[state.last_actor_id];
            this.ui.setWord(uiId, state.word);
            
            // タイプの表示とSE
            const char = state.characters[state.last_actor_id];
            if (char && char.types && char.types.length > 0) {
                this.ui.setCharImage(uiId, char.types);
                this.playIconSound(char.types[0]);
            }
            await this.sleep(1000);
        }

        // イベント再生
        if (events && events.length > 0) {
            for (const e of events) {
                await this.processEvent(e);
            }
        }

        // 最終ステータスの同期
        this.syncState(state);

        // 次のターン開始判定
        if (state.ally_win === true) {
            this.ui.onWin();
        } else if (state.ally_win === false) {
            this.ui.onLose();
        } else {
            this.handleTurnStart(state);
        }
    }

    async processEvent(e) {
        const isAlly = e.target && this.myPlayerIds.includes(e.target);
        const uiId = this.idToUiMap[e.target];

        // メッセージ表示 (特性変更以外)
        if (e.type !== "ability_changed") {
            this.ui.showMessage(e.message || "");
            this.playEventSound(e.type, e.message);
        }

        switch (e.type) {
            case "damage":
                if (e.target && e.damage !== undefined) {
                    await this.ui.applyDamage(uiId, e.damage, e.message);
                }
                break;
            case "cure":
                if (e.target && e.amount !== undefined) {
                    await this.ui.applyCure(uiId, e.amount);
                }
                break;
            case "stat_change":
                if (e.target && e.stat_type) {
                    this.ui.applyStatChange(uiId, e.stat_type, e.new_rank);
                }
                break;
            case "ability_trigger":
                if (e.poison_target) {
                    this.ui.applyPoison(this.idToUiMap[e.poison_target]);
                }
                if (e.new_ranks) {
                    for (const [id, ranks] of Object.entries(e.new_ranks)) {
                        this.ui.applyStatChange(this.idToUiMap[id], "attack", ranks.attack_rank);
                        this.ui.applyStatChange(this.idToUiMap[id], "defense", ranks.defense_rank);
                    }
                }
                break;
            case "ability_changed":
                this.ui.onAbilityChanged(e);
                break;
        }
        
        const waitTime = e.type === "ability_changed" ? 100 : 1000;
        await this.sleep(waitTime);
    }

    handleTurnStart(state) {
        this.battleState = state;
        if (state.is_my_turn) {
            this.ui.onMyTurnStart(state);
        } else {
            this.ui.onOpponentTurnStart(state);
        }
    }

    syncState(state) {
        this.ui.syncAll(state, this.idToUiMap);
    }

    handlePreCheck(data) {
        this.ui.updatePreCheck(data);
    }

    /**
     * Sends a word to the server
     */
    submitWord(word, targetId = null) {
        if (!word || !this.sock || this.sock.readyState !== WebSocket.OPEN) return;
        this.ui.disableInput();
        this.ui.clearInput();
        this.ui.hideCheckResult();
        
        const info = {
            player_id: this.player1_id,
            room_id: this.battleState?.room_id,
            word: word,
            target_id: targetId
        };
        this.sock.send(JSON.stringify({ type: "submit_word", info }));
    }

    /**
     * Sends pre-check request for type prediction
     */
    sendPreCheck(text) {
        if (!text || !this.sock || this.sock.readyState !== WebSocket.OPEN) return;
        const info = {
            player_id: this.player1_id,
            room_id: this.battleState?.room_id,
            text: text
        };
        this.sock.send(JSON.stringify({ type: "pre_check", info }));
    }

    /**
     * Sends ability change request
     */
    changeAbility(newAbilityId, charId = "p1") {
        if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
        const info = {
            player_id: this.player1_id,
            room_id: this.battleState?.room_id,
            ability_id: newAbilityId,
            char_id: charId
        };
        this.sock.send(JSON.stringify({ type: "change_ability", info }));
    }

    // --- Helpers ---
    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    playIconSound(type) {
        if (typeof playIconSound === 'function') playIconSound(type);
    }

    playEventSound(type, message) {
        if (typeof playEventSound === 'function') playEventSound(type, message);
    }
}
