import { describe, it, expect, beforeEach } from '@jest/globals';
import { MatchingEngine, OrderBookEntry, MarketData } from '../matchingEngine';

describe('Matching Engine', () => {
  let engine: MatchingEngine;
  let marketData: MarketData;

  beforeEach(() => {
    engine = new MatchingEngine();
    marketData = {
      bid: 99.95,
      ask: 100.05,
      last: 100.00
    };
  });

  describe('Price-Time Priority', () => {
    it('should prioritize higher prices for buy orders', () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T10:00:01Z');

      // Add two buy orders at different prices
      const buyOrder1: OrderBookEntry = {
        orderId: 'buy1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.50, // Lower price but earlier time
        createdAt: time1
      };

      const buyOrder2: OrderBookEntry = {
        orderId: 'buy2',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 101.00, // Higher price but later time
        createdAt: time2
      };

      engine.addOrder(buyOrder1);
      engine.addOrder(buyOrder2);

      const orderBook = engine.getOrderBook();
      
      // Higher price should be first (buy2 should be before buy1)
      expect(orderBook.buys[0].orderId).toBe('buy2');
      expect(orderBook.buys[1].orderId).toBe('buy1');
    });

    it('should prioritize lower prices for sell orders', () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T10:00:01Z');

      const sellOrder1: OrderBookEntry = {
        orderId: 'sell1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 100,
        remainingQuantity: 100,
        price: 101.00, // Higher price but earlier time
        createdAt: time1
      };

      const sellOrder2: OrderBookEntry = {
        orderId: 'sell2',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.50, // Lower price but later time
        createdAt: time2
      };

      engine.addOrder(sellOrder1);
      engine.addOrder(sellOrder2);

      const orderBook = engine.getOrderBook();
      
      // Lower price should be first (sell2 should be before sell1)
      expect(orderBook.sells[0].orderId).toBe('sell2');
      expect(orderBook.sells[1].orderId).toBe('sell1');
    });

    it('should prioritize earlier time for same prices', () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T10:00:01Z');

      const buyOrder1: OrderBookEntry = {
        orderId: 'buy1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.00, // Same price, earlier time
        createdAt: time1
      };

      const buyOrder2: OrderBookEntry = {
        orderId: 'buy2',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.00, // Same price, later time
        createdAt: time2
      };

      engine.addOrder(buyOrder1);
      engine.addOrder(buyOrder2);

      const orderBook = engine.getOrderBook();
      
      // Earlier time should be first (buy1 should be before buy2)
      expect(orderBook.buys[0].orderId).toBe('buy1');
      expect(orderBook.buys[1].orderId).toBe('buy2');
    });

    it('should prioritize market orders over limit orders', () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T10:00:01Z');

      const limitBuy: OrderBookEntry = {
        orderId: 'limit1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 105.00, // High price but limit order, earlier time
        createdAt: time1
      };

      const marketBuy: OrderBookEntry = {
        orderId: 'market1',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        createdAt: time2 // Later time but market order
      };

      engine.addOrder(limitBuy);
      engine.addOrder(marketBuy);

      const orderBook = engine.getOrderBook();
      
      // Market order should be first
      expect(orderBook.buys[0].orderId).toBe('market1');
      expect(orderBook.buys[1].orderId).toBe('limit1');
    });
  });

  describe('Partial Fills', () => {
    it('should handle partial fills when order sizes differ', () => {
      const buyOrder: OrderBookEntry = {
        orderId: 'buy1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.50,
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      const sellOrder: OrderBookEntry = {
        orderId: 'sell1',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 60, // Smaller than buy order
        remainingQuantity: 60,
        price: 100.00,
        createdAt: new Date('2024-01-01T10:00:01Z')
      };

      engine.addOrder(buyOrder);
      engine.addOrder(sellOrder);

      const fills = engine.matchOrders(marketData);

      expect(fills).toHaveLength(1);
      expect(fills[0].quantity).toBe(60); // Partial fill
      expect(fills[0].buyOrderId).toBe('buy1');
      expect(fills[0].sellOrderId).toBe('sell1');

      const orderBook = engine.getOrderBook();
      // Buy order should have remaining quantity, sell order should be gone
      expect(orderBook.buys).toHaveLength(1);
      expect(orderBook.buys[0].remainingQuantity).toBe(40);
      expect(orderBook.sells).toHaveLength(0);
    });

    it('should handle multiple partial fills against one large order', () => {
      const largeBuy: OrderBookEntry = {
        orderId: 'buy_large',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 200,
        remainingQuantity: 200,
        price: 100.50,
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      const smallSell1: OrderBookEntry = {
        orderId: 'sell1',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 50,
        remainingQuantity: 50,
        price: 100.00,
        createdAt: new Date('2024-01-01T10:00:01Z')
      };

      const smallSell2: OrderBookEntry = {
        orderId: 'sell2',
        accountId: 'acc3',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 80,
        remainingQuantity: 80,
        price: 100.25,
        createdAt: new Date('2024-01-01T10:00:02Z')
      };

      engine.addOrder(largeBuy);
      engine.addOrder(smallSell1);
      engine.addOrder(smallSell2);

      const fills = engine.matchOrders(marketData);

      expect(fills).toHaveLength(2);
      
      // First fill: 50 shares at lower price
      expect(fills[0].quantity).toBe(50);
      expect(fills[0].sellOrderId).toBe('sell1');
      
      // Second fill: 80 shares at higher price
      expect(fills[1].quantity).toBe(80);
      expect(fills[1].sellOrderId).toBe('sell2');

      const orderBook = engine.getOrderBook();
      // Buy order should have 70 remaining (200 - 50 - 80)
      expect(orderBook.buys[0].remainingQuantity).toBe(70);
      expect(orderBook.sells).toHaveLength(0);
    });

    it('should not match if prices do not cross', () => {
      const buyOrder: OrderBookEntry = {
        orderId: 'buy1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 99.50, // Lower than sell price
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      const sellOrder: OrderBookEntry = {
        orderId: 'sell1',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.50, // Higher than buy price
        createdAt: new Date('2024-01-01T10:00:01Z')
      };

      engine.addOrder(buyOrder);
      engine.addOrder(sellOrder);

      const fills = engine.matchOrders(marketData);

      expect(fills).toHaveLength(0);
      
      const orderBook = engine.getOrderBook();
      expect(orderBook.buys).toHaveLength(1);
      expect(orderBook.sells).toHaveLength(1);
    });
  });

  describe('Market Orders', () => {
    it('should execute market buy at ask price', () => {
      const marketBuy: OrderBookEntry = {
        orderId: 'market_buy',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        createdAt: new Date()
      };

      engine.addOrder(marketBuy);
      const fills = engine.matchOrders(marketData);

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe(marketData.ask);
      expect(fills[0].quantity).toBe(100);
      expect(fills[0].sellOrderId).toBe('MARKET');
    });

    it('should execute market sell at bid price', () => {
      const marketSell: OrderBookEntry = {
        orderId: 'market_sell',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'MARKET',
        side: 'SELL',
        quantity: 50,
        remainingQuantity: 50,
        createdAt: new Date()
      };

      engine.addOrder(marketSell);
      const fills = engine.matchOrders(marketData);

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe(marketData.bid);
      expect(fills[0].quantity).toBe(50);
      expect(fills[0].buyOrderId).toBe('MARKET');
    });
  });

  describe('Order Cancellation', () => {
    it('should successfully cancel an existing order', () => {
      const order: OrderBookEntry = {
        orderId: 'cancel_me',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.00,
        createdAt: new Date()
      };

      engine.addOrder(order);
      expect(engine.getOrderBook().buys).toHaveLength(1);

      const cancelled = engine.cancelOrder('cancel_me');
      expect(cancelled).toBe(true);
      expect(engine.getOrderBook().buys).toHaveLength(0);
    });

    it('should return false when trying to cancel non-existent order', () => {
      const cancelled = engine.cancelOrder('non_existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('Best Bid/Ask', () => {
    it('should return correct best bid and ask', () => {
      const buyOrder1: OrderBookEntry = {
        orderId: 'buy1',
        accountId: 'acc1',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 99.50,
        createdAt: new Date()
      };

      const buyOrder2: OrderBookEntry = {
        orderId: 'buy2',
        accountId: 'acc2',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.00, // This should be best bid
        createdAt: new Date()
      };

      const sellOrder1: OrderBookEntry = {
        orderId: 'sell1',
        accountId: 'acc3',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 100,
        remainingQuantity: 100,
        price: 100.50, // This should be best ask
        createdAt: new Date()
      };

      const sellOrder2: OrderBookEntry = {
        orderId: 'sell2',
        accountId: 'acc4',
        instrumentId: 'inst1',
        type: 'LIMIT',
        side: 'SELL',
        quantity: 100,
        remainingQuantity: 100,
        price: 101.00,
        createdAt: new Date()
      };

      engine.addOrder(buyOrder1);
      engine.addOrder(buyOrder2);
      engine.addOrder(sellOrder1);
      engine.addOrder(sellOrder2);

      const { bestBid, bestAsk } = engine.getBestBidAsk();
      expect(bestBid).toBe(100.00);
      expect(bestAsk).toBe(100.50);
    });
  });
});