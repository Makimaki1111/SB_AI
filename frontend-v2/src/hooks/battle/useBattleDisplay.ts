import { useState } from 'react';
import type { AbilityData } from '../../types/battle';

export interface NotificationData {
  text: string;
  type?: 'ability_change' | 'general';
  prevAbility?: AbilityData;
  nextAbility?: AbilityData;
  playerName?: string;
}

export const useBattleDisplay = () => {
  const [prediction, setPrediction] = useState<{ 
    include: boolean, 
    type1?: string, 
    type2?: string, 
    used?: boolean, 
    prediction?: string, 
    predictions?: Record<string, string> 
  } | null>(null);
  
  const [messageLog, setMessageLog] = useState<{ 
    text: string | null, 
    isOpen: boolean 
  }>({ text: null, isOpen: false });
  
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [waitMessage, setWaitMessage] = useState<string | null>(null);
  const [knockoutStates, setKnockoutStates] = useState<Record<string, boolean>>({});
  const [showResultButton, setShowResultButton] = useState(false);
  
  // 個別のキャラクターに対するエフェクト（バフ・デバフ等）を管理
  const [activeEffects, setActiveEffects] = useState<Record<string, string>>({});

  const clearPrediction = () => setPrediction(null);
  
  const showNotification = (data: string | NotificationData, duration: number = 2500) => {
    const notificationData = typeof data === 'string' ? { text: data } : data;
    setNotification(notificationData);
    setTimeout(() => setNotification(null), duration);
  };

  const playCharacterEffect = (id: string, effect: string, duration: number = 1000) => {
    setActiveEffects(prev => ({ ...prev, [id]: effect }));
    setTimeout(() => {
      setActiveEffects(prev => {
        if (prev[id] === effect) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return prev;
      });
    }, duration);
  };

  const resetDisplay = () => {
    setPrediction(null); // 予測表示をクリア
    setMessageLog({ text: null, isOpen: false });
    setWaitMessage(null);
    setKnockoutStates({});
    setShowResultButton(false);
    setActiveEffects({});
    setNotification(null);
  };

  return {
    prediction, setPrediction, clearPrediction,
    messageLog, setMessageLog,
    notification, showNotification,
    waitMessage, setWaitMessage,
    knockoutStates, setKnockoutStates,
    showResultButton, setShowResultButton,
    activeEffects, setActiveEffects, playCharacterEffect,
    resetDisplay
  };
};
