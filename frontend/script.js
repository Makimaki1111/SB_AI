const TYPE_SOUND_MAP = {
  "ノーマル": "resource/normal.mp3",
  "動物":  "resource/animal.mp3",
  "植物": "resource/plant.mp3",
  "地名": "resource/place.mp3",
  "感情": "resource/emote.mp3",
  "芸術": "resource/art.mp3",
  "食べ物": "resource/food.mp3",
  "暴力": "resource/violence.mp3",
  "医療": "resource/health.mp3",
  "人体": "resource/body.mp3",
  "機械": "resource/mech.mp3",
  "理科": "resource/science.mp3",
  "時間": "resource/time.mp3",
  "人物": "resource/person.mp3",
  "工作": "resource/work.mp3",
  "服飾": "resource/cloth.mp3",
  "社会": "resource/society.mp3",
  "遊び": "resource/play.mp3",
  "虫": "resource/bug.mp3",
  "数学": "resource/math.mp3",
  "暴言": "resource/insult.mp3",
  "宗教": "resource/religion.mp3",
  "スポーツ": "resource/sports.mp3",
  "天気": "resource/weather.mp3",
  "物語": "resource/tale.mp3"
};

const EVENT_SOUND_MAP = {
  "cure": "resource/heal.mp3",
  "start": "resource/start.mp3",
  "end": "resource/end.mp3",
  "atk_down": "resource/down.mp3",
  "atk_up": "resource/up.mp3"
};

const DAMAGE_MSG_MAP = {
  "効果はばつぐんだ！": "resource/effective.mp3",
  "ふつうのダメージだ": "resource/middmg.mp3",
  "効果はいまひとつのようだ…": "resource/noneffective.mp3"
};

// プレイヤーIDをランダム生成して保存（対人戦で識別するため）
let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
    player1_id = "player_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("sb_player_id", player1_id);
}
const cpu_id = "cpu";
const TURN_TIME_LIMIT = 20; // 秒（バックエンドの設定と合わせる）

const battleState = {
  roomId: null,
  isVsCpu: false,
  character: "",
  ally: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0 },
  foe: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0 },
  allAbilities: {}
};

let ui;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function playSound(path){
  try {
    if (!path) return false;
    const audio = new Audio(path);
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.catch(e => console.warn('playEffectSound play failed', e));
    }
    return true;
  } catch (e) {
    console.warn('playEffectSound error', e);
    return false;
  }
}

function playEventSound(type, message){
  let path = EVENT_SOUND_MAP[type];
  if (type === "damage") {
    path = DAMAGE_MSG_MAP[message];
    if (!path) console.warn("未知のメッセージです:" + message);
  }
  if (path) playSound(path);
}

function playIconSound(type){
  console.log(type);
  let path = TYPE_SOUND_MAP[type];
  if(path !== undefined) playSound(path);
}

// --- BGM 制御 ---
let bgmAudio = null;

function startBGM(bgmPath){
  try{
    if(!bgmAudio) {
      bgmAudio = new Audio(bgmPath);
      bgmAudio.loop = true;
      bgmAudio.volume = 0.45;
    }
    const p = bgmAudio.play();
    if (p && typeof p.then === 'function') p.catch(e => console.warn('BGM play failed', e));
    return true;
  } catch(e){
    console.warn('startBGM error', e);
    return false;
  }
}

function stopBGM(){
  try{
    if(bgmAudio){
      bgmAudio.pause();
      try { bgmAudio.currentTime = 0; } catch(e){}
    }
    return true;
  } catch(e){
    console.warn('stopBGM error', e);
    return false;
  }
}

const websock_server = "ws://localhost:8000/ws";
let sock = null;
let reconnectInterval = null;
let isDisconnected = false;

// onAccepted が実行中かどうかを示すフラグ
let isProcessingAccepted = false;
// 待機中の onAccepted データキュー
let pendingAcceptedQueue = [];

const initializeBattleScreen = () => {
  ui.showMessage();
  ui.hidePreImg();
  ui.hideAllyImage();
  ui.hideFoeImage();
  ui.showAllyWord("");
  ui.showFoeWord("");
  ui.setAllyName("");
  ui.setFoeName("");
  ui.abilityInfoContainer.hide();

  ui.resetHP();
  ui.stopTimer();

  battleState.roomId = null;
  battleState.character = "";
}

