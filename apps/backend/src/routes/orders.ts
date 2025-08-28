import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateBody, validateQuery } from '../middleware/validation';
import { createOrderSchema, getOrdersSchema, cancelOrderSchema } from '../validation/orderSchemas';
import { OrderEventService } from '../services/orderEventService';
import { RiskEngine } from '../services/riskEngine';
import { getSimulatorInstance } from './simulator';

const router = Router();
const prisma = new PrismaClient();

// Get all orders for an account
router.get('/', validateQuery(getOrdersSchema), async (req, res) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const orders = await prisma.order.findMany({
      where: { accountId },
      include: {
        instrument: true,
        fills: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create a new order
router.post('/', validateBody(createOrderSchema), async (req, res) => {
  try {
    const { accountId, ticker, type, side, quantity, price } = req.body;

    // Use transaction for atomic order creation + audit trail
    const result = await prisma.$transaction(async (tx) => {
      // Find or create instrument
      let instrument = await tx.instrument.findUnique({
        where: { symbol: ticker.toUpperCase() },
      });

      if (!instrument) {
        // Create instrument with mock data for demo
        instrument = await tx.instrument.create({
          data: {
            symbol: ticker.toUpperCase(),
            name: `${ticker.toUpperCase()} Company`,
            exchange: 'NASDAQ',
            tickSize: 0.01,
            lotSize: 1,
            referencePrice: price || 100,
            price: price || 100,
            previousClose: price || 100,
          },
        });
      }

      // Run risk checks BEFORE creating order
      const riskCheck = await RiskEngine.validateOrder({
        accountId,
        instrumentId: instrument.id,
        side,
        quantity,
        type,
        price,
      });

      let order;
      if (riskCheck.passed) {
        // Create order with PENDING status (will be filled immediately for MARKET orders)
        order = await tx.order.create({
          data: {
            accountId,
            instrumentId: instrument.id,
            type,
            side,
            quantity,
            price,
            status: 'PENDING',
          },
          include: {
            instrument: true,
          },
        });

        // Create ACCEPTED event
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            instrumentId: instrument.id,
            type: 'ACCEPTED',
            payload: {
              acceptedReason: 'Order passed all pre-trade risk checks',
              orderType: type,
              side,
              quantity,
              price,
            },
          },
        });
      } else {
        // Create order with REJECTED status
        order = await tx.order.create({
          data: {
            accountId,
            instrumentId: instrument.id,
            type,
            side,
            quantity,
            price,
            status: 'REJECTED',
          },
          include: {
            instrument: true,
          },
        });

        // Create REJECTED event with reasons
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            instrumentId: instrument.id,
            type: 'REJECTED',
            payload: {
              rejectedReasons: riskCheck.reasons,
              orderType: type,
              side,
              quantity,
              price,
            },
          },
        });
      }

      return { order, instrument };
    });

    const { order, instrument } = result;

    // Submit order to execution simulator if it was ACCEPTED by risk engine
    if (order.status === 'PENDING') {
      const simulator = getSimulatorInstance();
      await simulator.addPendingOrder({
        id: order.id,
        accountId,
        instrumentId: instrument.id,
        type,
        side,
        quantity,
        price
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Transaction-safe version of updatePosition
async function updatePositionInTransaction(tx: any, accountId: string, instrumentId: string, side: string, quantity: number, price: number, instrument: any) {
  const existingPosition = await tx.position.findUnique({
    where: {
      accountId_instrumentId: {
        accountId,
        instrumentId,
      },
    },
  });

  if (existingPosition) {
    // Update existing position
    const currentQty = existingPosition.quantity;
    const currentAvgPrice = parseFloat(existingPosition.avgPrice.toString());
    
    let newQty: number;
    let newAvgPrice: number;
    
    if (side === 'BUY') {
      newQty = currentQty + quantity;
      newAvgPrice = ((currentQty * currentAvgPrice) + (quantity * price)) / newQty;
    } else {
      newQty = currentQty - quantity;
      newAvgPrice = currentAvgPrice; // Avg price doesn't change on sells
    }
    
    const marketValue = newQty * parseFloat(instrument.price.toString());
    const unrealizedPL = (parseFloat(instrument.price.toString()) - newAvgPrice) * newQty;

    if (newQty === 0) {
      // Close position
      await tx.position.delete({
        where: { id: existingPosition.id },
      });
    } else {
      await tx.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: newQty,
          avgPrice: newAvgPrice,
          marketValue,
          unrealizedPL,
        },
      });
    }
  } else if (side === 'BUY') {
    // Create new position (only for buys)
    const marketValue = quantity * parseFloat(instrument.price.toString());
    const unrealizedPL = (parseFloat(instrument.price.toString()) - price) * quantity;

    await tx.position.create({
      data: {
        accountId,
        instrumentId,
        quantity,
        avgPrice: price,
        marketValue,
        unrealizedPL,
      },
    });
  }
}

// Legacy non-transactional version (keeping for compatibility)
async function updatePosition(accountId: string, instrumentId: string, side: string, quantity: number, price: number) {
  const existingPosition = await prisma.position.findUnique({
    where: {
      accountId_instrumentId: {
        accountId,
        instrumentId,
      },
    },
  });

  const instrument = await prisma.instrument.findUnique({
    where: { id: instrumentId },
  });

  if (!instrument) return;

  if (existingPosition) {
    // Update existing position
    const currentQty = existingPosition.quantity;
    const currentAvgPrice = parseFloat(existingPosition.avgPrice.toString());
    
    let newQty: number;
    let newAvgPrice: number;
    
    if (side === 'BUY') {
      newQty = currentQty + quantity;
      newAvgPrice = ((currentQty * currentAvgPrice) + (quantity * price)) / newQty;
    } else {
      newQty = currentQty - quantity;
      newAvgPrice = currentAvgPrice; // Avg price doesn't change on sells
    }
    
    const marketValue = newQty * parseFloat(instrument.price.toString());
    const unrealizedPL = (parseFloat(instrument.price.toString()) - newAvgPrice) * newQty;

    if (newQty === 0) {
      // Close position
      await prisma.position.delete({
        where: { id: existingPosition.id },
      });
    } else {
      await prisma.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: newQty,
          avgPrice: newAvgPrice,
          marketValue,
          unrealizedPL,
        },
      });
    }
  } else if (side === 'BUY') {
    // Create new position (only for buys)
    const marketValue = quantity * parseFloat(instrument.price.toString());
    const unrealizedPL = (parseFloat(instrument.price.toString()) - price) * quantity;

    await prisma.position.create({
      data: {
        accountId,
        instrumentId,
        quantity,
        avgPrice: price,
        marketValue,
        unrealizedPL,
      },
    });
  }
}

