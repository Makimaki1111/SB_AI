import { useState, useEffect, useRef } from 'react';
import type { BattleState, CharacterState, SocketMessage, AbilityData, BattleResponse } from '../types/battle';
import { SoundManager } from '../utils/SoundManager';

export const useBattle = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const battleStateRef = useRef<BattleState | null>(null);
  const uiMappingRef = useRef<Record<string, string>>({});
  
  const messageQueue = useRef<BattleResponse[]>([]);
  const isHandlingQueue = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [allAbilities, setAllAbilities] = useState<Record<string, AbilityData>>({});
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
  
  useEffect(() => {
    battleStateRef.current = battleState;
  }, [battleState]);

  useEffect(() => {
    uiMappingRef.current = uiMapping;
  }, [uiMapping]);

  const processQueue = async () => {
    if (isHandlingQueue.current || messageQueue.current.length === 0) return;
    isHandlingQueue.current = true;
    while (messageQueue.current.length > 0) {
      const data = messageQueue.current.shift();
      if (data) await handleBattleUpdate(data);
    }
    isHandlingQueue.current = false;
  };

  const handleBattleUpdate = async (data: BattleResponse) => {
    setIsProcessing(true);
    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) {
        setUiMapping(data.info.id_to_ui_map);
        uiMappingRef.current = data.info.id_to_ui_map;
      }

      // 単語の更新
      if (data.state.word) {
        if (data.state.is_my_turn) setFoeWord(data.state.word);
        else setAllyWord(data.state.word);
      }

      // ターンの切り替わりでタイマーリセット
      const currentBattleState = battleStateRef.current;
      if (data.state.is_my_turn !== currentBattleState?.is_my_turn || data.type === 'made_room') {
        setTimer({ remaining: 20, total: 20 });
        if (data.state.is_my_turn) soundManager.play('start');
      }

      // 演出前でも基本ステートを一度更新（gif画像の即時反映などのため）
      const initialVisualState = {
        ...data.state,
        status: data.state.winner_team !== null ? 'finished' : 'active'
      };
      setBattleState(initialVisualState as any);

      const events = data.events || [];
      for (const event of events) {
        if (event.message) setDisplayMessage(event.message);
        
        // 演出に合わせて個別のステート（HPなど）を微調整
        if (event.type === 'damage') {
          const allyDmg = (event as any).ally_damage || 0;
          const foeDmg = (event as any).foe_damage || 0;
          
          if (allyDmg > 0) {
            setAllyEffect('blink');
            soundManager.play('middmg');
            setTimeout(() => setAllyEffect(null), 1000);
          }
          if (foeDmg > 0) {
            setFoeEffect('blink');
            soundManager.play('middmg');
            setTimeout(() => setFoeEffect(null), 1000);
          }
        } else if (event.type === 'cure' || event.type === 'drain') {
          const target = (event as any).target || ((event as any).ally_cure > 0 ? 'ally' : 'foe');
          soundManager.play('heal');
          if (target === 'ally') {
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

      // 最終ステート確定
      const finalState = {
        ...data.state,
        status: data.state.winner_team !== null ? 'finished' : 'active'
      };
      setBattleState(finalState as any);
      battleStateRef.current = finalState as any;
    } catch (err) {
      console.error('Error in handleBattleUpdate:', err);
    } finally {
      setIsProcessing(false);
      setDisplayMessage(null);
    }
  };

  useEffect(() => {
    const ws = new WebSocket(url);
    socketRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
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
          messageQueue.current.push(data);
          processQueue();
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

  useEffect(() => {
    if (battleState?.status === 'finished') soundManager.play('end');
  }, [battleState?.status]);

  const sendMessage = (msg: SocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const sendIncludeCheck = (word: string) => {
    const currentBattleState = battleStateRef.current;
    if (!currentBattleState?.room_id) return;
    sendMessage({
      type: 'include_check',
      info: { word, room_id: currentBattleState.room_id }
    });
  };

  const ally = battleState?.characters && uiMapping ? 
    Object.entries(battleState.characters).find(([id, _]) => uiMapping[id] === 'ally')?.[1] || null : null;
  const foe = battleState?.characters && uiMapping ? 
    Object.entries(battleState.characters).find(([id, _]) => uiMapping[id] === 'foe')?.[1] || null : null;

  return {
    ally,
    foe,
    battleState,
    allAbilities,
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
