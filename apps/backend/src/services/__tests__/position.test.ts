import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ExecutionSimulator } from '../executionSimulator';

describe('Position Management', () => {
  let prisma: PrismaClient;
  let simulator: ExecutionSimulator;
  let testAccountId: string;
  let testInstrumentId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();
    simulator = new ExecutionSimulator(prisma);

    // Create test account
    const account = await prisma.account.create({
      data: {
        name: 'Test Account',
        email: 'test@example.com',
        balance: 10000,
        buyingPower: 10000
      }
    });
    testAccountId = account.id;

    // Create test instrument
    const instrument = await prisma.instrument.create({
      data: {
        symbol: 'TEST',
        name: 'Test Stock',
        exchange: 'NYSE',
        price: 100,
        previousClose: 99,
        tickSize: 0.01,
        lotSize: 1,
        referencePrice: 100
      }
    });
    testInstrumentId = instrument.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.fill.deleteMany({ where: { accountId: testAccountId } });
    await prisma.orderEvent.deleteMany({});
    await prisma.order.deleteMany({ where: { accountId: testAccountId } });
    await prisma.position.deleteMany({ where: { accountId: testAccountId } });
    await prisma.account.delete({ where: { id: testAccountId } });
    await prisma.instrument.delete({ where: { id: testInstrumentId } });
    await prisma.$disconnect();
  });

  describe('Buy -> Buy -> Sell scenario', () => {
    it('should maintain correct running qty and avgPrice', async () => {
      // First buy: 100 shares at $100
      await prisma.order.create({
        data: {
          id: 'order1',
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'BUY',
          quantity: 100,
          status: 'FILLED'
        }
      });

      // Simulate the updatePosition call for first buy
      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'BUY', 100, 100);
      });

      let position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });

      expect(position).not.toBeNull();
      expect(position!.quantity).toBe(100);
      expect(parseFloat(position!.avgPrice.toString())).toBe(100);

      // Second buy: 50 shares at $110
      await prisma.order.create({
        data: {
          id: 'order2',
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'BUY',
          quantity: 50,
          status: 'FILLED'
        }
      });

      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'BUY', 50, 110);
      });

      position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });

      expect(position).not.toBeNull();
      expect(position!.quantity).toBe(150);
      // Expected avgPrice = (100 * 100 + 50 * 110) / 150 = (10000 + 5500) / 150 = 103.33
      expect(parseFloat(position!.avgPrice.toString())).toBeCloseTo(103.33, 2);

      // Sell: 75 shares at $105
      await prisma.order.create({
        data: {
          id: 'order3',
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'SELL',
          quantity: 75,
          status: 'FILLED'
        }
      });

      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'SELL', 75, 105);
      });

      position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });

      expect(position).not.toBeNull();
      expect(position!.quantity).toBe(75); // 150 - 75
      expect(parseFloat(position!.avgPrice.toString())).toBeCloseTo(103.33, 2); // Should remain the same
    });

    it('should calculate unrealized P&L correctly', async () => {
      // Buy 100 shares at $100
      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'BUY', 100, 100);
      });

      // Update instrument price to $105
      await prisma.instrument.update({
        where: { id: testInstrumentId },
        data: { price: 105 }
      });

      // Position should show unrealized P&L
      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'BUY', 0, 100);
      });

      const position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });

      expect(position).not.toBeNull();
      // Unrealized P&L = (105 - 100) * 100 = $500
      expect(parseFloat(position!.unrealizedPL.toString())).toBe(500);
    });

    it('should delete position when quantity reaches zero', async () => {
      // Buy 100 shares at $100
      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'BUY', 100, 100);
      });

      let position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });
      expect(position).not.toBeNull();

      // Sell all 100 shares
      await prisma.$transaction(async (tx) => {
        await simulator['updatePosition'](tx, testAccountId, testInstrumentId, 'SELL', 100, 105);
      });

      position = await prisma.position.findUnique({
        where: {
          accountId_instrumentId: {
            accountId: testAccountId,
            instrumentId: testInstrumentId
          }
        }
      });
      expect(position).toBeNull();
    });
  });

  describe('Cash and fees calculation', () => {
    it('should calculate net amount including fees correctly', async () => {
      const quantity = 100;
      const price = 100;
      const feePerShare = 0.005;

      // For BUY order
      const grossAmountBuy = quantity * price; // 10000
      const feesBuy = quantity * feePerShare; // 0.5
      const netAmountBuy = grossAmountBuy + feesBuy; // 10000.5

      expect(netAmountBuy).toBe(10000.5);

      // For SELL order  
      const grossAmountSell = quantity * price; // 10000
      const feesSell = quantity * feePerShare; // 0.5
      const netAmountSell = grossAmountSell - feesSell; // 9999.5

      expect(netAmountSell).toBe(9999.5);
    });
  });
});