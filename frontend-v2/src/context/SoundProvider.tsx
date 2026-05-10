import type { ReactNode } from 'react';
import { useState } from 'react';
import SoundManager from '../utils/SoundManager';
import { SoundContext } from './soundContext';

export const SoundProvider = ({ children }: { children: ReactNode }) => {
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
