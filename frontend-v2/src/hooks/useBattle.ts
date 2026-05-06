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
  const [prediction, setPrediction] = useState<{ include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string, predictions?: Record<string, string> } | null>(null);
  const [messageLog, setMessageLog] = useState<{ text: string | null, isOpen: boolean }>({ text: null, isOpen: false });
  const [notification, setNotification] = useState<string | null>(null);
  const [waitMessage, setWaitMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allyEffect, setAllyEffect] = useState<string | null>(null);
  const [foeEffect, setFoeEffect] = useState<string | null>(null);
  const [timer, setTimer] = useState({ remaining: 20, total: 20 });
  const [allyWord, setAllyWord] = useState<string | null>(null);
  const [foeWord, setFoeWord] = useState<string | null>(null);
  const [knockoutStates, setKnockoutStates] = useState<Record<string, boolean>>({});
  const [showResultButton, setShowResultButton] = useState(false);
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
    setIsProcessing(true);

    while (messageQueue.current.length > 0) {
      const data = messageQueue.current.shift();
      if (data) {
        console.log(`Processing queue item: ${data.type}`);
        await handleBattleUpdate(data);
      }
    }

    setIsProcessing(false);
    isHandlingQueue.current = false;
  };

  const handleBattleUpdate = async (data: BattleResponse, isInterrupt: boolean = false) => {
    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) {
        setUiMapping(data.info.id_to_ui_map);
        uiMappingRef.current = data.info.id_to_ui_map;
      }

      const currentBattleState = battleStateRef.current;
      const prevState = currentBattleState || data.state;
      const isInitialMadeRoom = data.type === 'made_room';

      // 1. 初期化 (対戦開始時)
      if (isInitialMadeRoom) {
        setAllyWord(null);
        setFoeWord(null);
        setMessageLog({ text: null, isOpen: false });
        setWaitMessage(null);
        setKnockoutStates({});
        setShowResultButton(false);
        setAllyEffect(null);
        setFoeEffect(null);
      }

      // 2. 演出開始前の表示更新 (単語、画像、黒い箱、タイプ音)
      if (data.state.word) {
        setMessageLog({ text: '', isOpen: true }); // 即座に黒い箱を空文字で表示
        // 重要な修正: 直前のターンの持ち主に基づいて単語の表示場所を決定する
        // (自分が打ったら相手のターンになるため、prevState.is_my_turn が true なら自分の単語)
        if (prevState.is_my_turn) {
          setAllyWord(data.state.word);
        } else {
          setFoeWord(data.state.word);
        }

        const attackerSide = prevState.is_my_turn ? 'ally' : 'foe';
        const attackerId = Object.keys(data.info?.id_to_ui_map || {}).find(id => data.info?.id_to_ui_map[id] === attackerSide);
        const attackerState = data.state.characters[attackerId || ''];
        if (attackerState && attackerState.types && attackerState.types[0]) {
          soundManager.playType(attackerState.types[0]);
        }
      }

      // 3. ビジュアルステートの構築 (HPは古いまま維持し、演出で減らす)
      const initialVisualState: BattleState = {
        ...data.state,
        characters: { ...data.state.characters },
        status: 'active' // 演出開始時は常にactiveにする
      };

      // 演出開始時は、キャラクターのHPだけ「以前の状態」を維持する
      Object.keys(initialVisualState.characters).forEach(id => {
        if (prevState.characters[id]) {
          initialVisualState.characters[id] = {
            ...initialVisualState.characters[id],
            hp: prevState.characters[id].hp
          };
        }
      });

      setBattleState(initialVisualState);
      battleStateRef.current = initialVisualState;
      let tempCharacters = { ...initialVisualState.characters };

      // 4. タイマー更新
      if (data.state.is_my_turn !== currentBattleState?.is_my_turn || isInitialMadeRoom) {
        const total = data.info?.total_time || 20;
        const limit = data.info?.time_limit || 20;
        setTimer({ remaining: limit, total: total });
        if (data.state.is_my_turn) soundManager.play('start');
      }

      const events = data.events || [];
      const currentUiMap = data.info?.id_to_ui_map || uiMappingRef.current;
      const allyId = Object.keys(currentUiMap).find(id => currentUiMap[id] === 'ally');
      const foeId = Object.keys(currentUiMap).find(id => currentUiMap[id] === 'foe');

      // 5. 本家再現: 攻撃開始前の溜め (1000ms) - 黒い箱が出た状態で待機
      const isAbilityChange = events.some(e => e.type === 'ability_changed');
      if (data.state.word && !isAbilityChange) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 3. イベントループ
      for (const event of events) {
        const targetSide = event.target === allyId ? 'ally' : event.target === foeId ? 'foe' : null;
        const targetId = event.target;

        // 特性変更時は箱を隠すが、それ以外（ダメージ等）はメッセージがなくても箱を維持する
        if (event.type === 'ability_changed') {
          setMessageLog({ text: null, isOpen: false });
          setNotification('特性が変わった！');
          setTimeout(() => setNotification(null), 1500);
        } else {
          setMessageLog({ text: event.message || null, isOpen: true });
        }

        // メッセージ連動型サウンド再生 (本家再現)
        if (event.message?.includes('効果はばつぐんだ')) soundManager.play('effective');
        else if (event.message?.includes('効果はいまひとつ')) soundManager.play('noneffective');
        else if (event.message?.includes('ふつうのダメージ')) soundManager.play('middmg');
        else if (event.message?.includes('はたおれた！') && targetId) {
          setKnockoutStates(prev => ({ ...prev, [targetId]: true }));
          soundManager.play('end');
        }
        else if (event.type === 'damage') soundManager.play('middmg');
        else if (event.type === 'cure' || event.type === 'drain') soundManager.play('heal');
        else if (event.type === 'stat_up') soundManager.play('up');
        else if (event.type === 'stat_down') soundManager.play('down');
        else if (event.type === 'revive') soundManager.play('start');

        if (event.type === 'damage' || event.type === 'drain') {
          // 本家再現: ダメージ更新と点滅を同時に開始
          if (!event.message?.includes('毒のダメージ')) {
            if (targetSide === 'ally') setAllyEffect('blink');
            else if (targetSide === 'foe') setFoeEffect('blink');
          }

          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId] = { ...tempCharacters[targetId], hp: event.hp };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }

          if (event.type === 'drain' && event.attacker) {
            const attackerSide = event.attacker === allyId ? 'ally' : event.attacker === foeId ? 'foe' : null;
            if (attackerSide === 'ally') setAllyEffect('heal');
            else if (attackerSide === 'foe') setFoeEffect('heal');
          }

          await new Promise(resolve => setTimeout(resolve, 1000)); // 点滅時間に合わせて待機
          setAllyEffect(null);
          setFoeEffect(null);
        } else if (event.type === 'cure') {
          if (targetSide === 'ally') setAllyEffect('heal');
          else if (targetSide === 'foe') setFoeEffect('heal');

          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId] = { ...tempCharacters[targetId], hp: event.hp };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // 本家: 1000ms
          setAllyEffect(null);
          setFoeEffect(null);
        } else if (event.type === 'revive') {
          if (targetId) {
            setKnockoutStates(prev => ({ ...prev, [targetId]: false }));
            if (tempCharacters[targetId] && event.hp !== undefined) {
              tempCharacters[targetId] = { ...tempCharacters[targetId], hp: event.hp };
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (event.type === 'stat_up' || event.type === 'stat_down') {
          const effect = event.type === 'stat_up' ? 'up' : 'down';
          if (targetSide === 'ally') setAllyEffect(effect);
          else if (targetSide === 'foe') setFoeEffect(effect);

          if (targetId && tempCharacters[targetId] && event.new_rank !== undefined && event.new_rank !== null) {
            const field = event.stat_type === 'defense' ? 'defense_rank' : 'attack_rank';
            tempCharacters[targetId] = { ...tempCharacters[targetId], [field]: event.new_rank };
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          setAllyEffect(null);
          setFoeEffect(null);
        } else if (event.type === 'ability_changed') {
          if (targetId && tempCharacters[targetId] && event.new_ability) {
            tempCharacters[targetId] = { 
              ...tempCharacters[targetId], 
              ability: event.new_ability,
              ability_change_count: event.new_ability_change_count ?? tempCharacters[targetId].ability_change_count
            };
            setBattleState(prev => {
              if (!prev) return null;
              const newChars = { ...prev.characters, [targetId]: tempCharacters[targetId] };
              return { ...prev, characters: newChars };
            });
          }
          if (!isInterrupt) await new Promise(resolve => setTimeout(resolve, 100)); // 割り込みなら待たない
        } else if (event.type === 'battle_result') {
          setMessageLog({ text: event.message || null, isOpen: true });
          setShowResultButton(true);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (event.type === 'message') {
          setMessageLog({ text: event.message || null, isOpen: true });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // メッセージ表示等の汎用待機
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 4. 最終状態の確定と後処理
      // 特性変更を維持しつつ最終状態を反映
      setBattleState(prev => {
        if (!prev || !data.state) return data.state || prev;
        
        // 現在の特性と回数を、サーバーから送られてきた最新の状態（data.state）にマージする
        // (演出中に割り込みで変わった可能性を考慮)
        const mergedChars = { ...data.state.characters };
        for (const id in mergedChars) {
          if (prev.characters[id]) {
            // もし prev (現在の画面) の方が change_count が少ない(＝変更された)なら、そっちを採用
            if (prev.characters[id].ability_change_count < mergedChars[id].ability_change_count) {
              mergedChars[id].ability = prev.characters[id].ability;
              mergedChars[id].ability_change_count = prev.characters[id].ability_change_count;
            }
          }
        }
        const final: BattleState = { 
          ...data.state, 
          characters: mergedChars,
          status: data.state.winner_team !== null ? 'finished' : 'active'
        };
        battleStateRef.current = final;
        return final;
      });

      // ターン開始メッセージの設定 (本家再現)
      const currentFinal = battleStateRef.current;
      if (currentFinal?.status === 'finished') {
        setWaitMessage(null);
      } else {
        const turnMsg = currentFinal?.is_my_turn ? 'あなたのターンです。' : '相手のターンです。';
        setWaitMessage(turnMsg);
        if (!currentFinal?.is_my_turn) {
          setMessageLog({ text: '相手のターンです。', isOpen: true });
        } else {
          // 自分のターンになった瞬間に箱を消す
          setMessageLog({ text: null, isOpen: false });
        }
      }
    } catch (err) {
      console.error('Error in handleBattleUpdate:', err);
    }
  };

  useEffect(() => {
    console.log(`Connecting to WebSocket at: ${url}`);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
    };

    ws.onclose = (event) => {
      console.log(`❌ WebSocket Closed: ${event.code} ${event.reason}`);
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('⚠️ WebSocket Error details:', err);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data: BattleResponse = JSON.parse(event.data);
        console.log(`Received message type: ${data.type}`);

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
          // 特性変更が含まれる場合は割り込み処理
          if (data.type === 'update' && data.events?.some(e => e.type === 'ability_changed')) {
            handleBattleUpdate(data, true);
            // もし特性変更「のみ」ならキューには入れない (二重処理防止)
            if (data.events.length === 1) return;
          }
          
          messageQueue.current.push(data);
          processQueue();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        console.log('Cleanup: Closing WebSocket');
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
      console.log(`Sending message: ${msg.type}`);
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn(`Cannot send message. Socket state: ${socketRef.current?.readyState}`);
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

  const ally = (battleState?.characters && uiMapping) ?
    Object.entries(battleState.characters).find(([id, _]) => uiMapping[id].startsWith('ally'))?.[1] || null : null;
  const foe = (battleState?.characters && uiMapping) ?
    Object.entries(battleState.characters).find(([id, _]) => uiMapping[id].startsWith('foe'))?.[1] || null : null;

  const allyId = (battleState?.characters && uiMapping) ?
    Object.keys(uiMapping).find(id => uiMapping[id].startsWith('ally')) || null : null;
  const foeId = (battleState?.characters && uiMapping) ?
    Object.keys(uiMapping).find(id => uiMapping[id].startsWith('foe')) || null : null;

  return {
    ally,
    foe,
    battleState,
    allAbilities,
    isConnected,
    prediction,
    messageLog,
    notification,
    waitMessage,
    showResultButton,
    isProcessing,
    allyEffect,
    foeEffect,
    timer,
    allyWord,
    foeWord,
    knockoutStates,
    allyId,
    foeId,
    sendMessage,
    sendIncludeCheck
  };
};
