import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';

export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  accountId?: string;
  subscribedSymbols?: Set<string>;
}

// Global WebSocket server instance for broadcasting
let globalWss: WebSocketServer | null = null;

export const setupWebSocket = (wss: WebSocketServer, prisma: PrismaClient): void => {
  globalWss = wss;
  
  wss.on('connection', (ws: ExtendedWebSocket) => {
    ws.isAlive = true;
    ws.subscribedSymbols = new Set();
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message, prisma);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected');
    });
    
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to Paper Trading Platform'
    }));
  });
  
  const interval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
};

const handleWebSocketMessage = async (
  ws: ExtendedWebSocket,
  message: any,
  prisma: PrismaClient
): Promise<void> => {
  switch (message.type) {
    case 'subscribe':
      ws.accountId = message.accountId;
      ws.send(JSON.stringify({
        type: 'subscribed',
        accountId: message.accountId
      }));
      break;

    case 'subscribe_prices':
      const symbols = Array.isArray(message.symbols) ? message.symbols : [message.symbols];
      symbols.forEach(symbol => ws.subscribedSymbols?.add(symbol.toUpperCase()));
      ws.send(JSON.stringify({
        type: 'price_subscription_confirmed',
        symbols: symbols
      }));
      break;

    case 'unsubscribe_prices':
      const unsubSymbols = Array.isArray(message.symbols) ? message.symbols : [message.symbols];
      unsubSymbols.forEach(symbol => ws.subscribedSymbols?.delete(symbol.toUpperCase()));
      ws.send(JSON.stringify({
        type: 'price_unsubscription_confirmed',
        symbols: unsubSymbols
      }));
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      }));
  }
};

// Broadcast price updates to subscribed clients
export const broadcastPriceUpdate = (symbol: string, priceData: {
  price: number;
  timestamp: string;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
}): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'price_update',
    symbol: symbol.toUpperCase(),
    data: priceData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && 
        ws.subscribedSymbols?.has(symbol.toUpperCase())) {
      ws.send(message);
    }
  });
};

// Broadcast order updates to account subscribers
export const broadcastOrderUpdate = (accountId: string, orderData: any): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'order_update',
    accountId,
    data: orderData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.accountId === accountId) {
      ws.send(message);
    }
  });
};

// Broadcast fill updates to account subscribers
export const broadcastFillUpdate = (accountId: string, fillData: any): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'fill_update',
    accountId,
    data: fillData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.accountId === accountId) {
      ws.send(message);
    }
  });
};

// Broadcast position updates to account subscribers
export const broadcastPositionUpdate = (accountId: string, positionData: any): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'position_update',
    accountId,
    data: positionData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.accountId === accountId) {
      ws.send(message);
    }
  });
};

// Broadcast account updates to account subscribers
export const broadcastAccountUpdate = (accountId: string, accountData: any): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'account_update',
    accountId,
    data: accountData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.accountId === accountId) {
      ws.send(message);
    }
  });
};

// Broadcast log messages (optional)
export const broadcastLog = (accountId: string, logData: any): void => {
  if (!globalWss) return;

  const message = JSON.stringify({
    type: 'log',
    accountId,
    data: logData,
    timestamp: new Date().toISOString()
  });

  globalWss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.accountId === accountId) {
      ws.send(message);
    }
  });
};