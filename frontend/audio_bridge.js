(() => {
  const EVENT_SOUND_MAP = {
    cure: "resource/heal.mp3",
    start: "resource/start.mp3",
    end: "resource/end.mp3",
    stat_down: "resource/down.mp3",
    drain: "resource/seed_damage.mp3",
    stat_up: "resource/up.mp3"
  };

  const MSG_SUPER = /\u3070\u3064\u3050\u3093/; // ばつぐん
  const MSG_NOT_VERY = /\u3044\u307e\u3072\u3068\u3064/; // いまひとつ
  const MSG_NORMAL_DAMAGE = /\u3075\u3064\u3046\u306e\u30c0\u30e1\u30fc\u30b8/; // ふつうのダメージ
  const MSG_POISON_HIT = /\u6bd2\u306e\u30c0\u30e1\u30fc\u30b8|\u6bd2\u3092\u53d7\u3051/; // 毒のダメージ / 毒を受けた
  const MSG_SEED = /\u3084\u3069\u308a\u304e|\u7a2e\u3092\u690d\u3048\u4ed8\u3051/; // やどりぎ / 種を植え付け

  const getAudioManager = () => {
    try {
      if (window.parent && window.parent !== window && window.parent.SB_AUDIO) {
        return window.parent.SB_AUDIO;
      }
    } catch (e) {
      // noop
    }
    if (window.SB_AUDIO) {
      return window.SB_AUDIO;
    }
    return null;
  };

  const callAudio = (method, ...args) => {
    const manager = getAudioManager();
    if (!manager || typeof manager[method] !== "function") {
      return false;
    }
    return manager[method](...args);
  };

  const resolveTypeSound = (typeName) => {
    if (typeName && typeof window.type_to_image !== "undefined") {
      const imageKey = window.type_to_image[typeName];
      if (imageKey) {
        return `resource/${imageKey}.mp3`;
      }
    }
    return "resource/normal.mp3";
  };

  const resolveMessageSound = (message) => {
    if (!message) return null;
    const text = String(message);
    if (MSG_SEED.test(text)) return "resource/seeded.mp3";
    if (MSG_POISON_HIT.test(text)) return "resource/poison.mp3";
    if (MSG_SUPER.test(text)) return "resource/effective.mp3";
    if (MSG_NOT_VERY.test(text)) return "resource/noneffective.mp3";
    if (MSG_NORMAL_DAMAGE.test(text)) return "resource/middmg.mp3";
    return null;
  };

  let isPageUnloading = false;
  window.addEventListener("beforeunload", () => {
    isPageUnloading = true;
  });

  window.setBGMVolume = function (val) {
    return callAudio("setBGMVolume", val);
  };

  window.setSEVolume = function (val) {
    return callAudio("setSEVolume", val);
  };

  window.preloadSounds = function (paths = []) {
    return callAudio("preloadSounds", paths);
  };

  window.playSound = function (path) {
    if (window.__sbSuppressConcentWithoutIntent && path && path.includes("resource/concent.mp3")) {
      const until = window.__sbExpectConcentUntil || 0;
      if (Date.now() > until) {
        return false;
      }
    }
    return callAudio("playSound", path);
  };

  window.startBGM = function (path) {
    return callAudio("startBGM", path);
  };

  window.stopBGM = function () {
    if (isPageUnloading) {
      return false;
    }
    return callAudio("stopBGM");
  };

  window.unlockAudioContext = function () {
    return callAudio("unlockAudioContext");
  };

  window.playEventSound = function (type, message) {
    let path = EVENT_SOUND_MAP[type] || null;
    const messagePath = resolveMessageSound(message);
    if (messagePath) {
      path = messagePath;
    }
    if (path) {
      return window.playSound(path);
    }
    return false;
  };

  window.playIconSound = function (typeName) {
    const path = resolveTypeSound(typeName);
    return window.playSound(path);
  };

  // Ensure global function bindings also point to bridge implementations.
  try {
    setBGMVolume = window.setBGMVolume;
    setSEVolume = window.setSEVolume;
    preloadSounds = window.preloadSounds;
    playSound = window.playSound;
    startBGM = window.startBGM;
    stopBGM = window.stopBGM;
    unlockAudioContext = window.unlockAudioContext;
    playEventSound = window.playEventSound;
    playIconSound = window.playIconSound;
  } catch (e) {
    // noop
  }
})();
