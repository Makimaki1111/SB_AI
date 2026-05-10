import { createContext } from 'react';

export interface UserSettings {
  bgmVolume: number;
  seVolume: number;
}

export interface UserContextType {
  username: string;
  setUsername: (name: string) => void;
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);
