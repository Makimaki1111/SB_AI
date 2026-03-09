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
  ally: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0, is_poison: false },
  foe: { hp: 0, maxHp: 0, atk: 0, def: 0, ability: '', abilityChangeCount: 0, is_poison: false },
  allAbilities: {}
};

let ui;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// 音声バッファのキャッシュ (Web Audio API用)
const audioCache = {};
const lastPlayTime = {}; // 重複再生防止用のタイムスタンプ記録

// --- Web Audio API 制御 ---
let audioCtx = null;
let bgmGainNode = null;
let seGainNode = null;
let bgmSource = null;
let bgmAudioElement = null; // フォールバック用（HTML5 Audio）
let currentBgmPath = null;

// 音量設定 (初期値)
let BGM_VOLUME = 0.1;
let SE_VOLUME = 0.5;

// Web Audio APIの初期化
function initAudioContext() {
  // 親フレームがある場合は、ローカルのAudioContextを作らないようにする
  if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
    return;
  }

  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // BGM用ゲインノード（音量調整）
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.value = BGM_VOLUME;
    bgmGainNode.connect(audioCtx.destination);

    // SE用ゲインノード（音量調整）
    seGainNode = audioCtx.createGain();
    seGainNode.gain.value = SE_VOLUME;
    seGainNode.connect(audioCtx.destination);
  }
}

window.setBGMVolume = function (val) {
  // 親フレームのSB_AUDIOを優先利用
  if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
    return window.parent.SB_AUDIO.setBGMVolume(val);
  }

  BGM_VOLUME = val;
  if (bgmGainNode && audioCtx) {
    // ノイズ防止のため少し時間をかけて滑らかに変更
    bgmGainNode.gain.setTargetAtTime(val, audioCtx.currentTime, 0.1);
  }
  // HTML5 Audio (フォールバック時)
  if (bgmAudioElement) {
    bgmAudioElement.volume = val;
  }
};

window.setSEVolume = function (val) {
  // 親フレームのSB_AUDIOを優先利用
  if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
    return window.parent.SB_AUDIO.setSEVolume(val);
  }

  SE_VOLUME = val;
  if (seGainNode && audioCtx) {
    seGainNode.gain.setTargetAtTime(val, audioCtx.currentTime, 0.1);
  }
};

// 音声ファイルのロードとデコード
async function loadAudio(path) {
  if (audioCache[path]) return audioCache[path];

  // file:// プロトコルでは fetch が CORS エラーになるため、最初から HTML5 Audio を使用する
  if (window.location.protocol === 'file:') {
    return new Promise((resolve) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audioCache[path] = audio;
      resolve(audio);
    });
  }

  try {
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCache[path] = audioBuffer;
    return audioBuffer;
  } catch (e) {
    console.warn(`Web Audio API load failed, falling back to HTML5 Audio: ${path}`, e);
    // フォールバック: HTML5 Audio オブジェクトを生成して返す
    // (file:// プロトコルなどで fetch が CORS エラーになる場合の対策)
    return new Promise((resolve) => {
      const audio = new Audio(path);
      audioCache[path] = audio;
      resolve(audio);
    });
  }
}

async function preloadSounds() {
  // 親フレームのオーディオマネージャーがある場合はそちらに任せる（二重ロード防止）
  try {
    if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
      // パスリストの作成は省略し、親側で必要なものをロードしてもらうか、
      // ここでリストを作って渡す。audio_bridge経由なら渡す必要がある。
    const paths = new Set();
    Object.values(TYPE_SOUND_MAP).forEach(p => paths.add(p));
    Object.values(EVENT_SOUND_MAP).forEach(p => paths.add(p));
    Object.values(DAMAGE_MSG_MAP).forEach(p => paths.add(p));
    paths.add("resource/horizon.mp3");
    paths.add("resource/overflow.mp3");
    paths.add("resource/concent.mp3");
    paths.add("resource/pera.mp3");
    return window.parent.SB_AUDIO.preloadSounds(Array.from(paths));
    }
  } catch(e) {}

  initAudioContext();
  const paths = new Set();
  // マップからパスを収集
  Object.values(TYPE_SOUND_MAP).forEach(p => paths.add(p));
  Object.values(EVENT_SOUND_MAP).forEach(p => paths.add(p));
  Object.values(DAMAGE_MSG_MAP).forEach(p => paths.add(p));

  // 個別に指定されているBGMやSE
  paths.add("resource/horizon.mp3");
  paths.add("resource/overflow.mp3");
  paths.add("resource/concent.mp3");
  paths.add("resource/pera.mp3");

  // 並列ロード
  const promises = Array.from(paths).map(p => loadAudio(p));
  await Promise.all(promises);
}