const onMadeRoom = async (data) => {
  battleState.roomId = data.room_id;
  battleState.allAbilities = data.all_abilities;
  ui.enableInput();
  ui.clearInput();

  battleState.ally.hp = data["ally"]["max_hp"];
  battleState.ally.maxHp = data["ally"]["max_hp"];  
  battleState.foe.hp = data["foe"]["max_hp"];
  battleState.foe.maxHp = data["foe"]["max_hp"];

  battleState.ally.ability = data.ally.ability;
  battleState.ally.abilityChangeCount = data.ally.ability_change_count;

  ui.setAllyHP(battleState.ally.hp, battleState.ally.maxHp);
  ui.setFoeHP(battleState.foe.hp, battleState.foe.maxHp);
  ui.setAllyName(data["ally"]["name"]);
  ui.setFoeName(data["foe"]["name"]);
  if (battleState.ally && typeof battleState.ally.abilityChangeCount !== 'undefined') { // Defensive check
    ui.abilityInfoContainer.selector.css('display', 'flex');
    const currentAbilityName = battleState.allAbilities[battleState.ally.ability]?.name || battleState.ally.ability;
    const foeAbilityName = battleState.allAbilities[battleState.foe.ability]?.name || battleState.foe.ability;
    ui.updateAbilityInfo(currentAbilityName, battleState.ally.abilityChangeCount);

    // モーダル内の自分と相手の特性情報も更新
    ui.allyCurrentAbilityName.selector.text(currentAbilityName);
    ui.allyCurrentAbilityDesc.selector.text(battleState.allAbilities[battleState.ally.ability]?.description || '');
    ui.foeCurrentAbilityName.selector.text(foeAbilityName);
    ui.foeCurrentAbilityDesc.selector.text(battleState.allAbilities[battleState.foe.ability]?.description || '');
  }

  ui.showMessage("マッチングした！")
  startBGM("resource/overflow.mp3");
  await sleep(1500);
  if(data["state"]["is_my_turn"] === true){
    onAllyTurnStart(data);
  } else {
    onFoeTurnStart(data);
  }
}

const onPreCheck = (data) => {
  if (data["include"] === true) {
    if (data["used"] === true) {
      ui.showUsedWord(data);
    } else {
      ui.showPreImg();
    }
  } else {
    ui.hidePreImg();
  }
}

const processEvent = async (events, is_my_turn) => {
  if (!events || events.length === 0) return;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // 特性変更イベントの場合は#messageに文章を表示しない
    if (e["type"] !== "ability_changed") {
      ui.showMessage(e["message"] || "");
    }
    playEventSound(e["type"], e["message"]);
    if (e["type"] === "damage") {
      battleState.ally.hp = Math.max(0, battleState.ally.hp - (e["ally_damage"] || 0));
      battleState.foe.hp = Math.max(0, battleState.foe.hp - (e["foe_damage"] || 0));
      ui.updateHPs(battleState.ally.hp, battleState.ally.maxHp, battleState.foe.hp, battleState.foe.maxHp);
    } else if (e["type"] === "cure") {
      battleState.ally.hp = Math.min(battleState.ally.maxHp, battleState.ally.hp + (e["ally_cure"] || 0));
      battleState.foe.hp = Math.min(battleState.foe.maxHp, battleState.foe.hp + (e["foe_cure"] || 0));
      ui.updateHPs(battleState.ally.hp, battleState.ally.maxHp, battleState.foe.hp, battleState.foe.maxHp);
    } else if (e["type"] === "atk_down") {
      if(e["player"] === "ally") {
        battleState.ally.atk = e["new_atk"];
      }else if(e["player"] === "foe"){
        battleState.foe.atk = e["new_atk"];
      }else {
        alert("なにかがおかしいよ:" + e["player"]);
      }
    } else if (e["type"] === "atk_up") {
      if(e["player"] === "ally") {
        battleState.ally.atk = e["new_atk"];
      }else if(e["player"] === "foe"){
        battleState.foe.atk = e["new_atk"];
      }else {
        alert("なにかがおかしいよ:" + e["player"]);
      }
    }

    // 特性変更イベントの場合は待機時間を短くする
    const waitTime = e["type"] === "ability_changed" ? 100 : 1000;
    await sleep(waitTime);
  }
}

