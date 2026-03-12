import React, { createContext, useContext, useRef, useState } from 'react';

interface AudioContextType {
  setBGMVolume: (val: number) => void;
  setSEVolume: (val: number) => void;
  playSound: (path: string) => Promise<boolean>;
  startBGM: (path: string) => Promise<boolean>;
  stopBGM: () => void;
  unlockAudio: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const seGainRef = useRef<GainNode | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentBgmPathRef = useRef<string | null>(null);
  const audioCacheRef = useRef<Record<string, AudioBuffer>>({});
  
  const [bgmVolume, _setBGMVolume] = useState(0.1);
  const [seVolume, _setSEVolume] = useState(0.5);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmGain.connect(ctx.destination);
      bgmGainRef.current = bgmGain;

      const seGain = ctx.createGain();
      seGain.gain.value = seVolume;
      seGain.connect(ctx.destination);
      seGainRef.current = seGain;
    }
    return audioCtxRef.current;
  };

  const setBGMVolume = (val: number) => {
    _setBGMVolume(val);
    if (bgmGainRef.current && audioCtxRef.current) {
      bgmGainRef.current.gain.setTargetAtTime(val, audioCtxRef.current.currentTime, 0.1);
    }
  };

  const setSEVolume = (val: number) => {
    _setSEVolume(val);
    if (seGainRef.current && audioCtxRef.current) {
      seGainRef.current.gain.setTargetAtTime(val, audioCtxRef.current.currentTime, 0.1);
    }
  };

  const loadAudio = async (path: string): Promise<AudioBuffer | null> => {
    if (audioCacheRef.current[path]) return audioCacheRef.current[path];
    
    try {
      const ctx = initAudio();
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioCacheRef.current[path] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      console.error('Failed to load audio:', path, e);
      return null;
    }
  };

  const playSound = async (path: string) => {
    const buffer = await loadAudio(path);
    if (!buffer || !audioCtxRef.current || !seGainRef.current) return false;

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;

    let volumeScale = 1.0;
    if (path.includes('pera.mp3')) volumeScale = 0.3;

    const localGain = audioCtxRef.current.createGain();
    localGain.gain.value = volumeScale;

    source.connect(localGain);
    localGain.connect(seGainRef.current);
    source.start(0);
    return true;
  };

  const startBGM = async (path: string) => {
    if (currentBgmPathRef.current === path && bgmSourceRef.current) return true;

    const buffer = await loadAudio(path);
    if (!buffer || !audioCtxRef.current || !bgmGainRef.current) return false;

    stopBGM();

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(bgmGainRef.current);
    source.start(0);

    bgmSourceRef.current = source;
    currentBgmPathRef.current = path;
    return true;
  };

  const stopBGM = () => {
    if (bgmSourceRef.current) {
      try {
        bgmSourceRef.current.stop();
        bgmSourceRef.current.disconnect();
      } catch (e) {}
      bgmSourceRef.current = null;
    }
    currentBgmPathRef.current = null;
  };

  const unlockAudio = () => {
    const ctx = initAudio();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  return (
    <AudioContext.Provider value={{ setBGMVolume, setSEVolume, playSound, startBGM, stopBGM, unlockAudio }}>
      {children}
    </AudioContext.Provider>
  );
};
