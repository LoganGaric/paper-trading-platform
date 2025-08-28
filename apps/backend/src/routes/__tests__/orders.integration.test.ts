import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { RiskEngine } from '../../services/riskEngine';
import ordersRoutes from '../orders';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);

describe('POST /orders Integration Tests', () => {
  let prisma: PrismaClient;
  let testAccountId: string;
  let testInstrumentId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test account with sufficient funds
    const account = await prisma.account.create({
      data: {
        name: 'Integration Test Account',
        email: 'integration@example.com',
        balance: 50000,
        buyingPower: 50000
      }
    });
    testAccountId = account.id;

    // Create test instrument
    const instrument = await prisma.instrument.create({
      data: {
        symbol: 'INTEG',
        name: 'Integration Test Stock',
        exchange: 'NYSE',
        price: 100,
        previousClose: 99,
        tickSize: 0.01,
        lotSize: 1,
        referencePrice: 100
      }
    });
    testInstrumentId = instrument.id;

    // Reset risk limits to permissive defaults
    RiskEngine.updateRiskLimits({
      maxQuantityPerSymbol: 10000,
      maxNotionalValue: 100000,
      maxDailyOrders: 1000,
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
  });

  describe('Happy Path - Order Acceptance', () => {
    it('should accept valid MARKET BUY order', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        accountId: testAccountId,
        type: 'MARKET',
        side: 'BUY',
        quantity: 100,
        status: 'PENDING'
      });

      // Verify order was created in database
      const dbOrder = await prisma.order.findUnique({
        where: { id: response.body.id }
      });
      expect(dbOrder).toBeTruthy();
      expect(dbOrder?.status).toBe('PENDING');

      // Verify order event was created
      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id }
      });
      expect(orderEvents).toHaveLength(1);
      expect(orderEvents[0].type).toBe('ACCEPTED');
    });

    it('should accept valid LIMIT SELL order', async () => {
      // First create a position to sell
      await prisma.position.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          quantity: 200,
          avgPrice: 95,
          marketValue: 20000,
          unrealizedPL: 1000
        }
      });

      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 50,
        price: 105.50
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        accountId: testAccountId,
        type: 'LIMIT',
        side: 'SELL',
        quantity: 50,
        status: 'PENDING'
      });

      expect(response.body.price).toBe('105.5'); // Stored as string
    });

    it('should require price for LIMIT orders', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100
        // Missing price
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('Rejection Path - Risk Violations', () => {
    it('should reject order when kill switch is active', async () => {
      // Enable kill switch
      RiskEngine.updateRiskLimits({ globalKillSwitch: true });

      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201); // Order still gets created but with REJECTED status

      expect(response.body.status).toBe('REJECTED');

      // Verify rejection reason in order event
      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id, type: 'REJECTED' }
      });
      expect(orderEvents).toHaveLength(1);
      expect(orderEvents[0].payload).toMatchObject({
        rejectedReasons: expect.arrayContaining([
          'Global kill switch is active - no new orders allowed'
        ])
      });
    });

    it('should reject order with insufficient buying power', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: 1000 // $100,000 > $50,000 buying power
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body.status).toBe('REJECTED');

      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id, type: 'REJECTED' }
      });
      expect(orderEvents[0].payload.rejectedReasons[0]).toContain('Insufficient buying power');
    });

    it('should reject sell order for more shares than owned', async () => {
      // Create position with only 50 shares
      await prisma.position.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          quantity: 50,
          avgPrice: 95,
          marketValue: 5000,
          unrealizedPL: 250
        }
      });

      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'SELL',
        quantity: 100 // More than the 50 owned
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body.status).toBe('REJECTED');

      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id, type: 'REJECTED' }
      });
      expect(orderEvents[0].payload.rejectedReasons[0]).toContain('Cannot sell 100 shares. Current position: 50');
    });

    it('should reject order exceeding notional limit', async () => {
      RiskEngine.updateRiskLimits({ maxNotionalValue: 5000 });

      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100 // $10,000 > $5,000 limit
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body.status).toBe('REJECTED');

      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id, type: 'REJECTED' }
      });
      expect(orderEvents[0].payload.rejectedReasons[0]).toContain('Order notional value $10000.00 exceeds limit of $5000');
    });

    it('should reject order exceeding daily order limit', async () => {
      RiskEngine.updateRiskLimits({ maxDailyOrders: 2 });

      // Create 2 orders today (at the limit)
      const today = new Date();
      for (let i = 0; i < 2; i++) {
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

      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: 10
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      expect(response.body.status).toBe('REJECTED');

      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId: response.body.id, type: 'REJECTED' }
      });
      expect(orderEvents[0].payload.rejectedReasons[0]).toContain('Daily order limit of 2 orders exceeded');
    });
  });

  describe('Order Cancellation', () => {
    it('should successfully cancel ACCEPTED order', async () => {
      // First create an order
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        price: 95.00
      };

      const createResponse = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(201);

      const orderId = createResponse.body.id;
      expect(createResponse.body.status).toBe('PENDING');

      // Then cancel it
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .expect(200);

      expect(cancelResponse.body.message).toBe('Order cancelled successfully');

      // Verify order status is updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId }
      });
      expect(updatedOrder?.status).toBe('CANCELLED');

      // Verify cancellation event was created
      const orderEvents = await prisma.orderEvent.findMany({
        where: { orderId, type: 'CANCELED' }
      });
      expect(orderEvents).toHaveLength(1);
    });

    it('should not allow cancelling FILLED order', async () => {
      // Create a filled order
      const order = await prisma.order.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'MARKET',
          side: 'BUY',
          quantity: 100,
          status: 'FILLED'
        }
      });

      const response = await request(app)
        .post(`/api/orders/${order.id}/cancel`)
        .expect(400);

      expect(response.body.error).toContain('Cannot cancel order with status');
    });

    it('should not allow cancelling CANCELLED order', async () => {
      // Create a cancelled order
      const order = await prisma.order.create({
        data: {
          accountId: testAccountId,
          instrumentId: testInstrumentId,
          type: 'LIMIT',
          side: 'BUY',
          quantity: 100,
          price: 95,
          status: 'CANCELLED'
        }
      });

      const response = await request(app)
        .post(`/api/orders/${order.id}/cancel`)
        .expect(400);

      expect(response.body.error).toContain('Cannot cancel order with status');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .post('/api/orders/non-existent-id/cancel')
        .expect(404);

      expect(response.body.error).toBe('Order not found');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({}) // Empty request
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });

    it('should validate side enum values', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'INVALID',
        quantity: 100
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });

    it('should validate positive quantity', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'MARKET',
        side: 'BUY',
        quantity: -10
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });

    it('should validate positive price for limit orders', async () => {
      const orderRequest = {
        accountId: testAccountId,
        ticker: 'INTEG',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        price: -5.00
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderRequest)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });
  });
});