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
        onMessageRef.current(data);
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

  const sendMessage = (msg: SocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log(`Sending message: ${msg.type}`);
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn(`Cannot send message. Socket state: ${socketRef.current?.readyState}`);
    }
  };

  return { isConnected, sendMessage };
};
