import { useState, useEffect, useCallback, useRef } from 'react';
import { BattleState, BattleResponse, SocketMessage, CharacterState } from '../types/battle';

export const useBattle = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [allAbilities, setAllAbilities] = useState<Record<string, any>>({});
  const [uiMapping, setUiMapping] = useState<Record<string, string>>({});
  
  // 接続処理
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('Connected to Battle Server');
      // 初期化メッセージなどを送る場合はここ
    };
    
    ws.onmessage = (event) => {
      const data: BattleResponse = JSON.parse(event.data);
      
      // 型安全なデータ更新
      if (data.state) {
        setBattleState(data.state);
      }
      if (data.all_abilities) {
        setAllAbilities(data.all_abilities);
      }
      if (data.info?.id_to_ui_map) {
        setUiMapping(data.info.id_to_ui_map);
      }
      
      // イベント処理（ダメージ演出など）のロジックをここに集約可能
      data.events.forEach(e => {
        console.log(`Battle Event: ${e.type} - ${e.message}`);
      });
    };
    
    setSocket(ws);
    return () => ws.close();
  }, [url]);

  // 単語送信メソッド
  const submitWord = useCallback((word: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const msg: SocketMessage = {
        type: "submit_word",
        info: { word }
      };
      socket.send(JSON.stringify(msg));
    }
  }, [socket]);

  // UIスロットからキャラクター情報を取得するヘルパー
  const getCharacterBySlot = (slot: "ally" | "foe") => {
    if (!battleState || !uiMapping) return null;
    const id = Object.keys(uiMapping).find(key => uiMapping[key] === slot);
    return id ? battleState.characters[id] : null;
  };

  return {
    battleState,
    ally: getCharacterBySlot("ally"),
    foe: getCharacterBySlot("foe"),
    allAbilities,
    submitWord,
    isConnected: socket?.readyState === WebSocket.OPEN
  };
};
