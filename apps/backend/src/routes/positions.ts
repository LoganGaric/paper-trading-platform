import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all positions for an account
router.get('/', async (req, res) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const positions = await prisma.position.findMany({
      where: { 
        accountId,
        quantity: { not: 0 }, // Only show non-zero positions
      },
      include: {
        instrument: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Reset (delete) all positions, orders, and fills for an account
router.delete('/', async (req, res) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Delete all trading data for the account in a comprehensive transaction
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

      // Delete all positions for the account
      const deletedPositions = await tx.position.deleteMany({
        where: { accountId }
      });

      return {
        deletedPositions: deletedPositions.count,
        deletedOrders: deletedOrders.count,
        deletedEvents: deletedEvents.count,
        deletedFills: deletedFills.count
      };
    });

    res.json({ 
      success: true,
      message: `Complete reset successful: ${result.deletedPositions} positions, ${result.deletedOrders} orders, ${result.deletedEvents} events, and ${result.deletedFills} fills cleared`,
      deletedPositions: result.deletedPositions,
      deletedOrders: result.deletedOrders,
      deletedEvents: result.deletedEvents,
      deletedFills: result.deletedFills
    });
  } catch (error) {
    console.error('Error resetting account data:', error);
    res.status(500).json({ error: 'Failed to reset account data' });
  }
});

export default router;