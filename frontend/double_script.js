// double_script.js - ダブルバトル用のスクリプト
let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
    player1_id = "player_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("sb_player_id", player1_id);
}

const TURN_TIME_LIMIT = 20;
let isProcessingTurnResult = false;
const pendingTurnResults = [];

const doubleBattleState = {
    roomId: null,
    mode: null, // '1v1_double', '2v2_double'
    character: "",
    // P1A, P1B, P2A, P2B のスチE�Eタスを保持
    chars: {
        p1a: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', is_defeated: false },
        p1b: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', is_defeated: false },
        p2a: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', is_defeated: false },
        p2b: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', is_defeated: false }
    },
    currentTargetId: null, // "p2a" or "p2b" or "p1a" etc
    isMyTurn: false,
    myTeam: null,
    allAbilities: {}
};

function getUIId(id) {
    if (doubleBattleState.myTeam === 'team2') {
        if (id.startsWith('p1')) return 'p2' + id.substring(2);
        if (id.startsWith('p2')) return 'p1' + id.substring(2);
    }
    return id;
}

function getRealId(uiId) {
    return getUIId(uiId); // The mapping is perfectly symmetric
}

function getUiCharsState() {
    const mapped = {};
    for (const uiId of ['p1a', 'p1b', 'p2a', 'p2b']) {
        const realId = getRealId(uiId);
        if (doubleBattleState.chars[realId]) {
            mapped[uiId] = doubleBattleState.chars[realId];
        }
    }
    return mapped;
}

let ui;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function shouldPlayAbilityChangeSound(event) {
    if (!event) return false;

    const expectedUntil = window.__sbExpectConcentUntil || 0;
    if (Date.now() <= expectedUntil) {
        return true;
    }

    const changedCharId = event.char_id;
    if (!changedCharId || !doubleBattleState.chars[changedCharId]) {
        return false;
    }
    return doubleBattleState.chars[changedCharId].owner_id === player1_id;
}

function hasParentAudioManager() {
    try {
        return !!(window.parent && window.parent !== window && window.parent.SB_AUDIO);
    } catch (e) {
        return false;
    }
}

function navigateToSingleBattle() {
    // 1) If running inside index iframe, ask parent to navigate.
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'sb:navigate', page: 'single_battle.html' }, '*');
            return true;
        }
    } catch (e) {
        // noop
    }

    // 2) Fallback for non-iframe open.
    try {
        window.location.replace('index.html#single_battle.html');
        return true;
    } catch (e) {
        // noop
    }

    window.location.href = 'index.html#single_battle.html';
    return true;
}

let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
let host = window.location.host;
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    if (window.location.port !== "8000") host = "localhost:8000";
} else if (!host || window.location.protocol === 'file:') {
    host = "localhost:8000";
    protocol = "ws:";
}
const websock_double_server = `${protocol}//${host}/ws/double`;

let sock = null;
let isReturningToLobby = false;
let hasStartedDoubleBattle = false;

function setBattleActionButtonsVisible(visible) {
    const display = visible ? "flex" : "none";
    const sit = document.getElementById("situation-button");
    const abi = document.getElementById("ability-info-container");
    if (sit) sit.style.setProperty("display", display, "important");
    if (abi) abi.style.setProperty("display", display, "important");
}

function showDoubleBattleWaitingScreen(message) {
    hasStartedDoubleBattle = false;
    $('#double-lobby-screen').hide();
    $('#double-battle-screen').show();

    ui.resetAll();
    ui.setName('p1a', "チーム1A");
    ui.setName('p1b', "チーム1B");
    ui.setName('p2a', "チーム2A");
    ui.setName('p2b', "チーム2B");
    ['p1a', 'p1b', 'p2a', 'p2b'].forEach((id) => {
        ui.chars[id].hpBar.selector.stop(true, true).css({ width: '100%', backgroundColor: '#9e9e9e' });
        ui.chars[id].hpText.selector.text('??/??');
        ui.setWord(id, "");
        ui.setCharVisibility(id, true);
    });

    if (doubleBattleState.roomId) {
        ui.showMessage(`ルームID: ${doubleBattleState.roomId}`);
    } else {
        ui.showMessage("マッチング中...");
    }
    ui.setTargetSelectionVisible(false);
    setBattleActionButtonsVisible(false);
    ui.targetSelectionUi.selector.hide();
    ui.setWaitMessage(message || "対戦相手を待っています...");
}

