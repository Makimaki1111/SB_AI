import { useState } from 'react';

export const useDoubleBattleDisplay = () => {
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
  
  const [characterEffects, setCharacterEffects] = useState<Record<string, string | null>>({});
  const [characterWords, setCharacterWords] = useState<Record<string, string | null>>({});
  
  const [knockoutStates, setKnockoutStates] = useState<Record<string, boolean>>({});
  const [showResultButton, setShowResultButton] = useState(false);

  const clearPrediction = () => setPrediction(null);
  
  const showNotification = (text: string, duration: number = 1500) => {
    setNotification(text);
    setTimeout(() => setNotification(null), duration);
  };

  const setCharacterEffect = (id: string, effect: string | null) => {
    setCharacterEffects(prev => ({ ...prev, [id]: effect }));
  };

  const setCharacterWord = (id: string, word: string | null) => {
    setCharacterWords(prev => ({ ...prev, [id]: word }));
  };

  const resetDisplay = () => {
    setCharacterWords({});
    setCharacterEffects({});
    setMessageLog({ text: null, isOpen: false });
    setWaitMessage(null);
    setKnockoutStates({});
    setShowResultButton(false);
  };

  return {
    prediction, setPrediction, clearPrediction,
    messageLog, setMessageLog,
    notification, showNotification,
    waitMessage, setWaitMessage,
    characterEffects, setCharacterEffect,
    characterWords, setCharacterWord,
    knockoutStates, setKnockoutStates,
    showResultButton, setShowResultButton,
    resetDisplay
  };
};
