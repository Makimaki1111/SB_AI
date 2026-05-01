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
  mode: null, // 'player', 'cpu', 'room'
  character: "",
  ally: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0, is_poison: false, lives: 0 },
  foe: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0, is_poison: false, lives: 0 },
  allyMaxLives: 1,
  foeMaxLives: 1,
  allAbilities: {}
};

let ui;
const battleManager = new BattleManager({ mode: 'single' });

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- Audio Bridge Helpers ---
function sbPreloadSounds() {
  if (typeof window.preloadSounds !== "function") return Promise.resolve();
  const paths = new Set();
  Object.values(TYPE_SOUND_MAP).forEach(p => paths.add(p));
  Object.values(EVENT_SOUND_MAP).forEach(p => paths.add(p));
  Object.values(DAMAGE_MSG_MAP).forEach(p => paths.add(p));
  paths.add("resource/horizon.mp3");
  paths.add("resource/overflow.mp3");
  paths.add("resource/concent.mp3");
  paths.add("resource/pera.mp3");
  return window.preloadSounds(Array.from(paths));
}

function sbPlaySound(path) {
  if (!path || typeof window.playSound !== "function") return false;
  return window.playSound(path);
}

function playEventSound(type, message) {
  let path = EVENT_SOUND_MAP[type];
  if (DAMAGE_MSG_MAP[message]) {
    path = DAMAGE_MSG_MAP[message];
  } else if (type === "damage") {
    console.warn("未知のメッセージです:" + message);
  }
  if (path) sbPlaySound(path);
}

function playIconSound(type) {
  // console.log(type);
  let path = TYPE_SOUND_MAP[type];
  if (path !== undefined) sbPlaySound(path);
}

function startManagedBGM(path) {
  if (typeof window.requestBGM === "function") return window.requestBGM(path);
  if (typeof window.startBGM === "function") return window.startBGM(path);
  return false;
}

function stopManagedBGM() {
  if (typeof window.stopBGM === "function") return window.stopBGM();
  return false;
}

// モバイルブラウザの自動再生制限対策：ユーザー操作時に音声を一瞬再生してアンロックする
function sbUnlockAudioContext() {
  if (typeof window.unlockAudioContext === "function") return window.unlockAudioContext();
  return false;
}

// 現在のURLに基づいてWebSocketの接続先を決定する
let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
let host = window.location.host;

// ローカル開発環境の判定 (localhost または 127.0.0.1)
// フロントエンドとバックエンドのポートが異なる場合 (例: Live Server 5500 -> Backend 8000) への対応
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  if (window.location.port !== "8000") {
    host = "localhost:8000";
  }
} else if (!host || window.location.protocol === 'file:') {
  // ファイルとして開いている場合など
  host = "localhost:8000";
  protocol = "ws:";
}
const websock_server = `${protocol}//${host}/ws`;

let sock = null;
let isManualClose = false;

// これらの古いイベントハンドラは BattleManager が処理するため、
// 必要なヘルパー関数以外は削除または BattleManager への委譲に置き換えます。

const onError = (data) => {
  ui.setWaitMessage(data.message, 2000);
}

// WebSocket接続とイベントリスナー登録
window.startBattle = function (mode, roomId = null, p1MaxLives = 3, p2MaxLives = 3) {
  // iOS対策: バトル開始のクリックイベント内で確実にAudioContextをアンロックする
  sbUnlockAudioContext();

  battleState.mode = mode;
  battleState.p1MaxLives = p1MaxLives;
  battleState.p2MaxLives = p2MaxLives;
  if (mode === 'player' || mode === 'room') {
    battleState.isVsCpu = false;
  } else if (mode === 'cpu') {
    battleState.isVsCpu = true;
  }

  initializeBattleScreen();
  connectWebSocket(mode, roomId, p1MaxLives, p2MaxLives);
}

