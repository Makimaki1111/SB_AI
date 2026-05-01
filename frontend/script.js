const TYPE_SOUND_MAP = {
  "ノーマル": "resource/normal.mp3",
  "動物": "resource/animal.mp3",
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
  "stat_down": "resource/down.mp3",
  "drain": "resource/seed_damage.mp3",
  "stat_up": "resource/up.mp3"
};

const DAMAGE_MSG_MAP = {
  "効果はばつぐんだ！": "resource/effective.mp3",
  "ふつうのダメージだ": "resource/middmg.mp3",
  "効果はいまひとつのようだ…": "resource/noneffective.mp3",
  "相手に種を植え付けた！": "resource/seeded.mp3",
  "毒のダメージを受けた！": "resource/poison.mp3",
  "毒を受けた！": "resource/poison.mp3"
};

let player1_id = localStorage.getItem("sb_player_id");
if (!player1_id) {
  player1_id = "player_" + Math.random().toString(36).substring(2, 9);
  localStorage.setItem("sb_player_id", player1_id);
}

let ui;
let battleManager;

function sbPlaySound(path) {
  if (path && typeof window.playSound === "function") window.playSound(path);
}

function playEventSound(type, message) {
  let path = EVENT_SOUND_MAP[type];
  if (DAMAGE_MSG_MAP[message]) path = DAMAGE_MSG_MAP[message];
  if (path) sbPlaySound(path);
}

function playIconSound(type) {
  let path = TYPE_SOUND_MAP[type];
  if (path) sbPlaySound(path);
}

function sbUnlockAudioContext() {
  if (typeof window.unlockAudioContext === "function") window.unlockAudioContext();
}

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

window.startBattle = function (mode, roomId = null, p1MaxLives = 3, p2MaxLives = 3) {
  sbUnlockAudioContext();
  ui.showBattleScreen();
  const type = (mode === 'cpu') ? "join_cpu_room" : (mode === 'room' ? "join_private_room" : "find_match");
  const info = { player_id: player1_id };
  if (roomId) info.room_id = roomId;
  if (mode === 'room') {
    info.p1_max_lives = p1MaxLives;
    info.p2_max_lives = p2MaxLives;
  } else {
    info.max_lives = p1MaxLives;
  }
  battleManager.connect(getWsUrl(), type, info);
}

function backToTitle() {
  if (battleManager && battleManager.sock) battleManager.sock.close();
  window.location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
  ui = new UI();
  battleManager = new BattleManager({ mode: 'single', ui: ui });
  if (typeof preloadImages === "function") preloadImages();

  ui.backToTitleBtn.onClick(() => backToTitle());
  ui.input.selector.on("keydown", (e) => {
    if (e.key === "Enter") {
      battleManager.submitWord(ui.input.selector.val());
      e.preventDefault();
    }
  });
  ui.input.selector.on("input", () => {
    const text = ui.input.selector.val();
    if (text) battleManager.sendPreCheck(text);
    else ui.hideCheckResult();
  });
  ui.submitButton.onClick(() => {
    battleManager.submitWord(ui.input.selector.val());
  });
  ui.cancelBtn.onClick(() => {
    if (confirm("本当ににげますか？")) {
      if (battleManager.sock) {
        battleManager.sock.send(JSON.stringify({
          type: "run_away",
          info: { room_id: battleManager.battleState?.room_id, player_id: player1_id }
        }));
      }
      backToTitle();
    }
  });
});
