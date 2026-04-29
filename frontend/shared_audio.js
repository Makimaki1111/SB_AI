(() => {
  if (window.SB_AUDIO) {
    return;
  }

  const audioCache = {};
  const lastPlayTime = {};

  let audioCtx = null;
  let bgmGainNode = null;
  let seGainNode = null;
  let bgmSource = null;
  let bgmAudioElement = null;
  let currentBgmPath = null;
  let bgmStartPromise = null;
  let bgmPendingPath = null;
  let bgmRequestSeq = 0;

  let bgmVolume = 0.1;
  let seVolume = 0.5;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      bgmGainNode = audioCtx.createGain();
      bgmGainNode.gain.value = bgmVolume;
      bgmGainNode.connect(audioCtx.destination);

      seGainNode = audioCtx.createGain();
      seGainNode.gain.value = seVolume;
      seGainNode.connect(audioCtx.destination);
    }
  }

  function setBGMVolume(val) {
    bgmVolume = val;
    if (bgmGainNode && audioCtx) {
      bgmGainNode.gain.setTargetAtTime(val, audioCtx.currentTime, 0.1);
    }
    if (bgmAudioElement) {
      bgmAudioElement.volume = val;
    }
  }

  function setSEVolume(val) {
    seVolume = val;
    if (seGainNode && audioCtx) {
      seGainNode.gain.setTargetAtTime(val, audioCtx.currentTime, 0.1);
    }
  }

  async function loadAudio(path) {
    if (audioCache[path]) return audioCache[path];

    if (window.location.protocol === "file:") {
      return new Promise((resolve) => {
        const audio = new Audio(path);
        audio.preload = "auto";
        audioCache[path] = audio;
        resolve(audio);
      });
    }

    try {
      initAudioContext();
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCache[path] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      return new Promise((resolve) => {
        const audio = new Audio(path);
        audioCache[path] = audio;
        resolve(audio);
      });
    }
  }

  async function preloadSounds(paths = []) {
    initAudioContext();
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 0) return;
    await Promise.all(uniquePaths.map((p) => loadAudio(p)));
  }

  async function playSound(path) {
    try {
      if (!path) return false;

      const now = Date.now();
      if (lastPlayTime[path] && now - lastPlayTime[path] < 80) {
        return false;
      }
      lastPlayTime[path] = now;

      initAudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const buffer = await loadAudio(path);
      if (!buffer) return false;

      if (buffer instanceof AudioBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        let volumeScale = 1.0;
        if (path.includes("pera.mp3")) {
          volumeScale = 0.3;
        }

        const localGain = audioCtx.createGain();
        localGain.gain.value = volumeScale;

        source.connect(localGain);
        localGain.connect(seGainNode);
        source.start(0);
      } else if (buffer instanceof HTMLAudioElement) {
        const audio = buffer.cloneNode();
        let volumeScale = 1.0;
        if (path.includes("pera.mp3")) {
          volumeScale = 0.3;
        }
        audio.volume = seVolume * volumeScale;
        audio.play().catch(() => {});
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  function isSameBgmPlaying(path) {
    if (currentBgmPath !== path) return false;
    if (bgmSource) return true;
    if (bgmAudioElement && !bgmAudioElement.paused) return true;
    return false;
  }

  function stopCurrentBGM() {
    try {
      if (bgmSource) {
        try {
          bgmSource.stop();
          bgmSource.disconnect();
        } catch (e) {
          // noop
        }
        bgmSource = null;
      }

      if (bgmAudioElement) {
        bgmAudioElement.pause();
        bgmAudioElement.currentTime = 0;
        bgmAudioElement = null;
      }

      currentBgmPath = null;
      return true;
    } catch (e) {
      return false;
    }
  }

  async function startBGM(bgmPath) {
    try {
      if (!bgmPath) return false;

      initAudioContext();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      if (isSameBgmPlaying(bgmPath)) return true;
      if (bgmAudioElement && currentBgmPath === bgmPath && bgmAudioElement.paused) {
        bgmAudioElement.play().catch(() => {});
        return true;
      }

      if (bgmStartPromise && bgmPendingPath === bgmPath) {
        return await bgmStartPromise;
      }

      const requestId = ++bgmRequestSeq;
      bgmPendingPath = bgmPath;

      const myPromise = (async () => {
        const buffer = await loadAudio(bgmPath);
        if (!buffer) return false;
        if (requestId !== bgmRequestSeq) return false;
        if (isSameBgmPlaying(bgmPath)) return true;

        stopCurrentBGM();

        if (buffer instanceof AudioBuffer) {
          bgmSource = audioCtx.createBufferSource();
          bgmSource.buffer = buffer;
          bgmSource.loop = true;
          bgmSource.connect(bgmGainNode);
          bgmSource.start(0);
        } else if (buffer instanceof HTMLAudioElement) {
          bgmAudioElement = buffer;
          bgmAudioElement.loop = true;
          bgmAudioElement.volume = bgmVolume;
          bgmAudioElement.currentTime = 0;
          bgmAudioElement.play().catch(() => {});
        }

        currentBgmPath = bgmPath;
        return true;
      })();

      bgmStartPromise = myPromise;
      try {
        return await myPromise;
      } finally {
        if (bgmStartPromise === myPromise) {
          bgmStartPromise = null;
          bgmPendingPath = null;
        }
      }
    } catch (e) {
      return false;
    }
  }

  function stopBGM() {
    bgmRequestSeq += 1;
    bgmStartPromise = null;
    bgmPendingPath = null;
    return stopCurrentBGM();
  }

  function unlockAudioContext() {
    initAudioContext();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  }

  window.SB_AUDIO = {
    setBGMVolume,
    setSEVolume,
    preloadSounds,
    playSound,
    startBGM,
    stopBGM,
    unlockAudioContext
  };
})();
