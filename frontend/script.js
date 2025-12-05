let room_id = null;
const player1_id = "your_player1_id";
const player2_id = "your_player2_id";
const cpu_id = "cpu";
let is_vs_cpu = false;
let character = "";

let ally_HP, ally_max_HP;
let ally_type1, ally_type2;
let foe_HP, foe_max_HP;

let ui = new UI();

const websock_server = "ws://localhost:8000/ws";
let sock = null;
let reconnectInterval = null;
let isDisconnected = false;

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

const processEvent = (events,is_my_turn) => {
  for (idx in events) {
    e = events[idx];
    setTimeout(() => {
      switch (e["type"]){
        case "damage":
          ui.showMessage(e["message"]);
          
          ally_HP = Math.max(0, ally_HP - e["ally_damage"]);
          foe_HP = Math.max(0, foe_HP - e["foe_damage"]);
          ui.updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP);

          setTimeout(() => {
            ui.initializeMessage();
            if(is_my_turn === false){ui.hideMessage();}
          },1500);
          break;
        
        case "cure":
          ui.showMessage(e["message"]);
          
          ally_HP = Math.min(ally_max_HP, ally_HP + e["ally_cure"]);
          foe_HP = Math.min(foe_max_HP, foe_HP + e["foe_cure"]);
          ui.updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP);
          setTimeout(() => {
            ui.initializeMessage();
            if(is_my_turn === false){ui.hideMessage();}
          },1500);
          break;
      }
    }, 1000);
  }
}

const onAllyTurnStart = (data) => {
  setTimeout(() => {
    ui.setWaitMessage("あなたのターンです。");
    ui.setInputText(`「${data["state"]["character"]}」からはじまることば`)
    character = data["state"]["character"];
    ui.enableInput();
    ui.hideMessage();
  }, 2000);
}

const onFoeTurnStart = (data) => {
  ui.setWaitMessage("相手のターンです。");
  ui.showMessage();
}

const onAllyWin = () => {
  ui.showMessage("あいてとの勝負に勝った！");
  ui.disableInput();
  ui.showBackToTitleBtn();
}

const onAllyLose = () => {
  ui.showMessage("あいてとの勝負に負けた…");
  ui.disableInput();
  ui.showBackToTitleBtn();
}

const onAccepted = (data) => {
  let delay = (data["state"]["is_cpu"] === true && 
    ((data["state"]["is_my_turn"] == false) || (data["state"]["ally_win"] === false))) ? 2000 : 0

  // ここで遅延いれないとやばい打ち合いになる
  setTimeout(() => {
    if(data["state"]["is_my_turn"]){
      ui.showAllyImage(data);
      ui.showAllyWord(data["state"]["word"]);
    } else {
      ui.showFoeImage(data);
      ui.showFoeWord(data["state"]["word"]);
    }
    
    processEvent(data["state"]["events"], data["state"]["is_my_turn"]);

    if(data["state"]["ally_win"] === true){
      onAllyWin();
    } else if(data["state"]["ally_win"] === false){
      onAllyLose();
    } else {
      if(data["state"]["is_my_turn"]){
        onFoeTurnStart(data);
      } else {
        onAllyTurnStart(data);
      }
    }
  }, delay);
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
    alert("接続が切断されました。タイトル画面に戻ります。");
    ui.showTitleScreen();
    ui.hideBackToTitleBtn();
    initializeBattleScreen();
    isDisconnected = true;
    startReconnectAttempt();
  });

  sock.addEventListener("error", function (e) {
    console.error("WebSocketエラー:", e);
    alert("エラーが発生しました。タイトル画面に戻ります。");
    ui.showTitleScreen();
    ui.hideBackToTitleBtn();
    initializeBattleScreen();
    isDisconnected = true;
    startReconnectAttempt();
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

ui.backToTitleBtn.onClick(() => {
  ui.showTitleScreen();
  ui.hideBackToTitleBtn();
  initializeBattleScreen();
});

// 再接続を試みる関数
function startReconnectAttempt() {
  if (reconnectInterval) return; // 既に試行中なら不要
  
  reconnectInterval = setInterval(() => {
    console.log("再接続を試みています...");
    try {
      const testSock = new WebSocket(websock_server);
      
      testSock.addEventListener("open", () => {
        console.log("サーバーが復帰しました。再接続します。");
        testSock.close();
        clearInterval(reconnectInterval);
        reconnectInterval = null;
        isDisconnected = false;
        connectWebSocket();
      });
      
      testSock.addEventListener("error", () => {
        //console.log("まだサーバーが利用できません...");
        testSock.close();
      });
      
      // 3秒でタイムアウト
      setTimeout(() => {
        if (testSock.readyState === WebSocket.CONNECTING) {
          testSock.close();
        }
      }, 3000);
    } catch (e) {
      console.error("再接続試行エラー:", e);
    }
  }, 1000); // 5秒ごとに試行
}

//document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();

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
//});