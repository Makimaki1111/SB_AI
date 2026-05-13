import { useState, useEffect, useRef } from 'react';
import type { BattleResponse, SocketMessage } from '../../types/battle';

export const useBattleSocket = (url: string, onMessage: (data: BattleResponse) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = (_event) => {
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('⚠️ WebSocket Error details:', err);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data: BattleResponse = JSON.parse(event.data);
        onMessageRef.current(data);
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

  const sendMessage = (msg: SocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn(`Cannot send message. Socket state: ${socketRef.current?.readyState}`);
    }
  };

  return { isConnected, sendMessage };
};
