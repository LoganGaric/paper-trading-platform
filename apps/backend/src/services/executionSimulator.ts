import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { broadcastPriceUpdate, broadcastOrderUpdate, broadcastFillUpdate, broadcastPositionUpdate, broadcastAccountUpdate } from '../websocket/websocket';

interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SimulationConfig {
  bidAskSpreadBps: number; // basis points (100 bps = 1%)
  feePerShare: number;
  slippageBps: number;
  playbackSpeedMs: number;
  maxPartialFillPct: number; // 0-1, max percentage of order that can be filled in single tick
}

interface OrderBookEntry {
  orderId: string;
  accountId: string;
  instrumentId: string;
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL';
  quantity: number;
  remainingQuantity: number;
  price?: number;
  createdAt: Date;
  lastFillTime?: Date;
}

export class ExecutionSimulator {
  private prisma: PrismaClient;
  private marketData: Map<string, MarketBar[]> = new Map();
  private currentPrices: Map<string, MarketBar> = new Map();
  private orderBook: OrderBookEntry[] = [];
  private isRunning = false;
  private config: SimulationConfig;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private currentIndices: Map<string, number> = new Map();

  // VOLATILITY CONFIGURATION FOR TESTING
  // Adjust these values in the constructor to control market dynamics:

  constructor(prisma: PrismaClient, config: Partial<SimulationConfig> = {}) {
    this.prisma = prisma;
    this.config = {
      bidAskSpreadBps: 30, // 0.3% spread (increased for more dynamic testing)
      feePerShare: 0.005,
      slippageBps: 8, // 0.08% slippage for market orders (increased)
      playbackSpeedMs: 1500, // 1.5 second intervals (reduced from 3 seconds for faster testing)
      maxPartialFillPct: 0.4, // max 40% of order filled per tick (increased for more activity)
      ...config
    };
  }

  async initialize(): Promise<void> {
    await this.loadMarketData();
    await this.loadSimulatorState();
    await this.initializeCurrentPrices();
  }

  private async loadSimulatorState(): Promise<void> {
    try {
      const state = await this.prisma.simulatorState.findFirst();
      if (state) {
        this.isRunning = state.isRunning;
        this.config.playbackSpeedMs = state.playbackSpeedMs;
        this.config.bidAskSpreadBps = state.bidAskSpreadBps;
        this.config.feePerShare = parseFloat(state.feePerShare.toString());
        this.config.slippageBps = state.slippageBps;
        this.config.maxPartialFillPct = parseFloat(state.maxPartialFillPct.toString());
        
        // Load current indices
        const indices = state.currentIndices as Record<string, number>;
        for (const [symbol, index] of Object.entries(indices)) {
          this.currentIndices.set(symbol, index);
        }
        
        console.log('Loaded current indices:', indices);
        
        console.log('Loaded simulator state from database', {
          isRunning: this.isRunning,
          indices: Object.keys(indices)
        });
      } else {
        // Create initial state
        await this.saveSimulatorState();
        console.log('Created initial simulator state');
      }
    } catch (error) {
      console.warn('Failed to load simulator state:', error);
    }
  }

  private async saveSimulatorState(): Promise<void> {
    try {
      const indices: Record<string, number> = {};
      for (const [symbol, index] of this.currentIndices) {
        indices[symbol] = index;
      }

      await this.prisma.simulatorState.upsert({
        where: { id: 'singleton' },
        update: {
          isRunning: this.isRunning,
          currentIndices: indices,
          playbackSpeedMs: this.config.playbackSpeedMs,
          bidAskSpreadBps: this.config.bidAskSpreadBps,
          feePerShare: this.config.feePerShare,
          slippageBps: this.config.slippageBps,
          maxPartialFillPct: this.config.maxPartialFillPct,
        },
        create: {
          id: 'singleton',
          isRunning: this.isRunning,
          currentIndices: indices,
          playbackSpeedMs: this.config.playbackSpeedMs,
          bidAskSpreadBps: this.config.bidAskSpreadBps,
          feePerShare: this.config.feePerShare,
          slippageBps: this.config.slippageBps,
          maxPartialFillPct: this.config.maxPartialFillPct,
        }
      });
    } catch (error) {
      console.warn('Failed to save simulator state:', error);
    }
  }

