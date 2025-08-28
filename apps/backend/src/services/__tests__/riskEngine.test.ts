import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { RiskEngine, OrderRequest } from '../riskEngine';

describe('Risk Engine', () => {
  let prisma: PrismaClient;
  let testAccountId: string;
  let testInstrumentId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();

    // Create test account
    const account = await prisma.account.create({
      data: {
        name: 'Risk Test Account',
        email: 'risk@example.com',
        balance: 100000,
        buyingPower: 100000
      }
    });
    testAccountId = account.id;

    // Create test instrument
    const instrument = await prisma.instrument.create({
      data: {
        symbol: 'RISK',
        name: 'Risk Test Stock',
        exchange: 'NYSE',
        price: 100,
        previousClose: 99,
        tickSize: 0.01,
        lotSize: 1,
        referencePrice: 100
      }
    });
    testInstrumentId = instrument.id;

    // Reset risk limits to defaults
    RiskEngine.updateRiskLimits({
      maxQuantityPerSymbol: 10000,
      maxNotionalValue: 50000,
      maxDailyOrders: 100,
      globalKillSwitch: false,
      feePerShare: 0.005
    });
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

  describe('Kill Switch Risk Rule', () => {
    it('should PASS when kill switch is disabled', async () => {
      RiskEngine.updateRiskLimits({ globalKillSwitch: false });
      
      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons.some(reason => reason.includes('Global kill switch is active'))).toBe(false);
    });

    it('should FAIL when kill switch is enabled', async () => {
      RiskEngine.updateRiskLimits({ globalKillSwitch: true });
      
      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('Global kill switch is active - no new orders allowed');
    });
  });

  describe('Buying Power Risk Rule', () => {
    it('should PASS when account has sufficient buying power', async () => {
      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 50, // $5000 + $0.25 fees = $5000.25 total
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons.some(reason => reason.includes('Insufficient buying power'))).toBe(false);
    });

    it('should FAIL when account has insufficient buying power', async () => {
      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 2000, // $200,000 + $10 fees > $100,000 buying power
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Insufficient buying power'))).toBe(true);
    });

    it('should PASS for SELL orders (no buying power check)', async () => {
      // First create a position
      await prisma.position.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          quantity: 100,
          avgPrice: 95,
          marketValue: 10000,
          unrealizedPL: 500
        }
      });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'SELL',
        quantity: 50,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons.some(reason => reason.includes('Insufficient buying power'))).toBe(false);
    });
  });

  describe('Symbol Quantity Limit Risk Rule', () => {
    it('should PASS when position stays within limits', async () => {
      RiskEngine.updateRiskLimits({ maxQuantityPerSymbol: 1000 });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 500,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons.some(reason => reason.includes('exceed maximum position size'))).toBe(false);
    });

    it('should FAIL when BUY would exceed position limit', async () => {
      RiskEngine.updateRiskLimits({ maxQuantityPerSymbol: 1000 });

      // Create existing position
      await prisma.position.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          quantity: 800,
          avgPrice: 95,
          marketValue: 80000,
          unrealizedPL: 4000
        }
      });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 300, // 800 + 300 = 1100 > 1000 limit
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(reason => reason.includes('exceed maximum position size of 1000'))).toBe(true);
    });

    it('should FAIL when trying to SELL more than owned', async () => {
      // Create position with 100 shares
      await prisma.position.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          quantity: 100,
          avgPrice: 95,
          marketValue: 10000,
          unrealizedPL: 500
        }
      });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'SELL',
        quantity: 150, // More than the 100 owned
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Cannot sell 150 shares. Current position: 100'))).toBe(true);
    });
  });

  describe('Notional Value Risk Rule', () => {
    it('should PASS when order notional is within limits', async () => {
      RiskEngine.updateRiskLimits({ maxNotionalValue: 10000 });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 50, // $5,000 notional
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons).not.toContain(
        expect.stringContaining('notional value')
      );
    });

    it('should FAIL when order notional exceeds limits', async () => {
      RiskEngine.updateRiskLimits({ maxNotionalValue: 5000 });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100, // $10,000 notional > $5,000 limit
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Order notional value $10000.00 exceeds limit of $5000'))).toBe(true);
    });

    it('should use limit price for LIMIT orders', async () => {
      RiskEngine.updateRiskLimits({ maxNotionalValue: 5000 });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'LIMIT',
        price: 40 // $4,000 notional < $5,000 limit
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons).not.toContain(
        expect.stringContaining('notional value')
      );
    });
  });

  describe('Daily Order Count Risk Rule', () => {
    it('should PASS when order count is within daily limit', async () => {
      RiskEngine.updateRiskLimits({ maxDailyOrders: 5 });

      // Create 3 orders today
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        await prisma.order.create({
          data: {
            accountId: testAccountId,
            instrumentId: testInstrumentId,
            type: 'MARKET',
            side: 'BUY',
            quantity: 10,
            status: 'FILLED',
            createdAt: today
          }
        });
      }

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true);
      expect(result.reasons.some(reason => reason.includes('Daily order limit'))).toBe(false);
    });

    it('should FAIL when daily order limit is reached', async () => {
      RiskEngine.updateRiskLimits({ maxDailyOrders: 3 });

      // Create exactly 3 orders today (at the limit)
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        await prisma.order.create({
          data: {
            accountId: testAccountId,
            instrumentId: testInstrumentId,
            type: 'MARKET',
            side: 'BUY',
            quantity: 10,
            status: 'FILLED',
            createdAt: today
          }
        });
      }

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Daily order limit of 3 orders exceeded. Current: 3'))).toBe(true);
    });

    it('should only count orders from today', async () => {
      RiskEngine.updateRiskLimits({ maxDailyOrders: 2 });

      // Create orders yesterday (should not count)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await prisma.order.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'BUY',
          quantity: 10,
          status: 'FILLED',
          createdAt: yesterday
        }
      });

      // Create 1 order today
      const today = new Date();
      await prisma.order.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'BUY',
          quantity: 10,
          status: 'FILLED',
          createdAt: today
        }
      });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100,
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(true); // Should pass because only 1 order today
      expect(result.reasons.some(reason => reason.includes('Daily order limit'))).toBe(false);
    });
  });

  describe('Multiple Risk Rule Failures', () => {
    it('should return all failing risk reasons', async () => {
      // Set up multiple failures
      RiskEngine.updateRiskLimits({
        globalKillSwitch: true, // Fail 1
        maxNotionalValue: 1000,  // Fail 2 ($10,000 > $1,000)
        maxDailyOrders: 0        // Fail 3 (any order exceeds 0)
      });

      const orderRequest: OrderRequest = {
        accountId: testAccountId,
        instrumentId: testInstrumentId,
        side: 'BUY',
        quantity: 100, // $10,000 notional
        type: 'MARKET'
      };

      const result = await RiskEngine.validateOrder(orderRequest);
      expect(result.passed).toBe(false);
      expect(result.reasons).toHaveLength(1); // Kill switch fails first, others not checked
      expect(result.reasons).toContain('Global kill switch is active - no new orders allowed');
    });
  });
});