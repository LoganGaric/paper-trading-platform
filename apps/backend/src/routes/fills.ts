import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all fills for an account
router.get('/', async (req, res) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const fills = await prisma.fill.findMany({
      where: { accountId },
      include: {
        instrument: true,
        order: true,
      },
      orderBy: { executedAt: 'desc' },
    });

    res.json(fills);
  } catch (error) {
    console.error('Error fetching fills:', error);
    res.status(500).json({ error: 'Failed to fetch fills' });
  }
});

export default router;