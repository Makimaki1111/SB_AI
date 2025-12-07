let room_id = null;
const player1_id = "your_player1_id";
const player2_id = "your_player2_id";
const cpu_id = "cpu";
let is_vs_cpu = false;
let character = "";

let ally_HP, ally_max_HP;
let ally_type1, ally_type2;
let ally_atk, ally_def;

let foe_HP, foe_max_HP;
let foe_atk, foe_def;

let ui = new UI();

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
  let path;
  if(type === "damage"){
    if(message === "効果はばつぐんだ！"){
      path = "resource/effective.mp3";
    }else if(message === "ふつうのダメージだ"){
      path = "resource/middmg.mp3";
    }else if(message === "効果はいまひとつのようだ…"){
      path = "resource/noneffective.mp3";
    }else{
      console.warn("未知のメッセージです:" + message);
    }
  }else if(type === "cure"){
    path = "resource/heal.mp3";
  }else if(type === "start"){
    path = "resource/start.mp3";
  }else if(type === "end"){
    path = "resource/end.mp3";
  }else if(type === "atk_down"){
    path = "resource/down.mp3";
  }

  playSound(path);
}

function playIconSound(type){
  console.log(type);
  let map = {
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

  let path = map[type];
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

  ui.setAllyHP(1, 1);
  ui.setFoeHP(1, 1);

  room_id = null;
  is_vs_cpu = false;
  character = "";
}

const onMadeRoom = async (data) => {
  room_id = data.room_id;
  ui.enableInput();
  ui.clearInput();

  ally_HP = data["ally"]["max_hp"];
  ally_max_HP = data["ally"]["max_hp"];  
  foe_HP = data["foe"]["max_hp"];
  foe_max_HP = data["foe"]["max_hp"];

  ui.setAllyHP(ally_HP, ally_max_HP);
  ui.setFoeHP(foe_HP, foe_max_HP);
  ui.setAllyName(data["ally"]["name"]);
  ui.setFoeName(data["foe"]["name"]);
  
  playEventSound("start", "");
  startBGM("resource/overflow.mp3");

  ui.showMessage("マッチングした！")
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

    ui.showMessage(e["message"] || "");
    playEventSound(e["type"], e["message"]);
    if (e["type"] === "damage") {
      ally_HP = Math.max(0, ally_HP - (e["ally_damage"] || 0));
      foe_HP = Math.max(0, foe_HP - (e["foe_damage"] || 0));
      ui.updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP);
    } else if (e["type"] === "cure") {
      ally_HP = Math.min(ally_max_HP, ally_HP + (e["ally_cure"] || 0));
      foe_HP = Math.min(foe_max_HP, foe_HP + (e["foe_cure"] || 0));
      ui.updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP);
    } else if (e["type"] === "atk_down") {
      if(e["player"] === "ally") {
        ally_atk = e["new_atk"];
      }else if(e["player"] === "foe"){
        foe_atk = e["new_atk"];
      }else {
        alert("なにかがおかしいよ" + e["player"]);
      }
    }

    await sleep(1000);
  }
}

const onAllyTurnStart = (data) => {
  ui.setWaitMessage("あなたのターンです。");
  ui.setInputText(`「${data["state"]["character"]}」からはじまることば`)
  character = data["state"]["character"];
  ui.enableInput();
  ui.enableSubmitBtn();
  ui.showInput();
  ui.showSubmitBtn();
  ui.hideMessage();
}

const onFoeTurnStart = (data) => {
    ui.setWaitMessage("相手のターンです。");
}

const onAllyWin = () => {
  stopBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に勝った！");
  ui.disableInput();
  ui.showBackToTitleBtn();
}

const onAllyLose = () => {
  stopBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に負けた…");
  ui.disableInput();
  ui.showBackToTitleBtn();
}

const onAccepted = async (data) => {
  // 既に処理中ならデータを待機キューに入れて戻る
  if (isProcessingAccepted) {
    pendingAcceptedQueue.push(data);
    return;
  }

  isProcessingAccepted = true;
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
  });

  sock.addEventListener("message", function (event) {
    const data = JSON.parse(event.data);
    console.log("WebSocket受信:", data);

    switch (data.type){
      case "made_room":
        onMadeRoom(data);
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
      default:
        console.warn("未対応のメッセージタイプ:", data.type);
        return;
    } 
  });

  sock.addEventListener("close", function () {
    console.log("WebSocket接続が閉じられました");
    ui.showTitleScreen();
    ui.hideBackToTitleBtn();
    initializeBattleScreen();
    isDisconnected = true;
    alert("接続が切断されました。タイトル画面に戻ります。");
    startReconnectAttempt();
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

function sendMakeNewBattle(p1, p2) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "make_new_battle",
      info: { player1_id: p1, player2_id: p2 }
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

function sendSubmitWord(room_id, player_id, word) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "submit_word",
      info: { room_id: room_id, player_id: player_id, word: word }
    }));
  }
}

ui.backToTitleBtn.onClick(() => {
  ui.showTitleScreen();
  ui.hideBackToTitleBtn();
  initializeBattleScreen();
});

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
      }, 800);
    } catch (e) {
      console.error("再接続試行エラー:", e);
    }
  }, 1000); // 1秒ごとに試行
}

document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();

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

    // 設定が有効なら再生を試みる（ブラウザが自動再生をブロックする場合がある）
    if (bgmEnabled) {
      // ユーザー操作がないと再生がブロックされることがあるため、ここで試してみる
      startBGM();
    }
  } catch (e) {
    console.warn('BGM init failed', e);
  }

  // ボタンイベント
  ui.vsPlayerBtn.onClick(() => {
    initializeBattleScreen();
    is_vs_cpu = false;
    ui.showBattleScreen();
    sendMakeNewBattle(player1_id, player2_id);
  });

  ui.vsCpuBtn.onClick(() => {
    initializeBattleScreen();
    is_vs_cpu = true;
    ui.showBattleScreen();
    sendMakeNewBattle(player1_id, cpu_id);
  });

  // エンターで送信
  ui.input.selector.on("keydown", (e) => {
    if (e.key === "Enter") {
      ui.ClickSubmitBtn();
      e.preventDefault();
    }
  });

  // 入力欄の変化で単語チェック
  ui.input.selector.on("input", () => {
    if(!room_id){
      ui.hidePreImg();
      return;
    }

    const text = ui.input.selector.val();
    if(text) {
      if(text.charAt(0) !== character){
        ui.alertWrongChar();
      } else if(text.charAt(text.length - 1) === "ん") {
        ui.alertNN();
      } else {
        sendIncludeCheck(room_id, text);
      }
    } else {
      ui.hidePreImg();
    }
  });

  // 送信ボタン
  ui.submitButton.onClick(() => {
    const text = ui.input.selector.val();
    if (!text.trim() || !room_id) return;
    ui.clearInput();
    ui.hidePreImg();
    sendSubmitWord(room_id, player1_id, text);
  });
});