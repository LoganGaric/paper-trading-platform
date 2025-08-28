import type { Order, Fill, Position, Account } from '../types';

export interface WebSocketMessage<T = any> {
  type: string;
  data?: T;
  timestamp?: string;
}

export interface ConnectionMessage extends WebSocketMessage {
  type: 'connection';
  data: {
    message: string;
  };
}

export interface SubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  data: {
    accountId: string;
  };
}

export interface SubscribedMessage extends WebSocketMessage {
  type: 'subscribed';
  data: {
    accountId: string;
  };
}

export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'order_update';
  data: {
    order: Order;
  };
}

export interface FillUpdateMessage extends WebSocketMessage {
  type: 'fill_update';
  data: {
    fill: Fill;
  };
}

export interface PositionUpdateMessage extends WebSocketMessage {
  type: 'position_update';
  data: {
    position: Position;
  };
}

export interface AccountUpdateMessage extends WebSocketMessage {
  type: 'account_update';
  data: {
    account: Account;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping';
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong';
}

export type WebSocketEvent =
  | ConnectionMessage
  | SubscribeMessage
  | SubscribedMessage
  | OrderUpdateMessage
  | FillUpdateMessage
  | PositionUpdateMessage
  | AccountUpdateMessage
  | ErrorMessage
  | PingMessage
  | PongMessage;