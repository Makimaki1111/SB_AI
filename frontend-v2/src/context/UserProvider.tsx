import type { ReactNode } from 'react';
import { useState } from 'react';
import { UserContext, type UserSettings } from './userContext';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsernameState] = useState(() => {
    return localStorage.getItem('sb_username') || '';
  });

  const [settings, setSettingsState] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('sb_settings');
    return saved ? JSON.parse(saved) : { bgmVolume: 0.3, seVolume: 0.5 };
  });

  const setUsername = (name: string) => {
    setUsernameState(name);
    localStorage.setItem('sb_username', name);
  };

  const setSettings = (newSettings: UserSettings) => {
    setSettingsState(newSettings);
    localStorage.setItem('sb_settings', JSON.stringify(newSettings));
  };

  return (
    <UserContext.Provider value={{ username, setUsername, settings, setSettings }}>
      {children}
    </UserContext.Provider>
  );
};
