import { useState, useEffect, useCallback, useRef } from 'react';
import type { BattleState, BattleResponse, SocketMessage } from '../types/battle';

export const useBattle = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [allAbilities, setAllAbilities] = useState<Record<string, any>>({});
  const [uiMapping, setUiMapping] = useState<Record<string, string>>({});
  
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
      console.log('📩 Message received:', event.data);
      const data = JSON.parse(event.data);
      
      if (data.type === 'error') {
        console.error('❌ Server Error:', data.message);
        return;
      }

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
      
      if (data.events) {
        data.events.forEach((e: any) => {
          console.log(`Battle Event: ${e.type} - ${e.message}`);
        });
      }
    };
    
    return () => {
      console.log('🧹 Cleaning up WebSocket:', url);
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

  const sendMessage = (msg: SocketMessage) => {
    // Refがダメならグローバルから拾う（非常手段）
    const socket = socketRef.current || (window as any).lastSocket;
    
    if (!socket) {
      console.warn('⚠️ sendMessage: No socket available (Ref and Global are null)');
      return;
    }
    
    console.log('🔍 sendMessage: Current state:', socket.readyState);
    if (socket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending to server:', msg.type);
      socket.send(JSON.stringify(msg));
    } else {
      console.warn(`⚠️ sendMessage: WebSocket is not OPEN (readyState: ${socket.readyState})`);
    }
  };

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
    sendMessage,
    isConnected
  };
};
