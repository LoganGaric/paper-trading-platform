import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  accountId?: string;
  data?: any;
  timestamp?: string;
}

interface UseWebSocketOptions {
  accountId?: string;
  subscribeToSymbols?: string[];
}

export const useWebSocket = (url: string, options: UseWebSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;

        // Subscribe to account updates if accountId is provided
        if (options.accountId && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'subscribe',
            accountId: options.accountId
          }));
        }

        // Subscribe to price updates if symbols are provided
        if (options.subscribeToSymbols && options.subscribeToSymbols.length > 0 && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'subscribe_prices',
            symbols: options.subscribeToSymbols
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect if not manually closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff
          console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, timeout);
        } else {
          setConnectionError('Failed to reconnect after multiple attempts');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
  };

  const sendMessage = (message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const sendHeartbeat = () => {
    sendMessage({ type: 'ping' });
  };

  useEffect(() => {
    connect();

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(() => {
      if (isConnected) {
        sendHeartbeat();
      }
    }, 30000); // Send heartbeat every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
      disconnect();
    };
  }, [url, options.accountId]);

  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    disconnect,
    reconnectAttempts: reconnectAttempts.current
  };
};