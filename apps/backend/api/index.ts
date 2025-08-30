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
    'https://paper-trading-platform-g5vrw7wnm-logan-garics-projects.vercel.app',
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

// Create order endpoint
app.post('/api/orders', async (req, res) => {
  try {
    const { accountId, ticker, type, side, quantity, price } = req.body;

    if (!accountId || !ticker || !type || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the instrument by symbol
    const instrument = await prisma.instrument.findUnique({
      where: { symbol: ticker }
    });

    if (!instrument) {
      return res.status(404).json({ error: 'Instrument not found' });
    }

    // Create the order
    const order = await prisma.order.create({
      data: {
        accountId: String(accountId),
        instrumentId: instrument.id,
        type: type.toUpperCase(),
        side: side.toUpperCase(),
        quantity: parseInt(quantity),
        price: price ? parseFloat(price) : null,
        status: 'FILLED', // Auto-fill orders for demo
        filledAt: new Date()
      },
      include: {
        instrument: true,
        fills: true
      }
    });

    // Create a fill record
    const fill = await prisma.fill.create({
      data: {
        orderId: order.id,
        accountId: String(accountId),
        instrumentId: instrument.id,
        quantity: parseInt(quantity),
        price: price ? parseFloat(price) : parseFloat(instrument.price),
        side: side.toUpperCase(),
        executedAt: new Date()
      }
    });

    res.json({ ...order, fills: [fill] });
  } catch (error) {
    console.error('Error creating order:', error);
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

// Simple simulator status endpoint with price simulation
app.get('/api/simulator/status', async (req, res) => {
  try {
    console.log('Attempting to connect to database...');
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true }
    });
    console.log('Found instruments:', instruments.length);

    // Simulate price changes (±2% random movement)
    const currentPrices = instruments.map((inst) => {
      const basePrice = Number(inst.referencePrice || inst.price);
      const volatility = 0.02; // 2% max movement
      const randomChange = (Math.random() - 0.5) * volatility;
      const newPrice = basePrice * (1 + randomChange);
      const previousClose = Number(inst.previousClose);
      
      const change = newPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      
      return {
        symbol: inst.symbol,
        price: Number(newPrice.toFixed(2)),
        previousClose: previousClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2))
      };
    });

    res.json({
      isRunning: true,
      currentPrices
    });
  } catch (error) {
    console.error('Error fetching simulator status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Database seeding endpoint
app.post('/api/seed', async (req, res) => {
  try {
    // Check if already seeded
    const existingInstruments = await prisma.instrument.count();
    if (existingInstruments > 0) {
      return res.json({ message: 'Database already seeded', count: existingInstruments });
    }

    // Create demo account
    const account = await prisma.account.create({
      data: {
        name: 'Demo Trading Account',
        email: 'demo@papertrading.com',
        balance: 100000.00,
        buyingPower: 100000.00,
      }
    });

    // Create instruments with current market data
    const instrumentsData = [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', exchange: 'NASDAQ', tickSize: 0.01, lotSize: 1, referencePrice: 229.15, price: 229.15, previousClose: 227.76, isActive: true },
      { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', tickSize: 0.01, lotSize: 1, referencePrice: 333.25, price: 333.25, previousClose: 344.72, isActive: true },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', exchange: 'NASDAQ', tickSize: 0.01, lotSize: 1, referencePrice: 212.91, price: 212.91, previousClose: 211.64, isActive: true },
      { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', exchange: 'NASDAQ', tickSize: 0.01, lotSize: 1, referencePrice: 213.53, price: 213.53, previousClose: 212.37, isActive: true },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', exchange: 'NASDAQ', tickSize: 0.01, lotSize: 1, referencePrice: 180.78, price: 180.78, previousClose: 181.60, isActive: true },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', sector: 'ETF', exchange: 'NYSEARCA', tickSize: 0.01, lotSize: 1, referencePrice: 646.03, price: 646.03, previousClose: 650.18, isActive: true }
    ];

    const instruments = await Promise.all(
      instrumentsData.map(data => prisma.instrument.create({ data }))
    );

    res.json({ 
      message: 'Database seeded successfully!',
      account: account.id,
      instruments: instruments.length
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Seeding failed: ' + error.message });
  }
});

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;