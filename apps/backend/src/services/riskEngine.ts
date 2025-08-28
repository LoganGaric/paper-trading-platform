import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RiskCheckResult {
  passed: boolean;
  reasons: string[];
}

export interface OrderRequest {
  accountId: string;
  instrumentId: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  type: 'MARKET' | 'LIMIT';
  price?: number;
}

export interface RiskLimits {
  maxQuantityPerSymbol: number;
  maxNotionalValue: number;
  maxDailyOrders: number;
  globalKillSwitch: boolean;
  feePerShare: number;
}

// Default risk limits - in production these would come from configuration
const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxQuantityPerSymbol: 10000,
  maxNotionalValue: 50000,
  maxDailyOrders: 100,
  globalKillSwitch: false,
  feePerShare: 0.005, // $0.005 per share
};

export class RiskEngine {
  private static riskLimits: RiskLimits = DEFAULT_RISK_LIMITS;

  static updateRiskLimits(limits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...limits };
  }

  static getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  static async validateOrder(orderRequest: OrderRequest): Promise<RiskCheckResult> {
    const reasons: string[] = [];

    try {
      // 1. Global kill switch
      if (this.riskLimits.globalKillSwitch) {
        reasons.push('Global kill switch is active - no new orders allowed');
        return { passed: false, reasons };
      }

      // Get current instrument price for calculations
      const instrument = await prisma.instrument.findUnique({
        where: { id: orderRequest.instrumentId },
      });

      if (!instrument) {
        reasons.push('Instrument not found');
        return { passed: false, reasons };
      }

      const effectivePrice = this.getEffectivePrice(orderRequest, instrument);

      // 2. Buying power check (only for BUY orders)
      if (orderRequest.side === 'BUY') {
        const buyingPowerCheck = await this.checkBuyingPower(
          orderRequest.accountId,
          orderRequest.quantity,
          effectivePrice
        );
        if (!buyingPowerCheck.passed) {
          reasons.push(...buyingPowerCheck.reasons);
        }
      }

      // 3. Per-symbol quantity limit
      const symbolLimitCheck = await this.checkSymbolQuantityLimit(
        orderRequest.accountId,
        orderRequest.instrumentId,
        orderRequest.side,
        orderRequest.quantity
      );
      if (!symbolLimitCheck.passed) {
        reasons.push(...symbolLimitCheck.reasons);
      }

      // 4. Notional value limit
      const notionalCheck = await this.checkNotionalLimit(
        orderRequest.accountId,
        orderRequest.quantity,
        effectivePrice
      );
      if (!notionalCheck.passed) {
        reasons.push(...notionalCheck.reasons);
      }

      // 5. Daily order count limit
      const dailyOrderCheck = await this.checkDailyOrderLimit(orderRequest.accountId);
      if (!dailyOrderCheck.passed) {
        reasons.push(...dailyOrderCheck.reasons);
      }

      return {
        passed: reasons.length === 0,
        reasons,
      };
    } catch (error) {
      console.error('Risk validation error:', error);
      return {
        passed: false,
        reasons: ['Internal risk validation error'],
      };
    }
  }

  private static getEffectivePrice(orderRequest: OrderRequest, instrument: any): number {
    if (orderRequest.type === 'LIMIT' && orderRequest.price) {
      return orderRequest.price;
    }
    // For MARKET orders, use current instrument price
    return parseFloat(instrument.price.toString());
  }

  private static async checkBuyingPower(
    accountId: string,
    quantity: number,
    price: number
  ): Promise<RiskCheckResult> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return { passed: false, reasons: ['Account not found'] };
    }

    const orderValue = quantity * price;
    const fees = quantity * this.riskLimits.feePerShare;
    const totalRequired = orderValue + fees;
    const availableBuyingPower = parseFloat(account.buyingPower.toString());

    if (totalRequired > availableBuyingPower) {
      return {
        passed: false,
        reasons: [
          `Insufficient buying power. Required: $${totalRequired.toFixed(2)}, Available: $${availableBuyingPower.toFixed(2)}`,
        ],
      };
    }

    return { passed: true, reasons: [] };
  }

  private static async checkSymbolQuantityLimit(
    accountId: string,
    instrumentId: string,
    side: 'BUY' | 'SELL',
    quantity: number
  ): Promise<RiskCheckResult> {
    // Get current position
    const position = await prisma.position.findUnique({
      where: {
        accountId_instrumentId: {
          accountId,
          instrumentId,
        },
      },
    });

    const currentQuantity = position ? position.quantity : 0;
    let newQuantity = currentQuantity;

    if (side === 'BUY') {
      newQuantity += quantity;
    } else {
      newQuantity -= quantity;
    }

    // Check if new quantity exceeds limit
    if (Math.abs(newQuantity) > this.riskLimits.maxQuantityPerSymbol) {
      return {
        passed: false,
        reasons: [
          `Order would exceed maximum position size of ${this.riskLimits.maxQuantityPerSymbol} shares per symbol`,
        ],
      };
    }

    // Check if selling more than owned
    if (side === 'SELL' && quantity > currentQuantity) {
      return {
        passed: false,
        reasons: [
          `Cannot sell ${quantity} shares. Current position: ${currentQuantity} shares`,
        ],
      };
    }

    return { passed: true, reasons: [] };
  }

  private static async checkNotionalLimit(
    accountId: string,
    quantity: number,
    price: number
  ): Promise<RiskCheckResult> {
    const orderNotional = quantity * price;

    if (orderNotional > this.riskLimits.maxNotionalValue) {
      return {
        passed: false,
        reasons: [
          `Order notional value $${orderNotional.toFixed(2)} exceeds limit of $${this.riskLimits.maxNotionalValue}`,
        ],
      };
    }

    return { passed: true, reasons: [] };
  }

  private static async checkDailyOrderLimit(accountId: string): Promise<RiskCheckResult> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayOrderCount = await prisma.order.count({
      where: {
        accountId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (todayOrderCount >= this.riskLimits.maxDailyOrders) {
      return {
        passed: false,
        reasons: [
          `Daily order limit of ${this.riskLimits.maxDailyOrders} orders exceeded. Current: ${todayOrderCount}`,
        ],
      };
    }

    return { passed: true, reasons: [] };
  }

  // Utility methods for managing risk settings
  static async enableKillSwitch(): Promise<void> {
    this.riskLimits.globalKillSwitch = true;
    console.log('RISK ALERT: Global kill switch activated - all new orders blocked');
  }

  static async disableKillSwitch(): Promise<void> {
    this.riskLimits.globalKillSwitch = false;
    console.log('Global kill switch deactivated - normal trading resumed');
  }

  static isKillSwitchActive(): boolean {
    return this.riskLimits.globalKillSwitch;
  }
}