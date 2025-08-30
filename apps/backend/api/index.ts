import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? '*' : [
    process.env.CORS_ORIGIN,
    'https://paper-trading-platform-fz6rfgomb-logan-garics-projects.vercel.app',
    /\.vercel\.app$/
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Paper Trading Platform API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple orders endpoint
app.get('/api/orders', async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const orders = await prisma.order.findMany({
      where: { accountId: String(accountId) },
      include: {
        instrument: true,
        fills: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple positions endpoint  
app.get('/api/positions', async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const positions = await prisma.position.findMany({
      where: { accountId: String(accountId) },
      include: {
        instrument: true
      }
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple simulator status endpoint
app.get('/api/simulator/status', async (req, res) => {
  try {
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true }
    });

    const currentPrices = instruments.map(inst => ({
      symbol: inst.symbol,
      price: Number(inst.price),
      previousClose: Number(inst.previousClose)
    }));

    res.json({
      isRunning: true,
      currentPrices
    });
  } catch (error) {
    console.error('Error fetching simulator status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;