// Cancel an order
router.post('/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order can be cancelled (only PENDING or PARTIALLY_FILLED orders)
    if (!['PENDING', 'PARTIALLY_FILLED'].includes(order.status)) {
      return res.status(400).json({ 
        error: `Cannot cancel order with status ${order.status}. Only PENDING or PARTIALLY_FILLED orders can be cancelled.` 
      });
    }

    // Update order status to CANCELLED with audit trail
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: {
          instrument: true,
        },
      });

      // Create CANCELED event
      await tx.orderEvent.create({
        data: {
          orderId: orderId,
          instrumentId: order.instrumentId,
          type: 'CANCELED',
          payload: {
            canceledReason: 'User requested cancellation',
            canceledBy: 'user',
            canceledAt: new Date().toISOString(),
            previousStatus: order.status,
          },
        },
      });

      return updatedOrder;
    });

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Get order events (audit trail) for a specific order
router.get('/:orderId/events', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const events = await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { timestamp: 'asc' },
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching order events:', error);
    res.status(500).json({ error: 'Failed to fetch order events' });
  }
});

// Reset (delete) all orders for an account
router.delete('/', async (req, res) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Delete all orders and related data for the account in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // First get all order IDs for this account
      const orders = await tx.order.findMany({
        where: { accountId },
        select: { id: true }
      });

      const orderIds = orders.map(order => order.id);

      // Delete order events for all orders
      const deletedEvents = await tx.orderEvent.deleteMany({
        where: { orderId: { in: orderIds } }
      });

      // Delete all fills for this account
      const deletedFills = await tx.fill.deleteMany({
        where: { accountId }
      });

      // Delete all orders for the account
      const deletedOrders = await tx.order.deleteMany({
        where: { accountId }
      });

      return {
        deletedOrders: deletedOrders.count,
        deletedEvents: deletedEvents.count,
        deletedFills: deletedFills.count
      };
    });

    res.json({ 
      success: true,
      message: `Reset successful: ${result.deletedOrders} orders, ${result.deletedEvents} events, and ${result.deletedFills} fills cleared`,
      deletedOrders: result.deletedOrders,
      deletedEvents: result.deletedEvents,
      deletedFills: result.deletedFills
    });
  } catch (error) {
    console.error('Error resetting orders:', error);
    res.status(500).json({ error: 'Failed to reset orders' });
  }
});

export default router;