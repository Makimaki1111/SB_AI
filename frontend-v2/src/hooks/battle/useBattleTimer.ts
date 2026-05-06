import { useState, useEffect } from 'react';

export const useBattleTimer = (isFinished: boolean, isCpu: boolean) => {
  const [timer, setTimer] = useState({ remaining: 20, total: 20 });

  useEffect(() => {
    if (isFinished || isCpu) return;
    
    const timerInterval = setInterval(() => {
      setTimer(prev => ({
        ...prev,
        remaining: Math.max(0, prev.remaining - 0.1)
      }));
    }, 100);

    return () => clearInterval(timerInterval);
  }, [isFinished, isCpu]);

  const resetTimer = (limit: number, total: number) => {
    setTimer({ remaining: limit, total: total });
  };

  return { timer, resetTimer };
};