  private async loadMarketData(): Promise<void> {
    const dataDir = path.join(process.cwd(), '../../infra/data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('_minute_bars.csv'));

    for (const file of files) {
      const symbol = file.replace('_minute_bars.csv', '');
      const filePath = path.join(dataDir, file);
      const csvData = fs.readFileSync(filePath, 'utf8');
      
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      });

      const bars: MarketBar[] = records.map((record: any) => ({
        timestamp: record.timestamp,
        open: parseFloat(record.open),
        high: parseFloat(record.high),
        low: parseFloat(record.low),
        close: parseFloat(record.close),
        volume: parseInt(record.volume)
      }));

      this.marketData.set(symbol, bars);
      console.log(`Loaded ${bars.length} bars for ${symbol}`);
    }
  }

  private async initializeCurrentPrices(): Promise<void> {
    for (const [symbol, bars] of this.marketData) {
      if (bars.length > 0) {
        // Use persistent index or start from beginning if none exists
        let currentIndex = this.currentIndices.get(symbol) || 0;
        
        // Ensure index is within bounds
        if (currentIndex >= bars.length) {
          currentIndex = bars.length - 1;
        }
        
        this.currentIndices.set(symbol, currentIndex);
        const currentBar = bars[currentIndex];
        this.currentPrices.set(symbol, currentBar);
        
        // Update instrument price in database
        await this.prisma.instrument.updateMany({
          where: { symbol: symbol.toUpperCase() },
          data: { 
            price: currentBar.close,
            previousClose: currentBar.open
          }
        });
        
        console.log(`Initialized ${symbol} at index ${currentIndex}/${bars.length} (price: $${currentBar.close})`);
      }
    }
  }

  private calculateBidAsk(bar: MarketBar): { bid: number; ask: number } {
    const spread = (bar.close * this.config.bidAskSpreadBps) / 10000;
    return {
      bid: bar.close - spread / 2,
      ask: bar.close + spread / 2
    };
  }

  async addPendingOrder(order: {
    id: string;
    accountId: string;
    instrumentId: string;
    type: 'MARKET' | 'LIMIT';
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
  }): Promise<void> {
    const orderBookEntry: OrderBookEntry = {
      orderId: order.id,
      accountId: order.accountId,
      instrumentId: order.instrumentId,
      type: order.type,
      side: order.side,
      quantity: order.quantity,
      remainingQuantity: order.quantity,
      price: order.price,
      createdAt: new Date()
    };

    this.orderBook.push(orderBookEntry);
    
    // For market orders, try immediate execution
    if (order.type === 'MARKET') {
      await this.processMarketOrder(orderBookEntry);
    }
  }

  private async processMarketOrder(order: OrderBookEntry): Promise<void> {
    const instrument = await this.prisma.instrument.findUnique({
      where: { id: order.instrumentId }
    });

    if (!instrument) return;

    const currentBar = this.currentPrices.get(instrument.symbol);
    if (!currentBar) return;

    const { bid, ask } = this.calculateBidAsk(currentBar);
    const fillPrice = order.side === 'BUY' ? ask : bid;
    
    // Apply slippage for market orders
    const slippage = (fillPrice * this.config.slippageBps) / 10000;
    const finalPrice = order.side === 'BUY' 
      ? fillPrice + slippage 
      : fillPrice - slippage;

    await this.executeFill(order, order.remainingQuantity, finalPrice);
  }

  private async processLimitOrders(): Promise<void> {
    const limitOrders = this.orderBook.filter(o => 
      o.type === 'LIMIT' && o.remainingQuantity > 0
    );

    for (const order of limitOrders) {
      const instrument = await this.prisma.instrument.findUnique({
        where: { id: order.instrumentId }
      });

      if (!instrument) continue;

      const currentBar = this.currentPrices.get(instrument.symbol);
      if (!currentBar || !order.price) continue;

      const { bid, ask } = this.calculateBidAsk(currentBar);
      
      let canFill = false;
      let fillPrice = order.price;

      if (order.side === 'BUY' && order.price >= ask) {
        canFill = true;
        fillPrice = Math.min(order.price, ask);
      } else if (order.side === 'SELL' && order.price <= bid) {
        canFill = true;
        fillPrice = Math.max(order.price, bid);
      }

      if (canFill) {
        // Add cooldown to prevent rapid multiple fills (min 5 seconds between fills)
        const now = new Date();
        const timeSinceLastFill = order.lastFillTime ? now.getTime() - order.lastFillTime.getTime() : Infinity;
        if (timeSinceLastFill < 5000) {
          continue; // Skip this order, too soon since last fill
        }
        
        // Calculate partial fill quantity (simulate realistic partial execution)
        // Use a random factor to make fills more realistic and prevent over-filling
        const randomFillPct = Math.random() * this.config.maxPartialFillPct;
        const maxFillQty = Math.max(1, Math.floor(order.remainingQuantity * randomFillPct));
        const fillQty = Math.min(maxFillQty, order.remainingQuantity);
        
        // Only fill if there's actually quantity to fill
        if (fillQty > 0) {
          order.lastFillTime = now;
          await this.executeFill(order, fillQty, fillPrice);
        }
      }
    }
  }

  private async executeFill(order: OrderBookEntry, quantity: number, price: number): Promise<void> {
    const grossAmount = quantity * price;
    const fees = quantity * this.config.feePerShare;
    const netAmount = order.side === 'BUY' ? grossAmount + fees : grossAmount - fees;

    // Calculate new quantities before transaction
    const newRemainingQty = order.remainingQuantity - quantity;
    const newStatus = newRemainingQty === 0 ? 'FILLED' : 'PARTIALLY_FILLED';

    await this.prisma.$transaction(async (tx) => {
      // Create fill record
      await tx.fill.create({
        data: {
          orderId: order.orderId,
          accountId: order.accountId,
          instrumentId: order.instrumentId,
          quantity,
          price,
          side: order.side,
        }
      });

      // Update order
      await tx.order.update({
        where: { id: order.orderId },
        data: {
          status: newStatus,
          filledAt: newRemainingQty === 0 ? new Date() : undefined
        }
      });

      // Create order event
      await tx.orderEvent.create({
        data: {
          orderId: order.orderId,
          instrumentId: order.instrumentId,
          type: newRemainingQty === 0 ? 'FILLED' : 'PARTIALLY_FILLED',
          payload: {
            fillPrice: price,
            fillQuantity: quantity,
            remainingQuantity: newRemainingQty,
            executionTime: new Date().toISOString(),
            fees,
            grossAmount,
            netAmount
          }
        }
      });

      // Update position
      await this.updatePosition(tx, order.accountId, order.instrumentId, order.side, quantity, price);

      // Update account balance and buying power
      await this.updateAccountBalance(tx, order.accountId, order.side, grossAmount, fees);
    });

    // Update order book
    order.remainingQuantity -= quantity;
    if (order.remainingQuantity === 0) {
      const index = this.orderBook.indexOf(order);
      if (index > -1) {
        this.orderBook.splice(index, 1);
      }
    }

    // Broadcast order update to WebSocket subscribers
    broadcastOrderUpdate(order.accountId, {
      orderId: order.orderId,
      type: 'FILL',
      fillQuantity: quantity,
      fillPrice: price,
      remainingQuantity: newRemainingQty,
      status: newStatus,
      side: order.side,
      fees,
      timestamp: new Date().toISOString()
    });

    // Broadcast fill update
    broadcastFillUpdate(order.accountId, {
      orderId: order.orderId,
      instrumentId: order.instrumentId,
      quantity,
      price,
      side: order.side,
      executedAt: new Date().toISOString(),
      fees,
      grossAmount,
      netAmount
    });

    // Broadcast position update (get updated position)
    const updatedPosition = await this.prisma.position.findUnique({
      where: {
        accountId_instrumentId: {
          accountId: order.accountId,
          instrumentId: order.instrumentId
        }
      },
      include: { instrument: true }
    });

    if (updatedPosition) {
      broadcastPositionUpdate(order.accountId, {
        instrumentId: order.instrumentId,
        symbol: updatedPosition.instrument.symbol,
        quantity: updatedPosition.quantity,
        avgPrice: parseFloat(updatedPosition.avgPrice.toString()),
        marketValue: parseFloat(updatedPosition.marketValue.toString()),
        unrealizedPL: parseFloat(updatedPosition.unrealizedPL.toString())
      });
    }

    // Broadcast account balance update
    const updatedAccount = await this.prisma.account.findUnique({
      where: { id: order.accountId }
    });

    if (updatedAccount) {
      broadcastAccountUpdate(order.accountId, {
        balance: parseFloat(updatedAccount.balance.toString()),
        buyingPower: parseFloat(updatedAccount.buyingPower.toString())
      });
    }

    console.log(`Filled ${quantity} shares of ${order.side} order at $${price.toFixed(2)}`);
  }

  private async updatePosition(tx: any, accountId: string, instrumentId: string, side: string, quantity: number, price: number): Promise<void> {
    const existingPosition = await tx.position.findUnique({
      where: {
        accountId_instrumentId: {
          accountId,
          instrumentId
        }
      }
    });

    const instrument = await tx.instrument.findUnique({
      where: { id: instrumentId }
    });

    if (!instrument) return;

    if (existingPosition) {
      const currentQty = existingPosition.quantity;
      const currentAvgPrice = parseFloat(existingPosition.avgPrice.toString());
      
      let newQty: number;
      let newAvgPrice: number;
      
      if (side === 'BUY') {
        newQty = currentQty + quantity;
        newAvgPrice = ((currentQty * currentAvgPrice) + (quantity * price)) / newQty;
      } else {
        newQty = currentQty - quantity;
        newAvgPrice = currentAvgPrice;
      }
      
      const marketValue = newQty * parseFloat(instrument.price.toString());
      const unrealizedPL = (parseFloat(instrument.price.toString()) - newAvgPrice) * newQty;

      if (newQty === 0) {
        await tx.position.delete({
          where: { id: existingPosition.id }
        });
      } else {
        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQty,
            avgPrice: newAvgPrice,
            marketValue,
            unrealizedPL
          }
        });
      }
    } else if (side === 'BUY') {
      const marketValue = quantity * parseFloat(instrument.price.toString());
      const unrealizedPL = (parseFloat(instrument.price.toString()) - price) * quantity;

      await tx.position.create({
        data: {
          accountId,
          instrumentId,
          quantity,
          avgPrice: price,
          marketValue,
          unrealizedPL
        }
      });
    }
  }

  private async updateAccountBalance(tx: any, accountId: string, side: string, grossAmount: number, fees: number): Promise<void> {
    const account = await tx.account.findUnique({
      where: { id: accountId }
    });

    if (!account) return;

    const currentBalance = parseFloat(account.balance.toString());
    const currentBuyingPower = parseFloat(account.buyingPower.toString());

    let newBalance: number;
    let newBuyingPower: number;

    if (side === 'BUY') {
      // For buys: reduce balance and buying power by gross amount + fees
      const totalCost = grossAmount + fees;
      newBalance = currentBalance - totalCost;
      newBuyingPower = currentBuyingPower - totalCost;
    } else {
      // For sells: increase balance and buying power by gross amount - fees
      const netProceeds = grossAmount - fees;
      newBalance = currentBalance + netProceeds;
      newBuyingPower = currentBuyingPower + netProceeds;
    }

    await tx.account.update({
      where: { id: accountId },
      data: {
        balance: newBalance,
        buyingPower: newBuyingPower
      }
    });

    console.log(`Account balance updated: ${side} ${grossAmount.toFixed(2)} (fees: ${fees.toFixed(2)}) -> Balance: $${newBalance.toFixed(2)}, Buying Power: $${newBuyingPower.toFixed(2)}`);
  }

  async startSimulation(): Promise<void> {
    if (this.isRunning && this.intervals.size > 0) {
      console.log('Market simulation already running');
      return;
    }
    
    this.isRunning = true;
    await this.saveSimulatorState();
    console.log('Starting market simulation...');

    for (const [symbol, bars] of this.marketData) {
      let currentIndex = this.currentIndices.get(symbol) || 0;
      
      // Add random offset to each stock's interval to prevent synchronization
      // Increased variation for more dynamic testing: Base interval +/- 40% random variation
      const randomOffset = 0.6 + (Math.random() * 0.8); // 0.6 to 1.4 multiplier (increased from 0.8-1.2)
      const stockInterval = Math.floor(this.config.playbackSpeedMs * randomOffset);
      
      const interval = setInterval(async () => {
        if (!this.isRunning) {
          clearInterval(interval);
          this.intervals.delete(symbol);
          return;
        }

        // Move to next bar
        currentIndex++;
        
        // If we've reached the end, loop back to beginning
        if (currentIndex >= bars.length) {
          currentIndex = 0;
        }

        this.currentIndices.set(symbol, currentIndex);
        const originalBar = bars[currentIndex];
        const previousBar = this.currentPrices.get(symbol);
        
        // Add random volatility for more dramatic testing/demo purposes
        const volatilityMultiplier = 0.08; // 8% max random movement (very high for testing)
        const randomChange = (Math.random() - 0.5) * 2 * volatilityMultiplier; // -8% to +8%
        const volatilePrice = originalBar.close * (1 + randomChange);
        
        // Create modified bar with volatile price
        const newBar = {
          ...originalBar,
          close: Math.max(volatilePrice, 0.01), // Ensure price never goes negative
          open: originalBar.open, // Keep original open for reference
          high: Math.max(originalBar.high, volatilePrice),
          low: Math.min(originalBar.low, volatilePrice)
        };
        this.currentPrices.set(symbol, newBar);

        // Update instrument price
        await this.prisma.instrument.updateMany({
          where: { symbol: symbol.toUpperCase() },
          data: { 
            price: newBar.close,
            previousClose: previousBar?.close || newBar.open
          }
        });

        // Calculate price change metrics
        const previousClose = previousBar?.close || newBar.open;
        const change = newBar.close - previousClose;
        const changePercent = (change / previousClose) * 100;

        // Calculate bid/ask spread
        const { bid, ask } = this.calculateBidAsk(newBar);

        // Broadcast price update via WebSocket
        broadcastPriceUpdate(symbol, {
          price: newBar.close,
          timestamp: newBar.timestamp,
          volume: newBar.volume,
          bid,
          ask,
          change,
          changePercent
        });

        // Process limit orders
        await this.processLimitOrders();

        console.log(`${symbol}: $${newBar.close.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}, ${changePercent.toFixed(2)}%) [${currentIndex}/${bars.length}]`);
        
        // Save state periodically (every 10 ticks to avoid excessive DB writes)
        if (currentIndex % 10 === 0) {
          await this.saveSimulatorState();
        }
      }, stockInterval);

      this.intervals.set(symbol, interval);
      console.log(`${symbol} interval: ${stockInterval}ms (${randomOffset.toFixed(2)}x base)`);
    }
  }

  async stopSimulation(): Promise<void> {
    this.isRunning = false;
    
    for (const [symbol, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    
    await this.saveSimulatorState();
    console.log('Market simulation stopped and state saved');
  }

  getCurrentPrices(): Map<string, MarketBar> {
    return new Map(this.currentPrices);
  }

  getPendingOrders(): OrderBookEntry[] {
    return [...this.orderBook];
  }

  updateConfig(newConfig: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}