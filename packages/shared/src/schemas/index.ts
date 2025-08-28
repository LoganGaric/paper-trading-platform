import { z } from 'zod';

export const OrderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);
export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export const OrderStatusSchema = z.enum(['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']);
export const TimeInForceSchema = z.enum(['DAY', 'GTC', 'IOC', 'FOK']);

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  balance: z.number(),
  buyingPower: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SymbolSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  sector: z.string().optional(),
  exchange: z.string(),
  price: z.number(),
  previousClose: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const OrderSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  symbolId: z.string(),
  type: OrderTypeSchema,
  side: OrderSideSchema,
  quantity: z.number().int().positive(),
  price: z.number().positive().optional(),
  status: OrderStatusSchema,
  timeInForce: TimeInForceSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  filledAt: z.date().optional(),
  cancelledAt: z.date().optional(),
});

export const CreateOrderSchema = z.object({
  symbolId: z.string(),
  type: OrderTypeSchema,
  side: OrderSideSchema,
  quantity: z.number().int().positive(),
  price: z.number().positive().optional(),
  timeInForce: TimeInForceSchema.default('DAY'),
});

export const FillSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  accountId: z.string(),
  symbolId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  side: OrderSideSchema,
  executedAt: z.date(),
});

export const PositionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  symbolId: z.string(),
  quantity: z.number().int(),
  avgPrice: z.number(),
  marketValue: z.number(),
  unrealizedPL: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const MarketDataSchema = z.object({
  id: z.string(),
  symbolId: z.string(),
  timestamp: z.date(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;