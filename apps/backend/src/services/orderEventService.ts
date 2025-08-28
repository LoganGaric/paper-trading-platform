import { PrismaClient, EventType } from '@prisma/client';

const prisma = new PrismaClient();

export interface OrderEventPayload {
  // For ACCEPTED events
  acceptedReason?: string;
  
  // For REJECTED events
  rejectedReasons?: string[];
  
  // For FILLED/PARTIALLY_FILLED events
  fillPrice?: number;
  fillQuantity?: number;
  remainingQuantity?: number;
  
  // For CANCELED events
  canceledReason?: string;
  canceledBy?: string;
  
  // General metadata
  metadata?: Record<string, any>;
}

export class OrderEventService {
  static async createEvent(
    orderId: string,
    instrumentId: string,
    eventType: EventType,
    payload: OrderEventPayload
  ): Promise<void> {
    await prisma.orderEvent.create({
      data: {
        orderId,
        instrumentId,
        type: eventType,
        payload: payload as any, // Prisma Json type
        timestamp: new Date(),
      },
    });
  }

  static async createAcceptedEvent(
    orderId: string,
    instrumentId: string,
    reason: string = 'Order passed all pre-trade checks'
  ): Promise<void> {
    await this.createEvent(orderId, instrumentId, 'ACCEPTED', {
      acceptedReason: reason,
    });
  }

  static async createRejectedEvent(
    orderId: string,
    instrumentId: string,
    reasons: string[]
  ): Promise<void> {
    await this.createEvent(orderId, instrumentId, 'REJECTED', {
      rejectedReasons: reasons,
    });
  }

  static async createFilledEvent(
    orderId: string,
    instrumentId: string,
    fillPrice: number,
    fillQuantity: number,
    remainingQuantity: number = 0
  ): Promise<void> {
    const eventType = remainingQuantity > 0 ? 'PARTIALLY_FILLED' : 'FILLED';
    
    await this.createEvent(orderId, instrumentId, eventType, {
      fillPrice,
      fillQuantity,
      remainingQuantity,
    });
  }

  static async createCanceledEvent(
    orderId: string,
    instrumentId: string,
    reason: string = 'User requested cancellation',
    canceledBy: string = 'user'
  ): Promise<void> {
    await this.createEvent(orderId, instrumentId, 'CANCELED', {
      canceledReason: reason,
      canceledBy,
    });
  }

  static async getOrderEvents(orderId: string) {
    return await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { timestamp: 'asc' },
    });
  }
}