async function playSound(path) {
  try {
    // 親フレームのSB_AUDIOを優先利用
    if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
      return window.parent.SB_AUDIO.playSound(path);
    }

    if (!path) return false;

    // 短時間の重複再生防止 (100ms以内の連打は無視)
    // これにより、クリックイベントの重複発火による音量増大（二重再生）を防ぐ
    const now = Date.now();
    if (lastPlayTime[path] && now - lastPlayTime[path] < 100) {
      return false;
    }
    lastPlayTime[path] = now;

    initAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const buffer = await loadAudio(path);
    if (!buffer) return false;

    if (buffer instanceof AudioBuffer) {
      // Web Audio API
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      // 個別音量調整: pera.mp3 が大きすぎるため、このファイルだけ音量を下げる
      let volumeScale = 1.0;
      if (path.includes("pera.mp3")) {
        volumeScale = 0.3; // 30%に調整
      }

      // ローカルのゲインノードを作成して音量を調整
      const localGain = audioCtx.createGain();
      localGain.gain.value = volumeScale;

      // 接続: source -> localGain -> seGainNode (全体のSE音量) -> destination
      source.connect(localGain);
      localGain.connect(seGainNode);
      source.start(0);
    } else if (buffer instanceof HTMLAudioElement) {
      // HTML5 Audio (フォールバック)
      // SEは重ねて再生したいので cloneNode する
      const audio = buffer.cloneNode();
      let volumeScale = 1.0;
      if (path.includes("pera.mp3")) { volumeScale = 0.3; }
      audio.volume = SE_VOLUME * volumeScale;
      audio.play().catch(e => console.warn('HTML5 Audio play failed', e));
    }

    return true;
  } catch (e) {
    console.warn('playEffectSound error', e);
    return false;
  }
}

function playEventSound(type, message) {
  let path = EVENT_SOUND_MAP[type];
  if (DAMAGE_MSG_MAP[message]) {
    path = DAMAGE_MSG_MAP[message];
  } else if (type === "damage") {
    console.warn("未知のメッセージです:" + message);
  }
  if (path) playSound(path);
}

function playIconSound(type) {
  // console.log(type);
  let path = TYPE_SOUND_MAP[type];
  if (path !== undefined) playSound(path);
}

// --- BGM 制御 (Web Audio API) ---

async function startBGM(bgmPath) {
  try {
    // 親フレームのSB_AUDIOを優先利用
    if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
      return window.parent.SB_AUDIO.startBGM(bgmPath);
    }

    initAudioContext();
    // iOS対策: await audioCtx.resume() をすると、待機中にユーザー操作の権限が切れ、
    // その後の再生がブロックされることがあるため、awaitせずにリクエストだけ投げておく。
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // 同じ曲が既に再生中なら何もしない
    if (bgmSource && currentBgmPath === bgmPath) return true;
    // フォールバック時のチェック
    if (bgmAudioElement && currentBgmPath === bgmPath && !bgmAudioElement.paused) {
      return true;
    }

    const buffer = await loadAudio(bgmPath);
    if (!buffer) return false;

    // 再生準備の前に、既存のBGMを確実に停止する
    stopBGM();

    if (buffer instanceof AudioBuffer) {
      // Web Audio API
      bgmSource = audioCtx.createBufferSource();
      bgmSource.buffer = buffer;
      bgmSource.loop = true;
      bgmSource.connect(bgmGainNode); // BGM用音量ノードに接続

      bgmSource.start(0);
    } else if (buffer instanceof HTMLAudioElement) {
      // HTML5 Audio (フォールバック)
      bgmAudioElement = buffer;
      bgmAudioElement.loop = true;
      bgmAudioElement.volume = BGM_VOLUME;
      bgmAudioElement.currentTime = 0;

      bgmAudioElement.play().catch(e => console.warn('BGM play failed', e));
    }

    currentBgmPath = bgmPath;
    return true;
  } catch (e) {
    console.warn('startBGM error', e);
    return false;
  }
}

