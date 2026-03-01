// double_script.js - ダブルバトル用のスクリプト
let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
    player1_id = "player_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("sb_player_id", player1_id);
}

const TURN_TIME_LIMIT = 20;

const doubleBattleState = {
    roomId: null,
    mode: null, // '1v1_double', '2v2_double'
    character: "",
    // P1A, P1B, P2A, P2B のステータスを保持
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

let ui;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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

// ロビーUI初期設定
$(() => {
    // UI初期化
    ui = new DoubleUI();

    $('#create-double-room-btn').on('click', () => {
        const mode = $('input[name="double_mode"]:checked').val();
        connectDoubleWebSocket('create', mode);
    });

    $('#join-double-room-btn').on('click', () => {
        const roomId = $('#double-room-id-input').val();
        if (!roomId) {
            alert("ルームIDを入力してください");
            return;
        }
        connectDoubleWebSocket('join', null, roomId);
    });

    $('#double-cancel-battle-btn').on('click', () => {
        // ダブルバトルでの「にげる」処理
        backToLobby();
    });

    // ターゲット選択ボタン
    $('#target-p2a-btn').on('click', () => selectTarget('p2a'));
    $('#target-p2b-btn').on('click', () => selectTarget('p2b'));

    // Modal Events
    ui.situationButton.selector.on('click', () => {
        ui.updateSituationInfo(doubleBattleState.chars);
        ui.showSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeSituationModalBtn.selector.on('click', () => {
        ui.hideSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.abilityInfoContainer.selector.on('click', () => {
        ui.updateAbilityInfo(doubleBattleState.chars, doubleBattleState.allAbilities);
        ui.showAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeAbilityModalBtn.selector.on('click', () => {
        ui.hideAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
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
    sock = ws; // グローバルに保持しておくが、イベント内ではローカルのwsを使う

    ws.addEventListener("open", function () {
        console.log("Double WebSocket connected");

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
        }
    });

    ws.addEventListener("message", async function (e) {
        const data = JSON.parse(e.data);
        console.log("Double WS received:", data);

        if (data.type === "double_room_created") {
            $('#double-room-id-input').val(data.room_id);
            $('#lobby-message').text(`ルームを作成しました: ID ${data.room_id} (待機中...)`);
            $('#create-double-room-btn').hide();
        } else if (data.type === "waiting_for_players") {
            $('#lobby-message').text(`待機中... (${data.current}/${data.required} 人)`);
        } else if (data.type === "init_double_battle") {
            await initDoubleBattle(data);
        } else if (data.type === "turn_result") {
            await handleTurnResult(data);
        } else if (data.type === "error") {
            // エラー表示をUIに反映
            ui.setWaitMessage(data.message);
        }
    });

    ws.addEventListener("close", function () {
        console.log("Double WebSocket closed");
    });
}

async function initDoubleBattle(data) {
    $('#double-lobby-screen').hide();
    $('#double-battle-screen').show();

    battleState = data; // store room state
    doubleBattleState.roomId = data.room_id;
    doubleBattleState.mode = data.mode;

    // Determine myTeam based on owner_id
    doubleBattleState.myTeam = 'team1';
    for (let id of ['p1a', 'p1b', 'p2a', 'p2b']) {
        if (data.characters[id] && data.characters[id].owner_id === player1_id) {
            doubleBattleState.myTeam = id.startsWith('p1') ? 'team1' : 'team2';
            break;
        }
    }

    ui.resetAll();
    updateUIWithCharacters(data.characters);

    ui.showMessage("バトルスタート！");
    // TODO: sound logic can be imported from script.js or abstracted

    // Ensure all characters are visible initially
    $('.char-wrapper').show();

    await sleep(1500);
    ui.hideMessage();

    // Show buttons
    ui.situationButton.selector.css('display', 'flex');
    ui.abilityInfoContainer.selector.css('display', 'flex');

    handleTurnStart(data);
}

function updateUIWithCharacters(chars) {
    const ids = ['p1a', 'p1b', 'p2a', 'p2b'];
    for (let id of ids) {
        if (chars[id]) {
            doubleBattleState.chars[id] = chars[id];

            const uiId = getUIId(id);
            ui.setName(uiId, chars[id].name);
            ui.setHP(uiId, chars[id].hp, chars[id].maxHp);
            if (chars[id].is_defeated) {
                ui.setCharVisibility(uiId, false);
            }
        }
    }
}

async function handleTurnResult(data) {
    ui.hideInputArea();

    // Show the played word if it was a valid turn
    if (data.word && data.last_actor_id) {
        const uiLastActorId = getUIId(data.last_actor_id);
        ui.setWord(uiLastActorId, data.word);

        let charType = "ノーマル";
        if (data.characters[data.last_actor_id].types && data.characters[data.last_actor_id].types.length > 0) {
            charType = data.characters[data.last_actor_id].types[0];
        }
        ui.setCharImage(uiLastActorId, charType);

        await sleep(1000); // 1秒「間」を作る
    }

    // process events sequentially to show animations
    if (data.events && data.events.length > 0) {
        for (let e of data.events) {
            ui.showMessage(e.message);
            await sleep(1000); // メッセージを読ませる間

            if (e.type === "damage") {
                ui.playEffect(getUIId(e.target), e.type);
                // 攻撃アニメーション（少し揺れるなど）
                if (e.attacker) {
                    $(`#char-${getUIId(e.attacker)}-wrapper img`).animate({ marginLeft: "10px" }, 100).animate({ marginLeft: "0px" }, 100);
                }
            } else if (e.type === "cure") {
                ui.playEffect(getUIId(e.target), "heal");
            } else if (e.type === "stat_down") {
                ui.playEffect(getUIId(e.target), "stat_down");
            }
            if (e.type !== "text") {
                await sleep(1000); // エフェクト用の間
            }
        }
    }

    updateUIWithCharacters(data.characters);

    if (data.team1_win !== null) {
        if (data.team1_win) {
            ui.showMessage("自分チーム(左下)の勝利！");
        } else {
            ui.showMessage("相手チーム(右上)の勝利！");
        }
        ui.showBackBtn();
        return;
    }

    // Next turn
    handleTurnStart(data);
}

function handleTurnStart(data) {
    if (data.team1_win !== null) return;

    doubleBattleState.character = data.character;
    ui.hideMessage(); // Ensure #message is hidden

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
        ui.setWaitMessage("単語を入力してください");
        return;
    }

    const p2a_real = getRealId('p2a');
    const p2b_real = getRealId('p2b');

    const p2a_alive = doubleBattleState.chars[p2a_real] && !doubleBattleState.chars[p2a_real].is_defeated;
    const p2b_alive = doubleBattleState.chars[p2b_real] && !doubleBattleState.chars[p2b_real].is_defeated;

    if (p2a_alive && p2b_alive && !doubleBattleState.currentTargetId) {
        ui.setWaitMessage("ターゲットを選択してください");
        return;
    }

    // どちらかが倒れていた場合、自動的に残っている方をターゲットにする
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
}

function backToLobby() {
    if (sock) {
        sock.close();
        sock = null;
    }
    $('#double-battle-screen').hide();
    $('#double-lobby-screen').show();
    $('#lobby-message').text('');
    $('#double-room-id-input').val('');
    $('#create-double-room-btn').show();
}
