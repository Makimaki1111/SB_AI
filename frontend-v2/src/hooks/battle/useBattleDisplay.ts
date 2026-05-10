import { useState } from 'react';

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
  
  const [notification, setNotification] = useState<string | null>(null);
  const [waitMessage, setWaitMessage] = useState<string | null>(null);
  const [allyEffect, setAllyEffect] = useState<string | null>(null);
  const [foeEffect, setFoeEffect] = useState<string | null>(null);
  const [allyWord, setAllyWord] = useState<string | null>(null);
  const [foeWord, setFoeWord] = useState<string | null>(null);
  const [knockoutStates, setKnockoutStates] = useState<Record<string, boolean>>({});
  const [showResultButton, setShowResultButton] = useState(false);
  
  // ダブルバトルなど、個別のキャラクターに対するエフェクトを管理
  const [activeEffects, setActiveEffects] = useState<Record<string, string>>({});

  const clearPrediction = () => setPrediction(null);
  
  const showNotification = (text: string, duration: number = 1500) => {
    setNotification(text);
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
    setAllyWord(null);
    setFoeWord(null);
    setMessageLog({ text: null, isOpen: false });
    setWaitMessage(null);
    setKnockoutStates({});
    setShowResultButton(false);
    setAllyEffect(null);
    setFoeEffect(null);
    setActiveEffects({});
  };

  return {
    prediction, setPrediction, clearPrediction,
    messageLog, setMessageLog,
    notification, showNotification,
    waitMessage, setWaitMessage,
    allyEffect, setAllyEffect,
    foeEffect, setFoeEffect,
    allyWord, setAllyWord,
    foeWord, setFoeWord,
    knockoutStates, setKnockoutStates,
    showResultButton, setShowResultButton,
    activeEffects, setActiveEffects, playCharacterEffect,
    resetDisplay
  };
};
