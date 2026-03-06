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

    // 画像のプリロードを開始
    preloadImages();

    // 画面サイズに合わせてスケーリング
    window.addEventListener('resize', adjustWindowScale);
    adjustWindowScale(); // 初期実行

    // Wanakana.jsによるローマ字→ひらがな自動変換を設定
    if (typeof wanakana !== 'undefined') {
        wanakana.bind(document.getElementById('input'));
    }

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

    $('#cpu-double-battle-btn').on('click', () => {
        connectDoubleWebSocket('cpu');
    });


    // ターゲット選択ボタン
    $('#target-p2a-btn').on('click', () => selectTarget('p2a'));
    $('#target-p2b-btn').on('click', () => selectTarget('p2b'));

    // Modal Events
    ui.situationButton.selector.on('click', () => {
        ui.updateSituationInfo(doubleBattleState);
        ui.showSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeSituationModalBtn.selector.on('click', () => {
        ui.hideSituationModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.abilityInfoContainer.selector.on('click', () => {
        ui.updateAbilityInfo(doubleBattleState.chars, doubleBattleState.allAbilities, (charId, abilityId) => {
            sendChangeAbilityDouble(charId, abilityId);
        });
        ui.showAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeAbilityModalBtn.selector.on('click', () => {
        ui.hideAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    // 逃げる（降参）ボタン
    ui.cancelBtn.selector.on('click', () => {
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
            // クライアント側で即座にタイトルへ戻る処理（サーバー側の切断検知で残りの処理が行われる）
            backToLobby();
        }
    });

    // 入力中のタイプチェック (script.jsと同じ)
    ui.input.selector.on('input', () => {
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
    sock = ws; // グローバルに保持しておくが、イベント内ではローカルのwsを使う

    ws.addEventListener("open", function () {
        console.log("Double WebSocket connected");

        // 即座にボタンを表示（接続完了時）
        ui.situationButton.show();
        ui.abilityInfoContainer.show();
        ui.targetSelectionUi.selector.css('display', 'flex');

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
            if (isProcessingTurnResult) {
                // 前のターン結果を処理中の場合はキューに入れる
                pendingTurnResults.push(data);
            } else {
                isProcessingTurnResult = true;
                await handleTurnResult(data);
                isProcessingTurnResult = false;

                // キューに溜まったターン結果を順に処理する（script.jsと同じパターン）
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
    $('#double-lobby-screen').hide();
    $('#double-battle-screen').show();

    battleState = data; // store room state
    doubleBattleState.roomId = data.room_id;
    doubleBattleState.mode = data.mode;
    doubleBattleState.lastFoeWord = null; // バトル開始時にリセット

    // Determine myTeam based on owner_id
    doubleBattleState.myTeam = 'team1';
    for (let id of ['p1a', 'p1b', 'p2a', 'p2b']) {
        if (data.characters[id] && data.characters[id].owner_id === player1_id) {
            doubleBattleState.myTeam = id.startsWith('p1') ? 'team1' : 'team2';
            break;
        }
    }

    ui.resetAll();

    // resetAll()で隠れてしまうため、再表示する
    ui.situationButton.show();
    ui.abilityInfoContainer.show();
    ui.targetSelectionUi.selector.css('display', 'flex');

    updateUIWithCharacters(data.characters);

    ui.showMessage("バトルスタート！");
    // TODO: sound logic can be imported from script.js or abstracted

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
    ui.hideInputArea();

    // Show the played word if it was a valid turn
    if (data.word && data.last_actor_id) {
        const uiLastActorId = getUIId(data.last_actor_id);
        ui.setWord(uiLastActorId, data.word);

        // 相手チームの言葉を記録
        if (doubleBattleState.myTeam === 'team1' && (uiLastActorId === 'p2a' || uiLastActorId === 'p2b')) {
            doubleBattleState.lastFoeWord = data.word;
        } else if (doubleBattleState.myTeam === 'team2' && (uiLastActorId === 'p1a' || uiLastActorId === 'p1b')) {
            doubleBattleState.lastFoeWord = data.word;
        }

        let types = [];
        if (data.characters[data.last_actor_id].types && data.characters[data.last_actor_id].types.length > 0) {
            types = data.characters[data.last_actor_id].types;
        }
        ui.setCharImage(uiLastActorId, types);

        await sleep(1000); // 1秒「間」を作る
    }

    // process events sequentially to show animations (script.js の processEvent と同じタイミング)
    if (data.events && data.events.length > 0) {
        for (let e of data.events) {
            // 特性変更イベントの場合は#messageに文章を表示しない
            if (e.type !== "ability_changed") {
                ui.showMessage(e.message || "");
            }
            if (typeof playEventSound === 'function') {
                playEventSound(e.type, e.message);
            }

            // エフェクト処理（メッセージ表示直後に即実行 — script.js と同じ）
            if (e.type === "damage") {
                if (e.damage !== undefined && doubleBattleState.chars[e.target]) {
                    doubleBattleState.chars[e.target].hp = Math.max(0, doubleBattleState.chars[e.target].hp - e.damage);
                    const targetChar = doubleBattleState.chars[e.target];
                    ui.setHP(getUIId(e.target), targetChar.hp, targetChar.maxHp);
                }
                // ダメージ点滅エフェクト (毒ダメージの場合は点滅させない)
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
                // 特性発動イベント — 毒付与やランク変化を処理
                if (e.poison_target && doubleBattleState.chars[e.poison_target]) {
                    doubleBattleState.chars[e.poison_target].is_poison = true;
                    ui.updatePoisonStatus(e.poison_target, true);
                }
                // ランク一括変化 (持っている場合)
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

            // 特性変更イベントの場合は待機時間を短くする（script.js と同じ）
            const waitTime = e.type === "ability_changed" ? 100 : 1000;
            await sleep(waitTime);
        }
    }

    updateUIWithCharacters(data.characters);

    // 特性変更イベントの場合、モーダルを再描画
    const abilityChangeEvent = data.events && data.events.find(e => e.type === 'ability_changed');
    if (abilityChangeEvent) {
        // モーダル内の選択肢を再描画して、選択状態を更新
        ui.updateAbilityInfo(doubleBattleState.chars, doubleBattleState.allAbilities, (charId, abilityId) => {
            sendChangeAbilityDouble(charId, abilityId);
        });

        // 確認メッセージを表示 (script.jsと同じ)
        ui.showModalMessage(abilityChangeEvent.message || 'とくせいを変更した！', 2000);

        if (typeof playSound === 'function') playSound("resource/concent.mp3");
    }

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
        ui.setWaitMessage("単語を入力してください", 2000);
        return;
    }

    const p2a_real = getRealId('p2a');
    const p2b_real = getRealId('p2b');

    const p2a_alive = doubleBattleState.chars[p2a_real] && !doubleBattleState.chars[p2a_real].is_defeated;
    const p2b_alive = doubleBattleState.chars[p2b_real] && !doubleBattleState.chars[p2b_real].is_defeated;

    if (p2a_alive && p2b_alive && !doubleBattleState.currentTargetId) {
        ui.setWaitMessage("ターゲットを選択してください", 2000);
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
    window.location.href = 'index.html';
}

function switchAbilityTab(charId) {
    // タブの切り替え
    document.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + charId).classList.add('active');
    document.querySelectorAll('.ability-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('ability-tab-' + charId).style.display = 'block';
}

function sendChangeAbilityDouble(charId, abilityId) {
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
    // type_to_image.js で定義されているマッピングを利用
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
    // タイトル画面とバトル画面の両方の .phone-box を取得
    const phoneBoxes = document.querySelectorAll('.phone-box');
    if (phoneBoxes.length === 0) return;

    const originalWidth = 450;
    const originalHeight = 720; // 450 * 1.6 (aspect-ratio 10/16)

    const scaleX = (window.innerWidth * 0.96) / originalWidth;
    const scaleY = (window.innerHeight * 0.96) / originalHeight;
    const scale = Math.min(scaleX, scaleY, 1.0); // 拡大はしない

    phoneBoxes.forEach(box => {
        box.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    });
}