const onAllyTurnStart = (data) => {
  ui.setWaitMessage("あなたのターンです。");
  ui.setInputText(`「${data["state"]["character"]}」からはじまることば`)
  battleState.character = data["state"]["character"];
  ui.enableInput();
  ui.enableSubmitBtn();
  ui.showInput();
  ui.showSubmitBtn();
  ui.hideMessage();
  if (!battleState.isVsCpu) {
    ui.startTimer(TURN_TIME_LIMIT);
  }
}

const onFoeTurnStart = (data) => {
    ui.setWaitMessage("相手のターンです。");
    if (!battleState.isVsCpu) {
      ui.startTimer(TURN_TIME_LIMIT);
    }
    ui.showMessage();
}

const onAllyWin = () => {
  stopBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に勝った！");
  ui.disableInput();
  ui.showBackToTitleBtn();
  ui.hideCancelBtn();
  ui.stopTimer();
}

const onAllyLose = () => {
  stopBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に負けた…");
  ui.disableInput();
  ui.showBackToTitleBtn();
  ui.hideCancelBtn();
  ui.stopTimer();
}

const onOpponentDisconnected = (data) => {
  stopBGM();
  playEventSound("end", "");
  ui.hideMessage();
  ui.setWaitMessage("あいてが切断しました", 0);
  ui.disableInput();
  ui.showBackToTitleBtn();
  ui.hideCancelBtn();
  ui.stopTimer();
}

const onAccepted = async (data) => {
  // 既に処理中ならデータを待機キューに入れて戻る
  if (isProcessingAccepted) {
    pendingAcceptedQueue.push(data);
    return;
  }

  isProcessingAccepted = true;
  ui.stopTimer(); // 結果処理中はタイマーを止める

  // --- 特性変更のレスポンスか判定 ---
  const isAbilityChange = data.state.events.some(e => e.type === 'ability_changed');
  if (isAbilityChange) {
    // 特性情報を更新
    if (battleState.ally && data.state && typeof data.state.ally_ability_change_count !== 'undefined') { // Defensive check
      battleState.ally.ability = data.state.ally_ability;
      battleState.ally.abilityChangeCount = data.state.ally_ability_change_count;
      battleState.foe.ability = data.state.foe_ability;
      battleState.foe.abilityChangeCount = data.state.foe_ability_change_count;

      const currentAbilityName = battleState.allAbilities[data.state.ally_ability]?.name || data.state.ally_ability;
      const foeAbilityName = battleState.allAbilities[data.state.foe_ability]?.name || data.state.foe_ability;

      ui.updateAbilityInfo(currentAbilityName, battleState.ally.abilityChangeCount);

      // モーダル内の表示も更新
      ui.allyCurrentAbilityName.selector.text(currentAbilityName);
      ui.allyCurrentAbilityDesc.selector.text(battleState.allAbilities[data.state.ally_ability]?.description || '');
      ui.foeCurrentAbilityName.selector.text(foeAbilityName);
      ui.foeCurrentAbilityDesc.selector.text(battleState.allAbilities[data.state.foe_ability]?.description || '');
      playSound("resource/concent.mp3");
    }

    // モーダル内の選択肢を再描画して、選択状態を更新
    ui.populateAbilityModal(
      battleState.allAbilities,
      battleState.ally.ability,
      (selectedAbilityId) => {
        sendChangeAbility(selectedAbilityId);
      }
    );
    
    // 特性変更イベントの処理（メッセージ表示はprocessEvent内で制御）
    await processEvent(data.state.events, data.state.is_my_turn);

    // 処理完了
    isProcessingAccepted = false;
    return;
  }

  // --- 以下は通常の攻撃レスポンスの処理 ---
  // 通常の攻撃レスポンスの場合のみ、入力欄を隠す
  ui.hideInput();
  ui.hideSubmitBtn();

  // まず画像・単語表示はすぐ行う
  if (data["state"]["is_my_turn"]) {
    ui.showAllyImage(data);
    ui.showAllyWord(data["state"]["word"]);
    playIconSound(data.state.ally_type[0]);
  } else {
    ui.showFoeImage(data);
    ui.showFoeWord(data["state"]["word"]);
    playIconSound(data.state.foe_type[0]);
  }

  await sleep(1000);
  await processEvent(data["state"]["events"], data["state"]["is_my_turn"]);

  if (data["state"]["ally_win"] === true) {
    onAllyWin();
  } else if (data["state"]["ally_win"] === false) {
    onAllyLose();
  } else {
    if (data["state"]["is_my_turn"]) {
      onFoeTurnStart(data);
    } else {
      onAllyTurnStart(data);
    }
  }

  // 処理完了フラグをリセット
  isProcessingAccepted = false;

  // 待機キューにデータがあれば順に処理する
  if (pendingAcceptedQueue.length > 0) {
    await sleep(500);
    const next = pendingAcceptedQueue.shift();
    onAccepted(next);
  }
}

