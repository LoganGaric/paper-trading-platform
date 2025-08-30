const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface Account {
  id: string;
  name: string;
  email: string;
  balance: string;
  buyingPower: string;
  createdAt: string;
  updatedAt: string;
}

export interface Symbol {
  id: string;
  ticker: string;
  name: string;
  price: string;
  exchange: string;
}

export interface Order {
  id: string;
  accountId: string;
  instrumentId: string;
  type: string;
  side: string;
  quantity: number;
  price?: string;
  status: string;
  createdAt: string;
  instrument: {
    id: string;
    symbol: string;
    name: string;
    sector?: string;
    exchange: string;
    price: string;
  };
  fills: Array<{
    id: string;
    quantity: number;
    price: string;
    executedAt: string;
  }>;
}

export interface Position {
  id: string;
  accountId: string;
  symbolId: string;
  quantity: number;
  avgPrice: string;
  marketValue: string;
  unrealizedPL: string;
  symbol: Symbol;
}

export interface Fill {
  id: string;
  orderId: string;
  accountId: string;
  symbolId: string;
  quantity: number;
  price: string;
  side: string;
  executedAt: string;
  symbol: Symbol;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Account API
  async getAccount(accountId: string): Promise<Account> {
    return this.request<Account>(`/api/accounts/${accountId}`);
  }

  async createDemoAccount(): Promise<Account> {
    return this.request<Account>('/api/accounts/demo', {
      method: 'POST',
    });
  }

  // Orders API
  async getOrders(accountId: string): Promise<Order[]> {
    return this.request<Order[]>(`/api/orders?accountId=${accountId}`);
  }

  async createOrder(orderData: {
    accountId: string;
    ticker: string;
    type: string;
    side: string;
    quantity: number;
    price?: number;
  }): Promise<Order> {
    return this.request<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async cancelOrder(orderId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  }

  // Positions API
  async getPositions(accountId: string): Promise<Position[]> {
    return this.request<Position[]>(`/api/positions?accountId=${accountId}`);
  }

  async resetPositions(accountId: string): Promise<{ success: boolean; message: string; deletedPositions: number; deletedOrders: number; deletedEvents: number; deletedFills: number }> {
    return this.request<{ success: boolean; message: string; deletedPositions: number; deletedOrders: number; deletedEvents: number; deletedFills: number }>(`/api/positions?accountId=${accountId}`, {
      method: 'DELETE',
    });
  }

  // Fills API
  async getFills(accountId: string): Promise<Fill[]> {
    return this.request<Fill[]>(`/api/fills?accountId=${accountId}`);
  }
}

export const apiClient = new ApiClient();