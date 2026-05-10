import { createContext } from 'react';

export interface SoundContextType {
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

export const SoundContext = createContext<SoundContextType | undefined>(undefined);
