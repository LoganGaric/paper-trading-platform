import { z } from 'zod';

export const createOrderSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  ticker: z.string().min(1, 'Ticker is required').max(10, 'Ticker must be 10 characters or less'),
  type: z.enum(['MARKET', 'LIMIT'], { message: 'Type must be MARKET or LIMIT' }),
  side: z.enum(['BUY', 'SELL'], { message: 'Side must be BUY or SELL' }),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  price: z.number().positive('Price must be positive').optional()
}).refine((data) => {
  // For LIMIT orders, price is required
  if (data.type === 'LIMIT' && !data.price) {
    return false;
  }
  return true;
}, {
  message: 'Price is required for LIMIT orders',
  path: ['price']
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required')
});

export const getOrdersSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required')
});

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderSchema>;
export type GetOrdersRequest = z.infer<typeof getOrdersSchema>;