import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get account information
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Create demo account
router.post('/demo', async (req, res) => {
  try {
    const account = await prisma.account.create({
      data: {
        name: 'Demo User',
        email: 'demo@example.com',
        balance: 100000,
        buyingPower: 100000,
      },
    });

    res.json(account);
  } catch (error) {
    console.error('Error creating demo account:', error);
    res.status(500).json({ error: 'Failed to create demo account' });
  }
});

export default router;