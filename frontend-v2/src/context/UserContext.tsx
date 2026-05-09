import React, { createContext, useContext, useState } from 'react';

interface UserSettings {
  bgmVolume: number;
  seVolume: number;
}

interface UserContextType {
  username: string;
  setUsername: (name: string) => void;
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