const onError = (data) => {
  ui.setWaitMessage(data.message, 2000);
}

// WebSocket接続とイベントリスナー登録
function connectWebSocket() {
  // 既に接続があれば切断
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.close();
  }
  
  sock = new WebSocket(websock_server);

  sock.addEventListener("open", function () {
    console.log("WebSocket接続が開かれました");

    // 接続が確立したらバトル開始メッセージを送信
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const roomId = urlParams.get('roomId');

    if (mode === 'player') {
      sendFindMatch(player1_id);
    } else if (mode === 'cpu') {
      sendMakeNewBattle(player1_id, cpu_id);
    } else if (mode === 'room') {
      sendJoinPrivateRoom(player1_id, roomId);
    }
  });

  sock.addEventListener("message", function (event) {
    const data = JSON.parse(event.data);
    console.log("WebSocket受信:", data);

    // ルーム作成・参加前のエラー表示
    if (data.type === "error" && !battleState.roomId) {
      alert(data.message);
      window.location.href = "index.html";
      return;
    }

    switch (data.type){
      case "made_room":
        onMadeRoom(data);
        break;
      case "waiting":
        ui.setWaitMessage(data.message);
        break;
      case "private_room_created":
        ui.showMessage(`ルームID: ${data.room_id}\n\n対戦相手を待っています...`);
        battleState.roomId = data.room_id;
        break;
      case "pre_check":
        onPreCheck(data);
        break;
      case "accepted":
        onAccepted(data);
        break;
      case "error":
        onError(data);
        return;
      case "opponent_disconnected":
        onOpponentDisconnected(data);
        break;
      default:
        console.warn("未対応のメッセージタイプ:", data.type);
        return;
    } 
  });

  sock.addEventListener("close", function () {
    console.log("WebSocket接続が閉じられました");
    isDisconnected = true;
    stopBGM();
    // ゲームが終了しておらず、意図しない切断だった場合にメッセージを表示してリダイレクト
    if (battleState.ally.hp > 0 && battleState.foe.hp > 0) {
        alert("サーバーとの接続が切れました。タイトル画面に戻ります。");
        window.location.href = "index.html";
    }
  });
  
  /*
  sock.addEventListener("error", function (e) {
    console.error("WebSocketエラー:", e);
    ui.showTitleScreen();
    ui.hideBackToTitleBtn();
    initializeBattleScreen();
    isDisconnected = true;
    alert("エラーが発生しました。タイトル画面に戻ります。");
    startReconnectAttempt();
  });
  */
}

function sendFindMatch(player_id) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "find_match",
      info: { player_id: player_id }
    }));
  }
}

function sendMakeNewBattle(p1, p2) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "make_new_battle",
      info: { player1_id: p1, player2_id: p2 }
    }));
  }
}

function sendJoinPrivateRoom(player_id, room_id) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "join_private_room",
      info: { player_id: player_id, room_id: room_id }
    }));
  }
}

function sendIncludeCheck(room_id, word) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "include_check",
      info: { room_id: room_id, word: word }
    }));
  }
}

function sendRunAway(room_id, player_id) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "run_away",
      info: { room_id: room_id, player_id: player_id }
    }));
  }
}

function sendSubmitWord(room_id, player_id, word) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "submit_word",
      info: { room_id: room_id, player_id: player_id, word: word }
    }));
  }
}

