import { useState, useEffect, useRef } from 'react';
import type { BattleState, SocketMessage, AbilityData, BattleResponse } from '../types/battle';
import { SoundManager } from '../utils/SoundManager';

export const useBattle = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [uiMapping, setUiMapping] = useState<Record<string, string>>({});
  const [prediction, setPrediction] = useState<{include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string} | null>(null);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allyEffect, setAllyEffect] = useState<string | null>(null);
  const [foeEffect, setFoeEffect] = useState<string | null>(null);
  const [timer, setTimer] = useState({ remaining: 20, total: 20 });
  const [allyWord, setAllyWord] = useState<string | null>(null);
  const [foeWord, setFoeWord] = useState<string | null>(null);
  const soundManager = SoundManager.getInstance();
  
  // WebSocket接続管理
  useEffect(() => {
    console.log('🔌 Effect: Creating WebSocket for', url);
    const ws = new WebSocket(url);
    socketRef.current = ws;
    
    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('❌ WebSocket Disconnected');
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('⚠️ WebSocket Error:', err);
      setIsConnected(false);
    };
    
    ws.onmessage = (event) => {
      try {
        const data: BattleResponse = JSON.parse(event.data);
        if (data.type === 'pre_check') {
          setPrediction((data as any).info);
          return;
        }
        if (['accepted', 'made_room', 'update', 'battle_end', 'timeout'].includes(data.type)) {
          processBattleUpdate(data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, [url]);

  // タイマー管理
  useEffect(() => {
    if (battleState?.status === 'finished') return;

    const timerInterval = setInterval(() => {
      setTimer(prev => ({
        ...prev,
        remaining: Math.max(0, prev.remaining - 0.1)
      }));
    }, 100);

    return () => clearInterval(timerInterval);
  }, [battleState?.status]);

  // 決着時のSE
  useEffect(() => {
    if (battleState?.status === 'finished') {
      soundManager.play('end');
    }
  }, [battleState?.status]);

  const processBattleUpdate = async (data: BattleResponse) => {
    setIsProcessing(true);
    try {
      if (data.info?.id_to_ui_map) setUiMapping(data.info.id_to_ui_map);

      // 単語の更新
      if (data.state.word) {
        if (data.state.is_my_turn) setFoeWord(data.state.word);
        else setAllyWord(data.state.word);
      }

      // タイマーリセット
      if (data.state.is_my_turn !== battleState?.is_my_turn || data.type === 'made_room') {
        setTimer({ remaining: 20, total: 20 });
        if (data.state.is_my_turn) soundManager.play('start');
      }

      const events = data.events || [];
      for (const event of events) {
        if (event.message) setDisplayMessage(event.message);
        
        if (event.type === 'damage') {
          if ((event as any).ally_damage > 0) {
            setAllyEffect('blink');
            soundManager.play('middmg');
            setTimeout(() => setAllyEffect(null), 1000);
          }
          if ((event as any).foe_damage > 0) {
            setFoeEffect('blink');
            soundManager.play('middmg');
            setTimeout(() => setFoeEffect(null), 1000);
          }
        } else if (event.type === 'cure' || event.type === 'drain') {
          const side = (event as any).ally_cure > 0 ? 'ally' : 'foe';
          soundManager.play('heal');
          if (side === 'ally') {
            setAllyEffect('heal');
            setTimeout(() => setAllyEffect(null), 1000);
          } else {
            setFoeEffect('heal');
            setTimeout(() => setFoeEffect(null), 1000);
          }
        } else if (event.type === 'stat_up' || event.type === 'stat_down') {
          const effect = event.type === 'stat_up' ? 'up' : 'down';
          soundManager.play(effect);
          const side = (event as any).player === 'ally' ? 'ally' : 'foe';
          if (side === 'ally') {
            setAllyEffect(effect);
            setTimeout(() => setAllyEffect(null), 1000);
          } else {
            setFoeEffect(effect);
            setTimeout(() => setFoeEffect(null), 1000);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      setBattleState(data.state);
    } catch (err) {
      console.error('Error in processBattleUpdate:', err);
    } finally {
      setIsProcessing(false);
      setDisplayMessage(null);
    }
  };

  const sendMessage = (msg: SocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const sendIncludeCheck = (word: string) => {
    if (!battleState?.room_id) return;
    sendMessage({
      type: 'include_check',
      info: { word, room_id: battleState.room_id }
    });
  };

  const ally = battleState?.characters ? 
    Object.values(battleState.characters).find(c => uiMapping[c.id] === 'ally') || null : null;
  const foe = battleState?.characters ? 
    Object.values(battleState.characters).find(c => uiMapping[c.id] === 'foe') || null : null;

  return {
    ally,
    foe,
    battleState,
    isConnected,
    prediction,
    displayMessage,
    isProcessing,
    allyEffect,
    foeEffect,
    timer,
    allyWord,
    foeWord,
    sendMessage,
    sendIncludeCheck
  };
};
