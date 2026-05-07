import React, { createContext, useContext, useState } from 'react';
import SoundManager from '../utils/SoundManager';

interface SoundContextType {
  bgmVolume: number;
  seVolume: number;
  setBgmVolume: (value: number) => void;
  setSeVolume: (value: number) => void;
  play: (keyOrPath: string) => void;
  playEventSound: (type: string, message?: string) => void;
  playTypeSound: (typeName: string) => void;
  startBGM: (path: string) => void;
  stopBGM: () => void;
  unlock: () => Promise<void>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bgmVolume, setBgmVolumeState] = useState(SoundManager.getVolume('bgm'));
  const [seVolume, setSeVolumeState] = useState(SoundManager.getVolume('se'));

  const setBgmVolume = (value: number) => {
    SoundManager.setVolume('bgm', value);
    setBgmVolumeState(value);
  };

  const setSeVolume = (value: number) => {
    SoundManager.setVolume('se', value);
    setSeVolumeState(value);
  };

  return (
    <SoundContext.Provider value={{
      bgmVolume,
      seVolume,
      setBgmVolume,
      setSeVolume,
      play: (k) => SoundManager.play(k),
      playEventSound: (t, m) => SoundManager.playEventSound(t, m),
      playTypeSound: (t) => SoundManager.playTypeSound(t),
      startBGM: (p) => SoundManager.startBGM(p),
      stopBGM: () => SoundManager.stopBGM(),
      unlock: () => SoundManager.unlock()
    }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
