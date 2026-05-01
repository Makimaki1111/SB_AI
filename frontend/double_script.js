// double_script.js - ダブルバトル用のエントリーポイント
let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
    player1_id = "player_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("sb_player_id", player1_id);
}

const battleManager = new BattleManager({ mode: 'double' });
let ui;

function getWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let host = window.location.host;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    if (window.location.port !== "8000") host = "localhost:8000";
  } else if (!host || window.location.protocol === 'file:') {
    host = "localhost:8000";
  }
  return `${protocol}//${host}/ws`;
}

window.startDoubleBattle = function(mode, roomId = null) {
    if (typeof sbUnlockAudioContext === "function") sbUnlockAudioContext();
    
    ui.showBattleScreen();
    ui.showMessage("マッチング中...");
    
    const type = (mode === 'cpu') ? "join_double_cpu_room" : "find_double_match";
    const info = { player_id: player1_id };
    if (roomId) info.room_id = roomId;
    
    battleManager.connect(getWsUrl(), type, info);
}

function backToLobby() {
    if (battleManager.sock) battleManager.sock.close();
    window.location.reload();
}

$(() => {
    ui = new DoubleUI();
    battleManager.ui = ui;
    window.__sbSuppressConcentWithoutIntent = true;

    // イベント紐付け
    ui.backToTitleBtn.onClick(() => backToLobby());

    ui.input.selector.on("keydown", (e) => {
        if (e.key === "Enter") {
            const word = ui.input.selector.val();
            battleManager.submitWord(word, ui.currentTargetId);
            e.preventDefault();
        }
    });

    ui.input.selector.on("input", () => {
        const text = ui.input.selector.val();
        if (text) battleManager.sendPreCheck(text);
        else ui.hideCheckResult();
    });

    ui.submitButton.onClick(() => {
        const word = ui.input.selector.val();
        battleManager.submitWord(word, ui.currentTargetId);
    });

    ui.onTargetSelect = (targetId) => {
        ui.currentTargetId = targetId;
    };
});
