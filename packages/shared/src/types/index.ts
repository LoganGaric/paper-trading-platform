export interface Account {
  id: string;
  name: string;
  email: string;
  balance: number;
  buyingPower: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Symbol {
  id: string;
  ticker: string;
  name: string;
  sector?: string;
  exchange: string;
  price: number;
  previousClose: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  accountId: string;
  symbolId: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

export interface Fill {
  id: string;
  orderId: string;
  accountId: string;
  symbolId: string;
  quantity: number;
  price: number;
  side: OrderSide;
  executedAt: Date;
}

export interface Position {
  id: string;
  accountId: string;
  symbolId: string;
  quantity: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPL: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketData {
  id: string;
  symbolId: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum TimeInForce {
  DAY = 'DAY',
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
}