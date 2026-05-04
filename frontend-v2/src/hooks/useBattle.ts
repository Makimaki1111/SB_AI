import { useState, useEffect, useRef } from 'react';
import type { BattleState, SocketMessage, AbilityData, BattleResponse } from '../types/battle';

export const useBattle = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
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
  
  useEffect(() => {
    console.log('🔌 Effect: Creating WebSocket for', url);
    const ws = new WebSocket(url);
    socketRef.current = ws;
    // デバッグ用: グローバルに保存
    (window as any).lastSocket = ws;
    
    ws.onopen = () => {
      console.log('✅ WebSocket Connected to:', url, 'ReadyState:', ws.readyState);
      setIsConnected(true);
    };

    ws.onclose = (event) => {
      console.log('❌ WebSocket Disconnected:', event.code, event.reason);
      setIsConnected(false);
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };

    ws.onerror = (err) => {
      console.error('⚠️ WebSocket Error Detailed:', err);
      setIsConnected(false);
    };
    
    ws.onmessage = (event) => {
      const data: BattleResponse = JSON.parse(event.data);
      console.log('📥 Message received:', data.type);

      if (data.type === 'pre_check') {
        setPrediction((data as any).info);
        return;
      }

      if (data.type === 'accepted' || data.type === 'made_room') {
        processBattleUpdate(data);
      }
    };
    
    const timerInterval = setInterval(() => {
      setTimer(prev => ({
        ...prev,
        remaining: Math.max(0, prev.remaining - 0.1)
      }));
    }, 100);

    return () => {
      console.log('🧹 Cleaning up WebSocket:', url);
      clearInterval(timerInterval);
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [url]);

  const processBattleUpdate = async (data: BattleResponse) => {
    setIsProcessing(true);
    
    // 初期情報の設定
    if (data.all_abilities) setAllAbilities(data.all_abilities);
    if (data.info?.id_to_ui_map) setUiMapping(data.info.id_to_ui_map);

    // タイマーのリセット/開始
    if (data.state.is_my_turn !== battleState?.is_my_turn || data.type === 'made_room') {
      setTimer({ remaining: 20, total: 20 });
    }

    // イベントを順番に処理
    for (const event of data.events) {
      if (event.message) {
        setDisplayMessage(event.message);
      }
      
      if (event.type === 'damage') {
        if ((event as any).ally_damage > 0) {
          setAllyEffect('blink');
          setFoeWord(data.state.word || null); // 相手が打った言葉
          setTimeout(() => setAllyEffect(null), 1000);
        }
        if ((event as any).foe_damage > 0) {
          setFoeEffect('blink');
          setAllyWord(data.state.word || null); // 自分が打った言葉
          setTimeout(() => setFoeEffect(null), 1000);
        }
      } else if (event.type === 'cure' || event.type === 'drain') {
        if ((event as any).ally_cure > 0) {
          setAllyEffect('heal');
          setTimeout(() => setAllyEffect(null), 1000);
        }
        if ((event as any).foe_cure > 0) {
          setFoeEffect('heal');
          setTimeout(() => setFoeEffect(null), 1000);
        }
      } else if (event.type === 'stat_up') {
        if ((event as any).player === 'ally') {
          setAllyEffect('stat_up');
          setTimeout(() => setAllyEffect(null), 1000);
        } else {
          setFoeEffect('stat_up');
          setTimeout(() => setFoeEffect(null), 1000);
        }
      } else if (event.type === 'stat_down') {
        if ((event as any).player === 'ally') {
          setAllyEffect('stat_down');
          setTimeout(() => setAllyEffect(null), 1000);
        } else {
          setFoeEffect('stat_down');
          setTimeout(() => setFoeEffect(null), 1000);
        }
      }
      
      console.log('🎬 Processing Event:', event.type, event.message);

      // イベントの種類に応じて待機時間を調整
      const waitTime = event.type === 'ability_changed' ? 100 : 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // 最終的なステータスに同期
    setBattleState(data.state);
    setDisplayMessage(null);
    setIsProcessing(false);
  };

  const sendMessage = (msg: SocketMessage) => {
    const socket = socketRef.current || (window as any).lastSocket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  };

  const sendIncludeCheck = (word: string) => {
    if (!battleState?.room_id) return;
    sendMessage({
      type: 'include_check' as any,
      info: { room_id: battleState.room_id, word }
    });
  };

  const getCharacterBySlot = (slot: "ally" | "foe") => {
    if (!battleState || !uiMapping) return null;
    const id = Object.keys(uiMapping).find(key => uiMapping[key] === slot);
    return id ? battleState.characters[id] : null;
  };

  return { 
    isConnected, 
    battleState, 
    ally: getCharacterBySlot("ally"),
    foe: getCharacterBySlot("foe"),
    allAbilities, 
    uiMapping, 
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