function stopBGM() {
  try {
    // 親フレームのSB_AUDIOを優先利用
    if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
      return window.parent.SB_AUDIO.stopBGM();
    }

    if (bgmSource) {
      try {
        bgmSource.stop();
        bgmSource.disconnect();
      } catch (e) {
        // 既に止まっている場合など
      }
      bgmSource = null;
    }
    // HTML5 Audio の停止
    if (bgmAudioElement) {
      bgmAudioElement.pause();
      bgmAudioElement.currentTime = 0;
      bgmAudioElement = null;
    }

    currentBgmPath = null;
    return true;
  } catch (e) {
    console.warn('stopBGM error', e);
    return false;
  }
}

function getParentAudioManager() {
  try {
    if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
      return window.parent.SB_AUDIO;
    }
  } catch (e) {
    // noop
  }
  return null;
}

function startManagedBGM(path) {
  const manager = getParentAudioManager();
  if (manager && typeof manager.startBGM === "function") {
    return manager.startBGM(path);
  }

  if (window.SB_AUDIO && typeof window.SB_AUDIO.startBGM === "function") {
    return window.SB_AUDIO.startBGM(path);
  }
  return startBGM(path);
}

function stopManagedBGM() {
  const manager = getParentAudioManager();
  if (manager && typeof manager.stopBGM === "function") {
    return manager.stopBGM();
  }

  if (window.SB_AUDIO && typeof window.SB_AUDIO.stopBGM === "function") {
    return window.SB_AUDIO.stopBGM();
  }
  return stopBGM();
}

// モバイルブラウザの自動再生制限対策：ユーザー操作時に音声を一瞬再生してアンロックする
function unlockAudioContext() {
  // 親フレームのSB_AUDIOを優先利用
  if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
    return window.parent.SB_AUDIO.unlockAudioContext();
  }

  initAudioContext();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  // 無音バッファを生成して再生（ファイルロード不要）
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
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

// onAccepted が実行中かどうかを示すフラグ
let isProcessingAccepted = false;
// 待機中の onAccepted データキュー
let pendingAcceptedQueue = [];

