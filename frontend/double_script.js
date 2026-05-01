// double_script.js - ダブルバトル用のスクリプト
let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
    player1_id = "player_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("sb_player_id", player1_id);
}

const TURN_TIME_LIMIT = 30;
let isProcessingTurnResult = false;
const pendingTurnResults = [];
const battleManager = new BattleManager({ mode: 'double' });

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
    if (typeof requestBGM === "function") {
        requestBGM("resource/horizon.mp3");
    }

    let isAudioUnlocked = false;
    const userInteractionHandler = () => {
        if (isAudioUnlocked) return;
        isAudioUnlocked = true;
        // audio_bridge.js経由で呼び出すことで、親フレームのオーディオマネージャーを優先利用する
        if (typeof window.unlockAudioContext === 'function') {
            window.unlockAudioContext();
        }
        if (typeof window.requestBGM === 'function') {
            window.requestBGM("resource/horizon.mp3");
        }
    };
    document.body.addEventListener("click", userInteractionHandler, { once: true });
    document.body.addEventListener("touchstart", userInteractionHandler, { once: true });

    // 画面サイズに合わせてスケーリング
    // 初期高さを固定して、キーボード表示時にFlexboxレイアウトが崩れるのを防ぐ
    initialInnerHeight = window.innerHeight;
    document.body.style.height = `${initialInnerHeight}px`;

    window.addEventListener('resize', () => {
        const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (!isInputFocused) {
            initialInnerHeight = window.innerHeight;
            document.body.style.height = `${initialInnerHeight}px`;
        }
        adjustWindowScale();
    });
    adjustWindowScale(); // 初期実行

    // スマホでキーボードを開いたときに画面がずれるのを防ぐ (ユーザー指定の実装)
    const inputElement = document.getElementById('input');
    if (inputElement) {
        inputElement.addEventListener('touchstart', (e) => {
            // ブラウザのデフォルトのスクロール＆ズーム動作をキャンセル
            e.preventDefault();
            // スクロールせずにフォーカスのみを当てる
            inputElement.focus({ preventScroll: true });
        }, { passive: false }); // preventDefaultを確実に呼ぶため
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
    
    $('#find-match-double-btn').on('click', () => {
        doubleBattleState.roomId = null;
        showDoubleBattleWaitingScreen("対戦相手を探しています...");
        connectDoubleWebSocket('match');
    });


    // ターゲット選択ボタン
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
        if (doubleBattleState.isMyTurn && doubleBattleState.currentActorUiId) {
            ui.activeCharTab = doubleBattleState.currentActorUiId;
        }
        // モーダルを生成して表示
        ui.populateAbilityModal(
            getUiCharsState(),
            doubleBattleState.allAbilities,
            (charId, abilityId) => { // 決定時
                sendChangeAbilityDouble(charId, abilityId);
            },
            () => { // 閉じる時
                ui.hideAbilityModal();
                if (typeof playSound === 'function') playSound("resource/pera.mp3");
            }
        );
        ui.showAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    ui.closeAbilityModalBtn.selector.off('click').on('click', () => {
        ui.hideAbilityModal();
        if (typeof playSound === 'function') playSound("resource/pera.mp3");
    });

    // 逃げる（降参）ボタン
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

    // 勝敗後に表示される「タイトルに戻る」ボタン
    ui.backToTitleBtn.selector.off('click').on('click', (e) => {
        e.preventDefault();
        backToLobby();
    });

    // 入力中のタイプチェック
    ui.input.selector.on("input", () => {
        const text = ui.input.selector.val();
        if (text) {
            battleManager.sendPreCheck(text);
        }
    });

    // --- ロビー用 特性選択イベント ---
    $('#double-lobby-ability-btn-1').on('click', () => openAbilityModal(1));
    $('#double-lobby-ability-btn-2').on('click', () => openAbilityModal(2));
    
    $('#close-double-lobby-ability-modal').on('click', () => {
        $('#double-lobby-ability-modal').hide();
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
        doubleBattleState.allAbilities["secret"] = {
            name: "ひみつ",
            description: "相手もきみのとくせいを知らないぞ",
            icon_type: "ノーマル"
        };
        updateDoubleLobbyAbilityDisplay(); // ロビーの表示を更新
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
        setBattleActionButtonsVisible(false);
        ui.targetSelectionUi.selector.hide();

        const name = localStorage.getItem("sb_username");
        const ability = localStorage.getItem("sb_ability");
        const ability2 = localStorage.getItem("sb_ability_2");
        if (name || ability || ability2) {
            ws.send(JSON.stringify({
                type: "update_user_info",
                info: {
                    player_id: player1_id,
                    name: name || "名無し",
                    ability: ability || "",
                    ability_2: ability2 || ""
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
        } else if (action === 'match') {
            ws.send(JSON.stringify({
                type: "find_match_double",
                info: { player_id: player1_id }
            }));
        }
    });

    ws.addEventListener("message", async function (e) {
        const data = JSON.parse(e.data);
        data._receivedAt = Date.now();

           switch (data.type) {
            case "made_room":
                doubleBattleState.roomId = data.room_id;
                doubleBattleState.myTeam = (data.p1_id === player1_id) ? "team1" : "team2";
                battleManager.initBattle(data, getUIIdMap());
                break;
            case "waiting":
                ui.showMessage(data.message || "待機中...");
                break;
            case "pre_check":
                battleManager.handlePreCheck(data);
                break;
            case "accepted":
                battleManager.processTurnResult(data);
                break;
            case "error":
                ui.showModalMessage(data.message, 3000);
                break;
            case "opponent_disconnected":
                ui.showMessage("あいてが切断しました");
                ui.showBackBtn();
                break;
        }
    });

    ws.addEventListener("close", function () {
        console.log("Double WebSocket closed");
    });
}

function selectTarget(uiTargetId) {
    let realTargetId = getRealId(uiTargetId);
    if (!doubleBattleState.chars[realTargetId] || doubleBattleState.chars[realTargetId].is_defeated) return;

    doubleBattleState.currentTargetId = realTargetId;
    $('.target-btn').removeClass('target-selected');
    $(`#target-${uiTargetId}-btn`).addClass('target-selected');
    ui.updatePredictionMessage(realTargetId);
}

// double_UI.js から呼ばれる関数
function sendDoubleSubmitWord(word) {
    if (!doubleBattleState.currentTargetId) {
        ui.showModalMessage("ターゲットを選択してください", 2000);
        return;
    }
    battleManager.submitWord(word, doubleBattleState.currentTargetId);
}

function backToLobby() {
    if (isReturningToLobby) return;
    isReturningToLobby = true;

    if (sock) {
        sock.close();
        sock = null;
    }
    hasStartedDoubleBattle = false;

    // 遷移処理
    // index.htmlの仕様上、同じページへの遷移(src変更)は無視されるため、
    // 強制的にリロードして初期状態(ロビー)に戻す
    window.location.reload();
}

function switchAbilityTab(charId) {
    document.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + charId).classList.add('active');
    document.querySelectorAll('.ability-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('ability-tab-' + charId).style.display = 'block';
}

// 状況確認モーダルの更新 (UI.js側で同期される)

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

let initialInnerHeight = window.innerHeight;

// 画面サイズに合わせてスケーリングする関数
function adjustWindowScale() {
    const phoneBoxes = document.querySelectorAll('.phone-box');
    if (phoneBoxes.length === 0) return;

    const originalWidth = 450;
    const originalHeight = 720; // 450 * 1.6 (aspect-ratio 10/16)

    // 入力中は高さを変更しない（キーボード対策）
    const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    const heightToUse = isInputFocused ? initialInnerHeight : window.innerHeight;

    const scaleX = (window.innerWidth * 0.96) / originalWidth;
    const scaleY = (heightToUse * 0.96) / originalHeight;
    const scale = Math.min(scaleX, scaleY, 1.0); // 拡大はしない
    phoneBoxes.forEach(box => {
        box.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    });
}

let currentSelectingSlot = 1;

function openAbilityModal(slot) {
    currentSelectingSlot = slot;
    renderDoubleLobbyAbilities(slot);
    const key = slot === 1 ? "sb_ability" : "sb_ability_2";
    const currentId = localStorage.getItem(key) || "";
    const info = doubleBattleState.allAbilities[currentId];
    $('#double-lobby-ability-desc').text(info ? info.description : "ランダムに決定されます");
    $('#double-lobby-ability-modal').css('display', 'flex');
    if (typeof playSound === 'function') playSound("resource/pera.mp3");
}

// --- ロビー用 特性選択ロジック ---
function updateDoubleLobbyAbilityDisplay() {
    const allAbilities = doubleBattleState.allAbilities;
    
    for (let slot = 1; slot <= 2; slot++) {
        const key = slot === 1 ? "sb_ability" : "sb_ability_2";
        const currentAbilityId = localStorage.getItem(key) || "";
        
        const nameEl = document.getElementById(`double-lobby-ability-name-${slot}`);
        const descEl = document.getElementById(`double-lobby-ability-short-desc-${slot}`);
        const iconEl = document.getElementById(`double-lobby-ability-icon-${slot}`);

        if (!nameEl) continue;

        if (iconEl) iconEl.style.display = 'block';

        if (currentAbilityId && allAbilities[currentAbilityId]) {
            const info = allAbilities[currentAbilityId];
            nameEl.textContent = info.name;
            if (descEl) descEl.textContent = info.description;
            const iconName = (typeof type_to_image !== 'undefined' && type_to_image[info.icon_type]) ? type_to_image[info.icon_type] : 'normal';
            if (iconEl) iconEl.src = `img/${iconName}.gif`;
        } else {
            nameEl.textContent = "ランダム";
            if (descEl) descEl.textContent = "ランダムに決定されます";
            if (iconEl) iconEl.src = "img/unaware.gif";
        }
    }
}

function renderDoubleLobbyAbilities(slot) {
    const listEl = document.getElementById('double-lobby-abilities-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    const key = slot === 1 ? "sb_ability" : "sb_ability_2";
    const currentAbilityId = localStorage.getItem(key) || "";
    const allAbilities = doubleBattleState.allAbilities;

    // ランダム
    const randomDiv = document.createElement('div');
    randomDiv.className = `skill-item ${currentAbilityId === "" ? "selected" : ""}`;
    randomDiv.innerHTML = `<img class="skill-icon" src="img/unaware.gif"><br><span>ランダム</span>`;
    randomDiv.addEventListener('click', () => selectDoubleLobbyAbility("", "ランダム", "ランダムに決定されます", slot));
    listEl.appendChild(randomDiv);

    for (const [id, info] of Object.entries(allAbilities)) {
        if (id === "secret") continue;
        const div = document.createElement('div');
        div.className = `skill-item ${currentAbilityId === id ? "selected" : ""}`;
        const iconName = (typeof type_to_image !== 'undefined' && type_to_image[info.icon_type]) ? type_to_image[info.icon_type] : 'normal';
        div.innerHTML = `<img class="skill-icon" src="img/${iconName}.gif"><br><span>${info.name}</span>`;
        div.addEventListener('click', () => selectDoubleLobbyAbility(id, info.name, info.description, slot));
        listEl.appendChild(div);
    }
}

function selectDoubleLobbyAbility(id, name, desc, slot) {
    const key = slot === 1 ? "sb_ability" : "sb_ability_2";
    localStorage.setItem(key, id);
    document.getElementById('double-lobby-ability-desc').textContent = desc;
    renderDoubleLobbyAbilities(slot); // 選択状態更新
    updateDoubleLobbyAbilityDisplay();
    if (typeof playSound === 'function') playSound("resource/concent.mp3");
}
