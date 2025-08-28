export interface OrderBookEntry {
  orderId: string;
  accountId: string;
  instrumentId: string;
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL';
  quantity: number;
  remainingQuantity: number;
  price?: number;
  createdAt: Date;
}

export interface MarketData {
  bid: number;
  ask: number;
  last: number;
}

export interface Fill {
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  price: number;
  timestamp: Date;
}

export class MatchingEngine {
  private buyOrders: OrderBookEntry[] = [];
  private sellOrders: OrderBookEntry[] = [];

  /**
   * Add an order to the order book
   */
  addOrder(order: OrderBookEntry): void {
    if (order.side === 'BUY') {
      this.buyOrders.push(order);
      // Sort buy orders by price DESC (highest first), then by time ASC (oldest first)
      this.buyOrders.sort((a, b) => {
        if (a.type === 'MARKET' && b.type !== 'MARKET') return -1;
        if (b.type === 'MARKET' && a.type !== 'MARKET') return 1;
        
        if (a.type === 'MARKET' && b.type === 'MARKET') {
          return a.createdAt.getTime() - b.createdAt.getTime(); // Time priority for market orders
        }
        
        if (a.price !== b.price) {
          return (b.price || 0) - (a.price || 0); // Price priority (higher price first for buys)
        }
        
        return a.createdAt.getTime() - b.createdAt.getTime(); // Time priority
      });
    } else {
      this.sellOrders.push(order);
      // Sort sell orders by price ASC (lowest first), then by time ASC (oldest first)
      this.sellOrders.sort((a, b) => {
        if (a.type === 'MARKET' && b.type !== 'MARKET') return -1;
        if (b.type === 'MARKET' && a.type !== 'MARKET') return 1;
        
        if (a.type === 'MARKET' && b.type === 'MARKET') {
          return a.createdAt.getTime() - b.createdAt.getTime(); // Time priority for market orders
        }
        
        if (a.price !== b.price) {
          return (a.price || 0) - (b.price || 0); // Price priority (lower price first for sells)
        }
        
        return a.createdAt.getTime() - b.createdAt.getTime(); // Time priority
      });
    }
  }

  /**
   * Attempt to match orders and return fills
   */
  matchOrders(marketData: MarketData): Fill[] {
    const fills: Fill[] = [];
    
    // Process market orders first
    this.processMarketOrders(marketData, fills);
    
    // Then process limit order crosses
    this.processLimitOrderCrosses(fills);
    
    // Clean up fully filled orders
    this.cleanup();
    
    return fills;
  }

  private processMarketOrders(marketData: MarketData, fills: Fill[]): void {
    // Process market buy orders against best ask
    const marketBuys = this.buyOrders.filter(o => o.type === 'MARKET' && o.remainingQuantity > 0);
    for (const buyOrder of marketBuys) {
      const fillPrice = marketData.ask;
      const fillQty = Math.min(buyOrder.remainingQuantity, buyOrder.remainingQuantity);
      
      if (fillQty > 0) {
        fills.push({
          buyOrderId: buyOrder.orderId,
          sellOrderId: 'MARKET',
          quantity: fillQty,
          price: fillPrice,
          timestamp: new Date()
        });
        
        buyOrder.remainingQuantity -= fillQty;
      }
    }

    // Process market sell orders against best bid
    const marketSells = this.sellOrders.filter(o => o.type === 'MARKET' && o.remainingQuantity > 0);
    for (const sellOrder of marketSells) {
      const fillPrice = marketData.bid;
      const fillQty = Math.min(sellOrder.remainingQuantity, sellOrder.remainingQuantity);
      
      if (fillQty > 0) {
        fills.push({
          buyOrderId: 'MARKET',
          sellOrderId: sellOrder.orderId,
          quantity: fillQty,
          price: fillPrice,
          timestamp: new Date()
        });
        
        sellOrder.remainingQuantity -= fillQty;
      }
    }
  }

  private processLimitOrderCrosses(fills: Fill[]): void {
    // Match limit orders where buy price >= sell price
    const activeBuys = this.buyOrders.filter(o => o.type === 'LIMIT' && o.remainingQuantity > 0);
    const activeSells = this.sellOrders.filter(o => o.type === 'LIMIT' && o.remainingQuantity > 0);
    
    for (const buyOrder of activeBuys) {
      if (buyOrder.remainingQuantity === 0) continue;
      
      for (const sellOrder of activeSells) {
        if (sellOrder.remainingQuantity === 0) continue;
        
        // Check if orders can cross
        if ((buyOrder.price || 0) >= (sellOrder.price || 0)) {
          // Use price of the earlier order (price-time priority)
          const fillPrice = buyOrder.createdAt <= sellOrder.createdAt 
            ? (buyOrder.price || 0)
            : (sellOrder.price || 0);
          
          const fillQty = Math.min(buyOrder.remainingQuantity, sellOrder.remainingQuantity);
          
          if (fillQty > 0) {
            fills.push({
              buyOrderId: buyOrder.orderId,
              sellOrderId: sellOrder.orderId,
              quantity: fillQty,
              price: fillPrice,
              timestamp: new Date()
            });
            
            buyOrder.remainingQuantity -= fillQty;
            sellOrder.remainingQuantity -= fillQty;
          }
        }
      }
    }
  }

  private cleanup(): void {
    this.buyOrders = this.buyOrders.filter(o => o.remainingQuantity > 0);
    this.sellOrders = this.sellOrders.filter(o => o.remainingQuantity > 0);
  }

  /**
   * Remove an order from the book (for cancellations)
   */
  cancelOrder(orderId: string): boolean {
    const buyIndex = this.buyOrders.findIndex(o => o.orderId === orderId);
    if (buyIndex !== -1) {
      this.buyOrders.splice(buyIndex, 1);
      return true;
    }
    
    const sellIndex = this.sellOrders.findIndex(o => o.orderId === orderId);
    if (sellIndex !== -1) {
      this.sellOrders.splice(sellIndex, 1);
      return true;
    }
    
    return false;
  }

  /**
   * Get current order book state
   */
  getOrderBook(): { buys: OrderBookEntry[], sells: OrderBookEntry[] } {
    return {
      buys: [...this.buyOrders],
      sells: [...this.sellOrders]
    };
  }

  /**
   * Get best bid and ask prices
   */
  getBestBidAsk(): { bestBid?: number, bestAsk?: number } {
    const bestBid = this.buyOrders.find(o => o.type === 'LIMIT' && o.price)?.price;
    const bestAsk = this.sellOrders.find(o => o.type === 'LIMIT' && o.price)?.price;
    
    return { bestBid, bestAsk };
  }
}