const initializeBattleScreen = () => {
  ui.showBattleScreen();
  ui.showMessage();
  ui.hideCheckResult();
  ui.hideAllyImage();
  ui.hideFoeImage();
  ui.showAllyWord("");
  ui.showFoeWord("");
  ui.setAllyName("");
  ui.setFoeName("");
  ui.updatePoisonStatus(false, false);
  ui.abilityInfoContainer.hide();
  ui.situationButton.hide();
  // モーダルを閉じる
  ui.hideSituationModal();
  ui.hideAbilityModal();

  ui.resetHP();
  ui.stopTimer();
  ui.resetSituationInfo();

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
  battleState.ally.is_poison = data.ally.is_poison;
  battleState.foe.ability = data.foe.ability || "secret";
  battleState.foe.abilityChangeCount = data.foe.ability_change_count !== undefined ? data.foe.ability_change_count : 3;
  battleState.foe.is_poison = data.foe.is_poison;

  ui.setAllyHP(battleState.ally.hp, battleState.ally.maxHp);
  ui.setFoeHP(battleState.foe.hp, battleState.foe.maxHp);
  ui.setAllyName(data["ally"]["name"]);
  ui.setFoeName(data["foe"]["name"]);
  ui.updatePoisonStatus(battleState.ally.is_poison, battleState.foe.is_poison);
  if (battleState.ally && typeof battleState.ally.abilityChangeCount !== 'undefined') { // Defensive check
    ui.abilityInfoContainer.selector.css('display', 'flex');
    ui.situationButton.show();
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
  stopManagedBGM();
  playEventSound("start", "");
  await sleep(1500);
  startManagedBGM("resource/overflow.mp3");
  if (data["state"]["is_my_turn"] === true) {
    onAllyTurnStart(data);
  } else {
    onFoeTurnStart(data);
  }
}

const onPreCheck = (data) => {
  ui.showCheckResult(data);
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
      // ダメージ点滅エフェクト (毒ダメージの場合は点滅させない)
      if (e["message"] !== "毒のダメージを受けた！") {
        if ((e["ally_damage"] || 0) > 0) ui.playDamageEffect(true);
        if ((e["foe_damage"] || 0) > 0) ui.playDamageEffect(false);
      }
    } else if (e["type"] === "cure") {
      battleState.ally.hp = Math.min(battleState.ally.maxHp, battleState.ally.hp + (e["ally_cure"] || 0));
      battleState.foe.hp = Math.min(battleState.foe.maxHp, battleState.foe.hp + (e["foe_cure"] || 0));
      ui.updateHPs(battleState.ally.hp, battleState.ally.maxHp, battleState.foe.hp, battleState.foe.maxHp);
      // 回復エフェクト再生
      if ((e["ally_cure"] || 0) > 0) ui.playHealEffect(true);
      if ((e["foe_cure"] || 0) > 0) ui.playHealEffect(false);
    } else if (e["type"] === "stat_down") {
      const isAlly = e["player"] === "ally";
      if (e["stat_type"] === "defense") {
        if (isAlly) battleState.ally.def = e["new_rank"];
        else battleState.foe.def = e["new_rank"];
      } else {
        if (isAlly) battleState.ally.atk = e["new_rank"];
        else battleState.foe.atk = e["new_rank"];
      }
      ui.playStatDownEffect(isAlly);
    } else if (e["type"] === "stat_up") {
      const isAlly = e["player"] === "ally";
      if (e["stat_type"] === "defense") {
        if (isAlly) battleState.ally.def = e["new_rank"];
        else battleState.foe.def = e["new_rank"];
      } else {
        if (isAlly) battleState.ally.atk = e["new_rank"];
        else battleState.foe.atk = e["new_rank"];
      }
      ui.playStatUpEffect(isAlly);
    } else if (e["type"] === "drain") {
      // ダメージ適用
      battleState.ally.hp = Math.max(0, battleState.ally.hp - (e["ally_damage"] || 0));
      battleState.foe.hp = Math.max(0, battleState.foe.hp - (e["foe_damage"] || 0));
      // 回復適用
      battleState.ally.hp = Math.min(battleState.ally.maxHp, battleState.ally.hp + (e["ally_cure"] || 0));
      battleState.foe.hp = Math.min(battleState.foe.maxHp, battleState.foe.hp + (e["foe_cure"] || 0));
      ui.updateHPs(battleState.ally.hp, battleState.ally.maxHp, battleState.foe.hp, battleState.foe.maxHp);
      // ドレイン時の回復エフェクト
      if ((e["ally_cure"] || 0) > 0) ui.playHealEffect(true);
      if ((e["foe_cure"] || 0) > 0) ui.playHealEffect(false);
    } else if (e["type"] === "ability_trigger") {
      if (e["new_ranks"]) {
        battleState.ally.atk = e["new_ranks"]["ally_atk"];
        battleState.ally.def = e["new_ranks"]["ally_def"];
        battleState.foe.atk = e["new_ranks"]["foe_atk"];
        battleState.foe.def = e["new_ranks"]["foe_def"];
      }
      // 毒付与イベントの場合、ここでUIを更新
      if (e["poison_target"]) {
        if (e["poison_target"] === "ally") battleState.ally.is_poison = true;
        if (e["poison_target"] === "foe") battleState.foe.is_poison = true;
        ui.updatePoisonStatus(battleState.ally.is_poison, battleState.foe.is_poison);
      }
    } else if (e["type"] === "cure_poison") {
      if (e["player"] === "ally") {
        battleState.ally.is_poison = false;
      } else {
        battleState.foe.is_poison = false;
      }
      ui.updatePoisonStatus(battleState.ally.is_poison, battleState.foe.is_poison);
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
  ui.focusInput();
  if (!battleState.isVsCpu) {
    // 受信時刻からの経過時間を考慮してタイマーを開始
    const elapsed = (Date.now() - (data._receivedAt || Date.now())) / 1000;
    ui.startTimer(Math.max(0, TURN_TIME_LIMIT - elapsed), TURN_TIME_LIMIT);
  }
}

const onFoeTurnStart = (data) => {
  ui.setWaitMessage("相手のターンです。");
  if (!battleState.isVsCpu) {
    // 受信時刻からの経過時間を考慮してタイマーを開始
    const elapsed = (Date.now() - (data._receivedAt || Date.now())) / 1000;
    ui.startTimer(Math.max(0, TURN_TIME_LIMIT - elapsed), TURN_TIME_LIMIT);
  }
  ui.showMessage();
}

const onAllyWin = () => {
  stopManagedBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に勝った！");
  ui.disableInput();
  ui.showBackToTitleBtn();
  $('#back-to-title-btn').show(); // 強制表示
  ui.stopTimer();
}

const onAllyLose = () => {
  stopManagedBGM();
  playEventSound("end", "")
  ui.showMessage("あいてとの勝負に負けた…");
  ui.disableInput();
  ui.showBackToTitleBtn();
  $('#back-to-title-btn').show(); // 強制表示
  ui.stopTimer();
}

const backToTitle = () => {
  // iOS対策: 画面遷移時にAudioContextを確実に有効化する
  unlockAudioContext();

  isManualClose = true;
  if (sock) {
    sock.close();
    sock = null;
  }
  
  // ページ遷移
  // シングルバトルのロビー(初期状態)に戻るためリロードする
  // (ダブルバトルの backToLobby と同様の挙動)
  window.location.reload();
}

const onOpponentDisconnected = (data) => {
  stopManagedBGM();
  playEventSound("end", "");
  ui.hideMessage();
  ui.setWaitMessage("あいてが切断しました", 0);
  ui.disableInput();
  ui.showBackToTitleBtn();
  $('#back-to-title-btn').show(); // 強制表示
  ui.stopTimer();
}

const onAccepted = async (data) => {
  // 既に処理中ならデータを待機キューに入れて戻る
  if (isProcessingAccepted) {
    pendingAcceptedQueue.push(data);
    return;
  }

  isProcessingAccepted = true;

  // サーバーからの最新ステータスでローカルの状態を更新
  battleState.ally.atk = data.state.ally_A;
  battleState.ally.def = data.state.ally_B;
  battleState.foe.atk = data.state.foe_A;
  battleState.foe.def = data.state.foe_B;

  // 毒状態の更新（イベント同期のため、新規毒発生時はここでは更新しない）
  battleState.ally.is_poison = data.state.ally_poison;
  battleState.foe.is_poison = data.state.foe_poison;

  let showAllyPoison = battleState.ally.is_poison;
  let showFoePoison = battleState.foe.is_poison;

  // 今回のイベントで毒が発生する場合、初期表示では毒を隠す（イベントで表示する）
  const poisonEvent = data.state.events.find(e => e.type === "ability_trigger" && e.poison_target);
  if (poisonEvent) {
    if (poisonEvent.poison_target === "ally") showAllyPoison = false;
    if (poisonEvent.poison_target === "foe") showFoePoison = false;
  }

  // 毒が治った場合、初期表示では毒を表示しておく（イベントで消す）
  const curePoisonEventAlly = data.state.events.find(e => e.type === "cure_poison" && e.player === "ally");
  if (curePoisonEventAlly) showAllyPoison = true;

  const curePoisonEventFoe = data.state.events.find(e => e.type === "cure_poison" && e.player === "foe");
  if (curePoisonEventFoe) showFoePoison = true;

  ui.updatePoisonStatus(showAllyPoison, showFoePoison);

  // --- 特性変更のレスポンスか判定 (最新の変更を取得) ---
  const abilityChangeEvent = [...data.state.events].reverse().find(e => e.type === 'ability_changed');
  const isAbilityChange = !!abilityChangeEvent;

  // 特性変更以外（通常の攻撃など）の場合は、結果表示のためにタイマーを止める
  if (!isAbilityChange) {
    ui.stopTimer();
  }

  if (isAbilityChange) {
    // 特性情報を更新
    if (battleState.ally && data.state && typeof data.state.ally_ability_change_count !== 'undefined') { // Defensive check
      battleState.ally.ability = data.state.ally_ability;
      battleState.ally.abilityChangeCount = data.state.ally_ability_change_count;
      battleState.foe.ability = data.state.foe_ability || "secret";
      battleState.foe.abilityChangeCount = data.state.foe_ability_change_count !== undefined ? data.state.foe_ability_change_count : 3;

      const currentAbilityName = battleState.allAbilities[data.state.ally_ability]?.name || data.state.ally_ability;
      const foeAbilityName = battleState.allAbilities[data.state.foe_ability]?.name || data.state.foe_ability;

      ui.updateAbilityInfo(currentAbilityName, battleState.ally.abilityChangeCount);

      // モーダル内の表示も更新
      ui.allyCurrentAbilityName.selector.text(currentAbilityName);
      ui.allyCurrentAbilityDesc.selector.text(battleState.allAbilities[data.state.ally_ability]?.description || '');
      ui.foeCurrentAbilityName.selector.text(foeAbilityName);
      ui.foeCurrentAbilityDesc.selector.text(battleState.allAbilities[battleState.foe.ability]?.description || '');

      // 特性変更メッセージを表示 (自分のみ)
      if (abilityChangeEvent.player === 'ally') {
        playSound("resource/concent.mp3");
        ui.showModalMessage('とくせいを変更した！', 2000);
      }
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

  // タイムアウト（時間切れ）かどうか判定
  const isTimeout = data.state.events.some(e => e.message && e.message.includes("時間切れ"));

  // まず画像・単語表示はすぐ行う（タイムアウトでなく、かつ単語が存在する場合）
  if (!isTimeout && data.state.word) {
    if (data["state"]["is_my_turn"]) {
      ui.showAllyImage(data);
      ui.showAllyWord(data["state"]["word"]);
      playIconSound(data.state.ally_type[0]);
    } else {
      ui.showFoeImage(data);
      ui.showFoeWord(data["state"]["word"]);
      playIconSound(data.state.foe_type[0]);
    }
  }

  await sleep(1000);
  await processEvent(data["state"]["events"], data["state"]["is_my_turn"]);

  // イベント再生後に最終的なステータスを確実に同期する
  battleState.ally.atk = data.state.ally_A;
  battleState.ally.def = data.state.ally_B;
  battleState.foe.atk = data.state.foe_A;
  battleState.foe.def = data.state.foe_B;

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
window.startBattle = function (mode, roomId = null) {
  // iOS対策: バトル開始のクリックイベント内で確実にAudioContextをアンロックする
  unlockAudioContext();

  battleState.mode = mode;
  if (mode === 'player' || mode === 'room') {
    battleState.isVsCpu = false;
  } else if (mode === 'cpu') {
    battleState.isVsCpu = true;
  }

  initializeBattleScreen();
  connectWebSocket(mode, roomId);
}

function connectWebSocket(mode, roomId) {
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
      sendFindMatch(player1_id);
    } else if (mode === 'cpu') {
      sendMakeNewBattle(player1_id, cpu_id);
    } else if (mode === 'room') {
      if (roomId) {
        sendJoinPrivateRoom(player1_id, roomId);
      } else {
        // バックエンドが create_private_room に対応していない可能性があるため、
        // 以前の仕様に合わせて join_private_room に空のIDを送ることで作成リクエストとする
        sendJoinPrivateRoom(player1_id, "");
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

  // 初期状態はタイトル画面を表示
  ui.showTitleScreen();

  // 画像のプリロードを開始
  preloadImages();

  // 音声のプリロードを開始
  preloadSounds();

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
      if (text.charAt(0) !== battleState.character) {
        // 開始文字不一致（UI表示なし）
        // 「ん」で終わる（UI表示なし）
      } else {
        sendIncludeCheck(battleState.roomId, text);
      }
    } else {
      ui.hideCheckResult();
    }
  });

  // 送信ボタン
  ui.submitButton.onClick(() => {
    const text = ui.input.selector.val();
    if (!text.trim() || !battleState.roomId) return;
    ui.clearInput();
    ui.hideCheckResult();
    // playSound("resource/pera.mp3"); // 送信時の決定音は不要なためコメントアウト
    sendSubmitWord(battleState.roomId, player1_id, text);
  });

  // にげるボタン
  ui.cancelBtn.onClick(() => {
    if (confirm("本当ににげますか？")) {
      // iOS対策: ダイアログを閉じた後にAudioContextの再開を試みる
      unlockAudioContext();
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

  // --- 状況確認モーダルのイベントリスナー ---
  ui.situationButton.onClick(() => {
    ui.updateSituationInfo(
      battleState.ally.atk,
      battleState.ally.def,
      battleState.foe.atk,
      battleState.foe.def
    );
    ui.showSituationModal();
    playSound("resource/pera.mp3");
  });

  ui.closeSituationModalBtn.onClick(() => {
    ui.hideSituationModal();
    playSound("resource/pera.mp3");
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

  // スマホでキーボードを開いたときに画面が上にずれるのを防ぐ
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      // キーボード表示などでビューポートのサイズが変わったときに、
      // ページのスクロール位置を強制的に一番上に戻す
      window.scrollTo(0, 0);
    });
  }
});