function sendChangeAbility(abilityId) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "change_ability",
      info: {
        room_id: battleState.roomId,
        player_id: player1_id,
        ability_id: abilityId
      }
    }));
  }
}

function startReconnectAttempt() {
  // 再接続を試みる関数
  if (reconnectInterval) return;
  
  reconnectInterval = setInterval(() => {
    console.log("再接続を試みています...");
    try {
      const testSock = new WebSocket(websock_server);
      let isConnected = false;
      
      testSock.addEventListener("open", () => {
        console.log("サーバーが復帰しました。再接続します。");
        isConnected = true;
        testSock.close();
        clearInterval(reconnectInterval);
        reconnectInterval = null;
        isDisconnected = false;
        connectWebSocket();
      });
      
      testSock.addEventListener("error", () => {
        console.log("まだサーバーが利用できません...");
        if (!isConnected) {
          testSock.close();
        }
      });
      
      // 0.8秒でタイムアウト
      setTimeout(() => {
        if (!isConnected && testSock.readyState !== WebSocket.CLOSED) {
          testSock.close();
        }
      }, 300);
    } catch (e) {
      console.error("再接続試行エラー:", e);
    }
  }, 5000); // 1秒ごとに試行
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

document.addEventListener("DOMContentLoaded", () => {
  // DOMの準備ができた後にUIインスタンスを生成
  ui = new UI();

  // URLから対戦モードを取得して battleState を設定
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  if (mode === 'player' || mode === 'room') {
    battleState.isVsCpu = false;
  } else if (mode === 'cpu') {
    battleState.isVsCpu = true;
  } else {
    alert("対戦モードが指定されていません。タイトルに戻ります。");
    // index.htmlのパスは環境に合わせて調整してください
    window.location.href = "index.html";
    return;
  }

  // 画面を初期化
  initializeBattleScreen();
  
  // WebSocket接続を開始 (この中でバトル開始メッセージが送られる)
  connectWebSocket();

  // 画像のプリロードを開始
  preloadImages();

  // BGM ボタン初期化: 同じ id が複数ある場合もあるので querySelectorAll で全てにバインド
  try {
    updateBGMButtons();
    const bgmNodes = document.querySelectorAll('#bgm-toggle-btn');
    bgmNodes.forEach(n => {
        n.addEventListener('click', (e) => {
            e.preventDefault();
            toggleBGM();
        });
    });
  } catch (e) {
    console.warn('BGM init failed', e);
  }

  // エンターで送信
  ui.input.selector.on("keydown", (e) => {
    if (e.key === "Enter") {
      ui.ClickSubmitBtn();
      e.preventDefault();
    }
  });

  // 入力欄の変化で単語チェック
  ui.input.selector.on("input", () => {
    if(!battleState.roomId){
      ui.hidePreImg();
      return;
    }

    const text = ui.input.selector.val();
    if(text) {
      if(text.charAt(0) !== battleState.character){
        ui.alertWrongChar();
      } else if(text.charAt(text.length - 1) === "ん") {
        ui.alertNN();
      } else {
        sendIncludeCheck(battleState.roomId, text);
      }
    } else {
      ui.hidePreImg();
    }
  });

  // 送信ボタン
  ui.submitButton.onClick(() => {
    const text = ui.input.selector.val();
    if (!text.trim() || !battleState.roomId) return;
    ui.clearInput();
    ui.hidePreImg();
    sendSubmitWord(battleState.roomId, player1_id, text);
  });

  // にげるボタン
  ui.cancelBtn.onClick(() => {
    if (confirm("本当ににげますか？")) {
      sendRunAway(battleState.roomId, player1_id);
      window.location.href = "index.html";
    }
  });

  // --- 特性変更モーダルのイベントリスナー ---
  ui.abilityInfoContainer.onClick(() => {
    // モーダルの中身を生成して表示する
    ui.populateAbilityModal(
      battleState.allAbilities,
      battleState.ally.ability,
      (selectedAbilityId) => {
        sendChangeAbility(selectedAbilityId);
      }
    );

    ui.showAbilityModal();
    playSound("resource/pera.mp3");
  });

  ui.closeAbilityModalBtn.onClick(() => {
    ui.hideAbilityModal();
    playSound("resource/pera.mp3");
  });
});