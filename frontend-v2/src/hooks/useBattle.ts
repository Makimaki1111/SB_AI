import { useState, useEffect, useRef } from 'react';
import type { BattleState, SocketMessage, AbilityData, BattleResponse } from '../types/battle';
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
  const [prediction, setPrediction] = useState<{include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string, predictions?: Record<string, string>} | null>(null);
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
    setIsProcessing(true); // キュー処理開始時にセット
    
    while (messageQueue.current.length > 0) {
      const data = messageQueue.current.shift();
      if (data) await handleBattleUpdate(data);
    }
    
    setIsProcessing(false); // 全ての演出終了後に解除
    isHandlingQueue.current = false;
  };

  const handleBattleUpdate = async (data: BattleResponse) => {
    // setIsProcessing(true); // 個別の更新では行わない
    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) {
        setUiMapping(data.info.id_to_ui_map);
        uiMappingRef.current = data.info.id_to_ui_map;
      }

      if (data.state.word) {
        if (data.state.is_my_turn) setFoeWord(data.state.word);
        else setAllyWord(data.state.word);
      }

      const currentBattleState = battleStateRef.current;
      if (data.state.is_my_turn !== currentBattleState?.is_my_turn || data.type === 'made_room') {
        const total = data.info?.total_time || 20;
        const limit = data.info?.time_limit || 20;
        setTimer({ remaining: limit, total: total });
        if (data.state.is_my_turn) soundManager.play('start');
      }

      const prevState = currentBattleState || data.state;
      const initialVisualState: BattleState = {
        ...data.state,
        characters: { ...prevState.characters }, 
        status: data.state.winner_team !== null ? 'finished' : 'active'
      };
      setBattleState(initialVisualState);

      const currentUiMap = data.info?.id_to_ui_map || uiMappingRef.current;
      const allyId = Object.keys(currentUiMap).find(id => currentUiMap[id] === 'ally');
      const foeId = Object.keys(currentUiMap).find(id => currentUiMap[id] === 'foe');

      const events = data.events || [];
      let tempCharacters = { ...initialVisualState.characters };

      for (const event of events) {
        if (event.message) setDisplayMessage(event.message);
        
        const targetSide = event.target === allyId ? 'ally' : event.target === foeId ? 'foe' : null;
        const targetId = event.target;

        if (event.type === 'damage' || event.type === 'drain') {
          if (event.type === 'damage') soundManager.play('middmg');
          else soundManager.play('heal');

          if (targetSide === 'ally') setAllyEffect('blink');
          else if (targetSide === 'foe') setFoeEffect('blink');
          
          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId] = { ...tempCharacters[targetId], hp: event.hp };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }

          if (event.type === 'drain' && event.attacker) {
            const attackerSide = event.attacker === allyId ? 'ally' : event.attacker === foeId ? 'foe' : null;
            if (attackerSide === 'ally') setAllyEffect('heal');
            else if (attackerSide === 'foe') setFoeEffect('heal');
          }
          
          await new Promise(resolve => setTimeout(resolve, 800));
          setAllyEffect(null);
          setFoeEffect(null);
        } else if (event.type === 'cure') {
          soundManager.play('heal');
          if (targetSide === 'ally') setAllyEffect('heal');
          else if (targetSide === 'foe') setFoeEffect('heal');

          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId] = { ...tempCharacters[targetId], hp: event.hp };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          await new Promise(resolve => setTimeout(resolve, 800));
          setAllyEffect(null);
          setFoeEffect(null);
        } else if (event.type === 'stat_up' || event.type === 'stat_down') {
          const effect = event.type === 'stat_up' ? 'up' : 'down';
          soundManager.play(effect);
          if (targetSide === 'ally') setAllyEffect(effect);
          else if (targetSide === 'foe') setFoeEffect(effect);

          if (targetId && tempCharacters[targetId] && event.new_rank !== undefined && event.new_rank !== null) {
            const field = event.stat_type === 'defense' ? 'defense_rank' : 'attack_rank';
            tempCharacters[targetId] = { ...tempCharacters[targetId], [field]: event.new_rank };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          await new Promise(resolve => setTimeout(resolve, 800));
          setAllyEffect(null);
          setFoeEffect(null);
        } else {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      const finalState: BattleState = {
        ...data.state,
        status: data.state.winner_team !== null ? 'finished' : 'active'
      };
      setBattleState(finalState);
      battleStateRef.current = finalState;
    } catch (err) {
      console.error('Error in handleBattleUpdate:', err);
    } finally {
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
        if (data.type === 'pre_check' && data.info) {
          setPrediction({
            include: data.info.include ?? false,
            used: data.info.used ?? false,
            type1: data.info.type1,
            type2: data.info.type2,
            prediction: data.info.prediction,
            predictions: data.info.predictions
          });
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