$(() => {
    ui = new DoubleUI();
    window.__sbSuppressConcentWithoutIntent = true;

    preloadImages();

    const preloadPaths = [
        "resource/horizon.mp3",
        "resource/overflow.mp3",
        "resource/start.mp3",
        "resource/end.mp3",
        "resource/heal.mp3",
        "resource/down.mp3",
        "resource/up.mp3",
        "resource/seed_damage.mp3",
        "resource/middmg.mp3",
        "resource/effective.mp3",
        "resource/noneffective.mp3",
        "resource/seeded.mp3",
        "resource/poison.mp3",
        "resource/pera.mp3",
        "resource/concent.mp3"
    ];
    if (typeof type_to_image !== "undefined") {
        Object.values(type_to_image).forEach((name) => preloadPaths.push(`resource/${name}.mp3`));
    }
    if (typeof preloadSounds === "function") {
        preloadSounds(preloadPaths);
    }
    if (!hasParentAudioManager() && typeof startBGM === "function") {
        startBGM("resource/horizon.mp3");
    }

    let isAudioUnlocked = false;
    const userInteractionHandler = () => {
        if (isAudioUnlocked) return;
        isAudioUnlocked = true;
        if (typeof unlockAudioContext === "function") unlockAudioContext();
        if (!hasParentAudioManager() && typeof startBGM === "function") {
            startBGM("resource/horizon.mp3");
        }
    };
    document.body.addEventListener("click", userInteractionHandler, { once: true });
    document.body.addEventListener("touchstart", userInteractionHandler, { once: true });

    // 画面サイズに合わせてスケーリング
    window.addEventListener('resize', adjustWindowScale);
    adjustWindowScale(); // 初期実衁E
    if (typeof wanakana !== 'undefined') {
        wanakana.bind(document.getElementById('input'));
    }

    $('#create-double-room-btn').on('click', () => {
        const mode = $('input[name="double_mode"]:checked').val();
        doubleBattleState.roomId = null;
        showDoubleBattleWaitingScreen("ルームを作成中...");
        connectDoubleWebSocket('create', mode);
    });

    $('#join-double-room-btn').on('click', () => {
        const roomId = $('#double-room-id-input').val();
        if (!roomId) {
            alert("ルームIDを入力してください");
            return;
        }
        doubleBattleState.roomId = roomId;
        showDoubleBattleWaitingScreen(`ルーム ${roomId} に接続中...`);
        connectDoubleWebSocket('join', null, roomId);
    });

    $('#cpu-double-battle-btn').on('click', () => {
        doubleBattleState.roomId = null;
        showDoubleBattleWaitingScreen("CPU戦を開始中...");
        connectDoubleWebSocket('cpu');
    });


    // ターゲチE��選択�Eタン
    $('#target-p2a-btn').on('click', () => selectTarget('p2a'));
    $('#target-p2b-btn').on('click', () => selectTarget('p2b'));

    // Modal Events
    ui.situationButton.selector.off('click').on('click', () => {
        ui.updateSituationInfo({ chars: getUiCharsState() });
        ui.showSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeSituationModalBtn.selector.off('click').on('click', () => {
        ui.hideSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.abilityInfoContainer.selector.off('click').on('click', () => {
        ui.updateAbilityInfo(getUiCharsState(), doubleBattleState.allAbilities, (charId, abilityId) => {
            sendChangeAbilityDouble(charId, abilityId);
        });
        ui.showAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeAbilityModalBtn.selector.off('click').on('click', () => {
        ui.hideAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    // 送E��る（降参）�Eタン
    ui.cancelBtn.selector.off('click').on('click', (e) => {
        e.preventDefault();
        if (confirm("本当に逃げますか？\n（チームが全滅扱いになる可能性があります）")) {
            if (sock && sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({
                    type: "run_away_double",
                    info: {
                        room_id: doubleBattleState.roomId,
                        player_id: player1_id
                    }
                }));
            }
            backToLobby();
        }
    });

    // 勝敗後に表示される「タイトルに戻る」�Eタン
    ui.backToTitleBtn.selector.off('click').on('click', (e) => {
        e.preventDefault();
        backToLobby();
    });

    // 入力中のタイプチェチE�� (script.jsと同じ)
    ui.input.selector.off('input').on('input', () => {
        if (!doubleBattleState.roomId) {
            ui.hidePreImg();
            return;
        }
        const text = ui.input.selector.val();
        if (text) {
            if (text.charAt(0) !== doubleBattleState.character) {
                // 開始文字不一致
            } else {
                sendIncludeCheckDouble(doubleBattleState.roomId, text);
            }
        } else {
            ui.hidePreImg();
        }
    });

    // Fetch abilities for modals
    let baseUrl = '';
    const hostname = window.location.hostname;
    if (!hostname || window.location.protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1') {
        if (window.location.port !== '8000') baseUrl = 'http://localhost:8000';
    }
    fetch(`${baseUrl}/abilities`).then(r => r.json()).then(d => {
        doubleBattleState.allAbilities = d;
    }).catch(e => console.error("Failed to load abilities", e));
});

function connectDoubleWebSocket(action, mode, roomId) {
    if (sock) {
        sock.close();
    }

    const ws = new WebSocket(websock_double_server);
    sock = ws; // グローバルに保持しておくが、イベント�Eではローカルのwsを使ぁE
    ws.addEventListener("open", function () {
        console.log("Double WebSocket connected");
        setBattleActionButtonsVisible(false);
        ui.targetSelectionUi.selector.hide();

        const name = localStorage.getItem("sb_username");
        const ability = localStorage.getItem("sb_ability");
        if (name || ability) {
            ws.send(JSON.stringify({
                type: "update_user_info",
                info: {
                    player_id: player1_id,
                    name: name || "名無し",
                    ability: ability || ""
                }
            }));
        }

        if (action === 'create') {
            ws.send(JSON.stringify({
                type: "create_double_room",
                info: { player_id: player1_id, mode: mode }
            }));
        } else if (action === 'join') {
            ws.send(JSON.stringify({
                type: "join_double_room",
                info: { player_id: player1_id, room_id: roomId }
            }));
        } else if (action === 'cpu') {
            ws.send(JSON.stringify({
                type: "join_double_cpu_room",
                info: { player_id: player1_id }
            }));
        }
    });

    ws.addEventListener("message", async function (e) {
        const data = JSON.parse(e.data);
        data._receivedAt = Date.now();
        console.log("Double WS received:", data);

        if (data.type === "double_room_created") {
            $("#double-room-id-input").val(data.room_id);
            doubleBattleState.roomId = data.room_id;
            ui.showMessage(`ルームID: ${data.room_id}`);
            ui.setWaitMessage("参加者待機中...");
        } else if (data.type === "waiting_for_players") {
            if (doubleBattleState.roomId) {
                ui.showMessage(`ルームID: ${doubleBattleState.roomId}`);
            }
            const waitText = `待機中... (${data.current}/${data.required} 人)`;
            ui.setWaitMessage(waitText);
        }
        else if (data.type === "init_double_battle") {
            await initDoubleBattle(data);
        } else if (data.type === "turn_result") {
            if (isProcessingTurnResult) {
                // 前�Eターン結果を�E琁E��の場合�Eキューに入れる
                pendingTurnResults.push(data);
            } else {
                isProcessingTurnResult = true;
                await handleTurnResult(data);
                isProcessingTurnResult = false;

                while (pendingTurnResults.length > 0) {
                    await sleep(500);
                    isProcessingTurnResult = true;
                    const next = pendingTurnResults.shift();
                    await handleTurnResult(next);
                    isProcessingTurnResult = false;
                }
            }
        } else if (data.type === "error") {
            // エラー表示をUIに反映
            ui.setWaitMessage(data.message, 2000);

            ui.enableInput();
        } else if (data.type === "pre_check") {
            // include_checkの結果
            onDoublePreCheck(data);
        }
    });

    ws.addEventListener("close", function () {
        console.log("Double WebSocket closed");
    });
}

async function initDoubleBattle(data) {
    hasStartedDoubleBattle = true;
    $('#double-lobby-screen').hide();
    $('#double-battle-screen').show();

    battleState = data; // store room state
    doubleBattleState.roomId = data.room_id;
    doubleBattleState.mode = data.mode;
    doubleBattleState.isVsCpu = data.is_cpu || false;
    doubleBattleState.lastFoeWord = null; // バトル開始時にリセチE��

    // Determine myTeam based on owner_id
    doubleBattleState.myTeam = 'team1';
    for (let id of ['p1a', 'p1b', 'p2a', 'p2b']) {
        if (data.characters[id] && data.characters[id].owner_id === player1_id) {
            doubleBattleState.myTeam = id.startsWith('p1') ? 'team1' : 'team2';
            break;
        }
    }

    ui.resetAll();

    // resetAll()で隠れてしまぁE��め、�E表示する
    setBattleActionButtonsVisible(true);
    ui.targetSelectionUi.selector.css('display', 'flex');

    updateUIWithCharacters(data.characters);

    ui.showMessage("バトルスタート！");
    playEventSound("start", "");
    startBGM("resource/overflow.mp3");

    // Ensure all characters are visible initially
    $('.char-wrapper').show();

    await sleep(1500);
    ui.hideMessage();

    handleTurnStart(data);
}

function updateUIWithCharacters(chars) {
    const ids = ['p1a', 'p1b', 'p2a', 'p2b'];
    for (let id of ids) {
        if (chars[id]) {
            doubleBattleState.chars[id] = chars[id];

            const uiId = getUIId(id);
            ui.setName(uiId, chars[id].name, chars[id].is_poison);
            ui.setHP(uiId, chars[id].hp, chars[id].maxHp);
            if (chars[id].is_defeated) {
                ui.setCharVisibility(uiId, false);
            }
        }
    }
}

async function handleTurnResult(data) {
    const onlyAbilityChanged = !!(data.events && data.events.length > 0 && data.events.every(ev => ev.type === "ability_changed"));
    if (!onlyAbilityChanged) {
        ui.stopTimer();
        ui.hideInputArea();
    }

    const isTimeout = data.events && data.events.some(e => e.message && e.message.includes("時間切れ"));

    // Show the played word if it was a valid turn AND not a timeout
    if (!isTimeout && data.word && data.last_actor_id) {
        const uiLastActorId = getUIId(data.last_actor_id);
        ui.setWord(uiLastActorId, data.word);

        // 相手チームの言葉を記録
        if (doubleBattleState.myTeam === 'team1' && (uiLastActorId === 'p2a' || uiLastActorId === 'p2b')) {
            doubleBattleState.lastFoeWord = data.word;
        } else if (doubleBattleState.myTeam === 'team2' && (uiLastActorId === 'p1a' || uiLastActorId === 'p1b')) {
            doubleBattleState.lastFoeWord = data.word;
        }

        const types = data.characters[data.last_actor_id].types || [];
        ui.setCharImage(uiLastActorId, types);

        // Play sound for the first type
        if (types.length > 0) {
            const firstType = types[0];
            if (firstType && type_to_image[firstType] && window.SB_AUDIO) {
                const soundName = type_to_image[firstType];
                window.SB_AUDIO.playSound(`resource/${soundName}.mp3`);
            }
        }

        await sleep(1000); // 1秒「間」を作る
    }

    // process events sequentially to show animations (script.js の processEvent と同じタイミング)
    if (data.events && data.events.length > 0) {
        for (let e of data.events) {
            if (e.type !== "ability_changed") {
                ui.showMessage(e.message || "");
            }
            if (typeof playEventSound === 'function') {
                playEventSound(e.type, e.message);
            }

            if (e.type === "damage") {
                if (e.damage !== undefined && doubleBattleState.chars[e.target]) {
                    doubleBattleState.chars[e.target].hp = Math.max(0, doubleBattleState.chars[e.target].hp - e.damage);
                    const targetChar = doubleBattleState.chars[e.target];
                    ui.setHP(getUIId(e.target), targetChar.hp, targetChar.maxHp);
                }
                // ダメージ点滁E��フェクチE(毒ダメージの場合�E点滁E��せなぁE
                if (e.message !== "毒のダメージを受けた！") {
                    ui.playEffect(getUIId(e.target), e.type);
                }
            } else if (e.type === "cure") {
                if (e.cure_amount !== undefined && doubleBattleState.chars[e.target]) {
                    doubleBattleState.chars[e.target].hp = Math.min(doubleBattleState.chars[e.target].maxHp, doubleBattleState.chars[e.target].hp + e.cure_amount);
                    const targetChar = doubleBattleState.chars[e.target];
                    ui.setHP(getUIId(e.target), targetChar.hp, targetChar.maxHp);
                }
                ui.playEffect(getUIId(e.target), "heal");
            } else if (e.type === "stat_down") {
                // ランク値の更新 (script.jsと同じ)
                if (e.target && doubleBattleState.chars[e.target]) {
                    if (e.stat_type === "defense") {
                        doubleBattleState.chars[e.target].defense_rank = e.new_rank;
                    } else {
                        doubleBattleState.chars[e.target].attack_rank = e.new_rank;
                    }
                }
                ui.playEffect(getUIId(e.target), "stat_down");
            } else if (e.type === "stat_up") {
                // ランク値の更新 (script.jsと同じ)
                if (e.target && doubleBattleState.chars[e.target]) {
                    if (e.stat_type === "defense") {
                        doubleBattleState.chars[e.target].defense_rank = e.new_rank;
                    } else {
                        doubleBattleState.chars[e.target].attack_rank = e.new_rank;
                    }
                }
                ui.playEffect(getUIId(e.target), "stat_up");
            } else if (e.type === "drain") {
                // ダメージ適用
                if (e.damage !== undefined && doubleBattleState.chars[e.target]) {
                    doubleBattleState.chars[e.target].hp = Math.max(0, doubleBattleState.chars[e.target].hp - e.damage);
                    const targetChar = doubleBattleState.chars[e.target];
                    ui.setHP(getUIId(e.target), targetChar.hp, targetChar.maxHp);
                }
                // 回復適用
                if (e.cure_amount !== undefined && doubleBattleState.chars[e.attacker]) {
                    doubleBattleState.chars[e.attacker].hp = Math.min(doubleBattleState.chars[e.attacker].maxHp, doubleBattleState.chars[e.attacker].hp + e.cure_amount);
                    const atkChar = doubleBattleState.chars[e.attacker];
                    ui.setHP(getUIId(e.attacker), atkChar.hp, atkChar.maxHp);
                }
                ui.playEffect(getUIId(e.attacker), "heal");
            } else if (e.type === "ability_trigger") {
                if (e.poison_target && doubleBattleState.chars[e.poison_target]) {
                    doubleBattleState.chars[e.poison_target].is_poison = true;
                    ui.updatePoisonStatus(e.poison_target, true);
                }
                // ランク一括変化 (持ってぁE��場吁E
                if (e.new_ranks) {
                    for (const [charId, ranks] of Object.entries(e.new_ranks)) {
                        if (doubleBattleState.chars[charId]) {
                            doubleBattleState.chars[charId].attack_rank = ranks.attack_rank;
                            doubleBattleState.chars[charId].defense_rank = ranks.defense_rank;
                        }
                    }
                }
            } else if (e.type === "cure_poison") {
                // 毒解除
                if (e.target && doubleBattleState.chars[e.target]) {
                    doubleBattleState.chars[e.target].is_poison = false;
                    ui.updatePoisonStatus(e.target, false);
                }
            }

            const waitTime = e.type === "ability_changed" ? 100 : 1000;
            await sleep(waitTime);
        }
    }

    updateUIWithCharacters(data.characters);

    // 特性変更イベント�E場合、最新の変更を取得するためにreverseしてfindする
    const abilityChangeEvent = data.events && [...data.events].reverse().find(e => e.type === 'ability_changed');
    if (abilityChangeEvent) {
        const changedUiId = getUIId(abilityChangeEvent.char_id || "");
        const isOwnTeamChange = changedUiId === "p1a" || changedUiId === "p1b";

        if (isOwnTeamChange) {
            ui.updateAbilityInfo(getUiCharsState(), doubleBattleState.allAbilities, (charId, abilityId) => {
                sendChangeAbilityDouble(charId, abilityId);
            });

            ui.showModalMessage(abilityChangeEvent.message || 'とくせいを変更した！', 2000);
        }

        if (isOwnTeamChange && shouldPlayAbilityChangeSound(abilityChangeEvent) && typeof playSound === 'function') {
            playSound("resource/concent.mp3");
        }
    }

    // Processed one turn_result, so clear the intent flag to prevent replay.
    window.__sbExpectConcentUntil = 0;

    if (data.team1_win !== null) {
        stopBGM();
        playEventSound("end", "");
        const isMyTeamWin = (doubleBattleState.myTeam === 'team1') ? !!data.team1_win : !data.team1_win;
        if (isMyTeamWin) ui.showMessage("自分チームの勝利！");
        else ui.showMessage("相手チームの勝利！");
        ui.hideTimerContainer();
        ui.disableInput();
        ui.hideInput();
        ui.hideSubmitBtn();
        ui.showBackToTitleBtn();
        return;
    }

    // 特性変更のみの通知ではターン進行・タイマーをリセットしない
    if (onlyAbilityChanged) {
        return;
    }

    // Next turn
    handleTurnStart(data);
}

function handleTurnStart(data) {
    if (data.team1_win !== null) return;

    doubleBattleState.character = data.character;
    ui.hideMessage(); // Ensure #message is hidden

    // タイマ�Eを開姁E(対人戦のみ)
    if (!doubleBattleState.isVsCpu) {
        let remaining = null;
        if (typeof data.turn_deadline_ms === "number") {
            remaining = Math.max(0, (data.turn_deadline_ms - Date.now()) / 1000);
        } else {
            const elapsed = (Date.now() - (data._receivedAt || Date.now())) / 1000;
            remaining = Math.max(0, TURN_TIME_LIMIT - elapsed);
        }
        ui.startTimer(remaining, remaining);
    }

    // Check if it's my turn
    if (data.current_owner_id === player1_id) {
        doubleBattleState.isMyTurn = true;
        ui.setWaitMessage(`あなたのターンです (${doubleBattleState.chars[data.current_actor_id].name})`);
        ui.setInputText(`「${data.character}」からはじまることば`);

        ui.showInputArea();
        ui.enableInput();

        // Setup targeting UI
        setupTargetingUI();
    } else {
        doubleBattleState.isMyTurn = false;
        ui.hideInputArea();
        ui.hideWaitMessage();
        ui.showMessage(`待機中... (${doubleBattleState.chars[data.current_actor_id].name} のターン)`);
    }
}

function setupTargetingUI() {
    ui.setTargetSelectionVisible(true);
    // highlight selected implicitly
    $('.target-btn').removeClass('target-selected');

    // Evaluate alive state using real backing data but mapped UI keys
    const p2a_real = getRealId('p2a');
    const p2b_real = getRealId('p2b');

    let p2a_alive = doubleBattleState.chars[p2a_real] && !doubleBattleState.chars[p2a_real].is_defeated;
    let p2b_alive = doubleBattleState.chars[p2b_real] && !doubleBattleState.chars[p2b_real].is_defeated;

    if (p2a_alive && !p2b_alive) {
        selectTarget('p2a');
        $('#target-p2a-btn').prop('disabled', false).removeClass('grayed-out');
        $('#target-p2b-btn').prop('disabled', true).addClass('grayed-out');
    } else if (p2b_alive && !p2a_alive) {
        selectTarget('p2b');
        $('#target-p2a-btn').prop('disabled', true).addClass('grayed-out');
        $('#target-p2b-btn').prop('disabled', false).removeClass('grayed-out');
    } else if (p2a_alive && p2b_alive) {
        $('#target-p2a-btn').prop('disabled', false).removeClass('grayed-out');
        $('#target-p2b-btn').prop('disabled', false).removeClass('grayed-out');

        // Retain previous target if valid
        if (doubleBattleState.currentTargetId === p2a_real) selectTarget('p2a');
        else if (doubleBattleState.currentTargetId === p2b_real) selectTarget('p2b');
        else doubleBattleState.currentTargetId = null;
    }
}

function selectTarget(uiTargetId) {
    let realTargetId = getRealId(uiTargetId);
    if (!doubleBattleState.chars[realTargetId] || doubleBattleState.chars[realTargetId].is_defeated) return;

    doubleBattleState.currentTargetId = realTargetId;
    $('.target-btn').removeClass('target-selected');
    $(`#target-${uiTargetId}-btn`).addClass('target-selected');
}

// double_UI.js から呼ばれる関数
function sendDoubleSubmitWord(word) {
    if (!doubleBattleState.isMyTurn) return;
    if (!word) {
        ui.setWaitMessage("単語を入力してください", 2000);
        ui.enableInput();
        return;
    }

    const p2a_real = getRealId('p2a');
    const p2b_real = getRealId('p2b');

    const p2a_alive = doubleBattleState.chars[p2a_real] && !doubleBattleState.chars[p2a_real].is_defeated;
    const p2b_alive = doubleBattleState.chars[p2b_real] && !doubleBattleState.chars[p2b_real].is_defeated;

    if (p2a_alive && p2b_alive && !doubleBattleState.currentTargetId) {
        ui.setWaitMessage("ターゲットを選択してください", 2000);
        ui.enableInput();
        return;
    }

    // どちらかが倒れてぁE��場合、�E動的に残ってぁE��方をターゲチE��にする
    if (!doubleBattleState.currentTargetId) {
        if (p2a_alive) doubleBattleState.currentTargetId = 'p2a';
        else if (p2b_alive) doubleBattleState.currentTargetId = 'p2b';
    }

    sock.send(JSON.stringify({
        type: "submit_word_double",
        info: {
            room_id: doubleBattleState.roomId,
            player_id: player1_id,
            word: word,
            target_char_id: doubleBattleState.currentTargetId
        }
    }));
    ui.disableInput();
    ui.clearInput();
    ui.stopTimer();
}

function backToLobby() {
    if (isReturningToLobby) return;
    isReturningToLobby = true;

    if (sock) {
        sock.close();
        sock = null;
    }
    if (hasStartedDoubleBattle && typeof stopBGM === "function") {
        stopBGM();
    }
    hasStartedDoubleBattle = false;

    const moved = navigateToSingleBattle();
    if (!moved) {
        window.location.replace('index.html#single_battle.html');
    }

    // In case navigation is blocked somehow, allow retry.
    setTimeout(() => {
        isReturningToLobby = false;
    }, 1500);
}

function switchAbilityTab(charId) {
    document.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + charId).classList.add('active');
    document.querySelectorAll('.ability-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('ability-tab-' + charId).style.display = 'block';
}

function sendChangeAbilityDouble(charId, abilityId) {
    window.__sbExpectConcentUntil = Date.now() + 5000;
    if (sock && sock.readyState === WebSocket.OPEN) {
        const realCharId = getRealId(charId);
        sock.send(JSON.stringify({
            type: "change_ability_double",
            info: {
                room_id: doubleBattleState.roomId,
                char_id: realCharId,
                ability_id: abilityId
            }
        }));
    }
}

function sendIncludeCheckDouble(roomId, word) {
    if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
            type: "include_check_double",
            info: { room_id: roomId, word: word }
        }));
    }
}

function onDoublePreCheck(data) {
    if (data.include === true) {
        if (data.used === true) {
            ui.showUsedWord(data);
        } else {
            ui.showPreImg();
        }
    } else {
        ui.hidePreImg();
    }
}

function preloadImages() {
    const images = [
        "img/ground.jpg",
        "img/unaware.gif",
        "img/god.gif"
    ];
    // type_to_image.js で定義されてぁE��マッピングを利用
    if (typeof type_to_image !== 'undefined') {
        Object.values(type_to_image).forEach(filename => {
            images.push(`img/${filename}.gif`);
        });
    }
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// 画面サイズに合わせてスケーリングする関数
function adjustWindowScale() {
    const phoneBoxes = document.querySelectorAll('.phone-box');
    if (phoneBoxes.length === 0) return;

    const originalWidth = 450;
    const originalHeight = 720; // 450 * 1.6 (aspect-ratio 10/16)

    const scaleX = (window.innerWidth * 0.96) / originalWidth;
    const scaleY = (window.innerHeight * 0.96) / originalHeight;
    const scale = Math.min(scaleX, scaleY, 1.0); // 拡大はしなぁE
    phoneBoxes.forEach(box => {
        box.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    });
}