function connectWebSocket(mode, roomId, p1MaxLives = 3, p2MaxLives = 3) {
  isManualClose = false; // 新しい接続を開始する時にフラグをリセット
  // 既に接続があれば切断
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.close();
  }

  sock = new WebSocket(websock_server);

  sock.addEventListener("open", function () {
    console.log("WebSocket接続が開かれました");

    // ユーザー情報を送信
    const name = localStorage.getItem("sb_username");
    const ability = localStorage.getItem("sb_ability");
    if (name || ability) {
      sock.send(JSON.stringify({
        type: "update_user_info",
        info: {
          player_id: player1_id,
          name: name || "名無し",
          ability: ability || ""
        }
      }));
    }

    if (mode === 'player') {
      sendFindMatch(player1_id, p1MaxLives); // プレイヤーマッチングは共通の残機を期待
    } else if (mode === 'cpu') {
      sendMakeNewBattle(player1_id, cpu_id, p1MaxLives, p2MaxLives);
    } else if (mode === 'room') {
      if (roomId) {
        sendJoinPrivateRoom(player1_id, roomId, p1MaxLives, p2MaxLives);
      } else {
        // バックエンドが create_private_room に対応していない可能性があるため、
        // 以前の仕様に合わせて join_private_room に空のIDを送ることで作成リクエストとする
        sendJoinPrivateRoom(player1_id, "", p1MaxLives, p2MaxLives);
      }
    }
  });

  sock.addEventListener("message", function (event) {
    const data = JSON.parse(event.data);
    data._receivedAt = Date.now(); // 受信時刻を記録して遅延補正に利用
    // console.log("WebSocket受信:", data);

    // ルーム作成・参加前のエラー表示
    if (data.type === "error" && !battleState.roomId) {
      alert(data.message);
      backToTitle();
      return;
    }

    switch (data.type) {
      case "made_room":
        battleManager.initBattle(data, { p1: "ally", p2: "foe" });
        break;
      case "waiting":
        ui.showMessage(data.message);
        break;
      case "private_room_created":
        ui.showMessage(`ルームID: ${data.room_id}\n\n対戦相手を待っています...`);
        battleState.roomId = data.room_id;
        break;
      case "pre_check":
        battleManager.handlePreCheck(data);
        break;
      case "accepted":
        battleManager.processTurnResult(data);
        break;
      case "error":
        ui.setWaitMessage(data.message, 2000);
        return;
      case "opponent_disconnected":
        ui.showMessage("相手が切断しました。");
        ui.showBackToTitleBtn();
        break;
      default:
        console.warn("未対応のメッセージタイプ:", data.type);
        return;
    }
  });

  sock.addEventListener("close", function () {
    console.log("WebSocket接続が閉じられました");
    isDisconnected = true;

    // 意図的な切断でない場合のみBGMを停止
    if (!isManualClose) stopManagedBGM();

    // ゲームが終了しておらず、意図しない切断だった場合にメッセージを表示してリダイレクト
    if (!isManualClose && battleState.ally.hp > 0 && battleState.foe.hp > 0) {
      // alert("サーバーとの接続が切れました。タイトル画面に戻ります。");
      backToTitle();
    }
    // isManualClose = false; // ここでのリセットを削除（タイトル画面滞在中に遅れてイベントが来てもBGMを止めないため）
  });
}

function sendFindMatch(player_id, maxLives = 1) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "find_match",
      info: { player_id: player_id, max_lives: maxLives }
    }));
  }
}

function sendMakeNewBattle(p1, p2, p1MaxLives = 1, p2MaxLives = 1) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "make_new_battle",
      info: { player1_id: p1, player2_id: p2, p1_max_lives: p1MaxLives, p2_max_lives: p2MaxLives }
    }));
  }
}

function sendJoinPrivateRoom(player_id, room_id, p1MaxLives = 1, p2MaxLives = 1) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({
      type: "join_private_room",
      info: { player_id: player_id, room_id: room_id, p1_max_lives: p1MaxLives, p2_max_lives: p2MaxLives }
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
  battleManager.sendChangeAbility(abilityId);
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

let initialInnerHeight = window.innerHeight;

// 画面サイズに合わせてスケーリングする関数
function adjustWindowScale() {
  // タイトル画面とバトル画面の両方の .phone-box を取得
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

document.addEventListener("DOMContentLoaded", () => {
  // DOMの準備ができた後にUIインスタンスを生成
  ui = new UI();
  battleManager.ui = ui;

  // 初期状態はタイトル画面を表示
  ui.showTitleScreen();

  // 画像のプリロードを開始
  preloadImages();

  // 音声のプリロードを開始
  sbPreloadSounds();

  // 待機中BGM再生
  startManagedBGM("resource/horizon.mp3");
  ui.backToTitleBtn.onClick(() => {
    backToTitle();
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
    if (!battleState.roomId) {
      ui.hideCheckResult();
      return;
    }

    const text = ui.input.selector.val();
    if (text) {
      battleManager.sendPreCheck(text);
    }
 else {
      ui.hideCheckResult();
    }
  });

  // 送信ボタン
  ui.submitButton.onClick(() => {
    const word = ui.input.selector.val();
    battleManager.submitWord(word);
  });

  // にげるボタン
  ui.cancelBtn.onClick(() => {
    if (confirm("本当ににげますか？")) {
      // iOS対策: ダイアログを閉じた後にAudioContextの再開を試みる
      sbUnlockAudioContext();
      sendRunAway(battleState.roomId, player1_id);
      backToTitle();
    }
  });

  // --- 特性変更モーダルのイベントリスナー ---
  ui.abilityInfoContainer.onClick(() => {
    // モーダルの中身を生成して表示する
    ui.populateAbilityModal(
      battleState.allAbilities,
      battleState.ally.ability,
      battleState.ally.abilityChangeCount > 0,
      (selectedAbilityId) => {
        sendChangeAbility(selectedAbilityId); // 決定時の処理
      },
      () => {
        ui.hideAbilityModal(); // 閉じる時の処理
        sbPlaySound("resource/pera.mp3");
      }
    );

    ui.showAbilityModal();
    sbPlaySound("resource/pera.mp3");
  });

  // --- 状況確認モーダルのイベントリスナー ---
  ui.situationButton.onClick(() => {
    ui.updateSituation(
      battleState.ally.atk, battleState.ally.def,
      battleState.foe.atk, battleState.foe.def,
      battleState.ally.lives, battleState.foe.lives,
      battleState.allyMaxLives, battleState.foeMaxLives
    );
    ui.showSituationModal();
    sbPlaySound("resource/pera.mp3");
  });

  ui.closeSituationModalBtn.onClick(() => {
    ui.hideSituationModal();
    sbPlaySound("resource/pera.mp3");
  });

  // 画面リサイズ対応
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
});
