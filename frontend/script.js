let room_id = null;
let player1_id = "your_player1_id";
let player2_id = "your_player2_id";
let cpu_id = "cpu";
let is_vs_cpu = false;

let ally_HP, ally_max_HP;
let ally_type1, ally_type2;
let foe_HP, foe_max_HP;

let ui = new UI();

const websock_server = "ws://localhost:8000/ws";
let sock = null;

const onMadeRoom = (data) => {
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

const processEvent = (events) => {
  for (idx in events) {
    e = events[idx];
    ui.showMessage(e["message"]);
    
    ally_HP = Math.max(0, ally_HP - e["ally_damage"]);
    foe_HP = Math.max(0, foe_HP - e["foe_damage"]);
    if(e["type"] === "damage"){
      ui.updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP);
      setTimeout(() => {}, 2000);
    }
  }
}

const onAllyTurnStart = (data) => {
  ui.setWaitMessage("あなたのターンです。");
  ui.setInputText(`「${data["state"]["character"]}」からはじまることば`)
  ui.enableInput();
  ui.hideMessage();
}

const onFoeTurnStart = (data) => {
  ui.setWaitMessage("相手のターンです。");
  ui.disableInput();
  ui.showMessage();
}

const onAccepted = (data) => {
  if(data["state"]["is_my_turn"]){
    ui.showAllyImage(data);
    ui.showAllyWord(data["state"]["word"]);
  } else {
    ui.showFoeImage(data);
    ui.showFoeWord(data["state"]["word"]);
  }
  
  processEvent(data["state"]["events"]);

  if(data["state"]["ally_win"] === true){
    ui.showMessage("あなたの勝ちです！");
    ui.disableInput();
  } else if(data["state"]["ally_win"] === false){
    ui.showMessage("あなたの負けです！");
    ui.disableInput();
  } else {
    if(data["state"]["is_my_turn"]){
      onFoeTurnStart(data);
    } else {
      onAllyTurnStart(data);
    }
  }
}

const onError = (data) => {
  ui.setWaitMessage(data.message, 2000);
}

// WebSocket接続とイベントリスナー登録
function connectWebSocket() {
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
  });

  sock.addEventListener("error", function (e) {
    console.error("WebSocketエラー:", e);
  });
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

document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();

  // ボタンイベント
  ui.vsPlayerBtn.onClick(() => {
    is_vs_cpu = false;
    ui.showBattleScreen();
    sendMakeNewBattle(player1_id, player2_id);
  });

  ui.vsCpuBtn.onClick(() => {
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
    const text = ui.input.selector.val();
    if (!text.trim() || !room_id) {
      ui.hidePreImg();
      return;
    }
    sendIncludeCheck(room_id, text);
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