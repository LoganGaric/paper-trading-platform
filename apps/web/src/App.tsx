import React, { useState, useEffect } from 'react';
import { apiClient } from './api/client';

// Demo account ID - matches the seeded account in database
const DEMO_ACCOUNT_ID = 'cmet25ndn000013oj3yflwmti';

const BlotterSection: React.FC<{
  backendPrices: Record<string, {price: number, previousClose: number, change: number, changePercent: number}>,
  setCurrentPage: (page: string) => void
}> = ({ backendPrices, setCurrentPage }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/orders?accountId=${DEMO_ACCOUNT_ID}`);
        const ordersData = await response.json();
        setOrders(ordersData.slice(0, 10)); // Show last 10 orders
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    // Refresh every 5 seconds to show real-time updates
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED': return '#28a745';
      case 'PENDING': return '#ffc107';
      case 'PARTIALLY_FILLED': return '#17a2b8';
      case 'REJECTED': return '#dc3545';
      case 'CANCELLED': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    setCancellingOrders(prev => new Set(prev).add(orderId));
    try {
      await apiClient.cancelOrder(orderId);
      // Refresh orders to show updated status
      const response = await fetch(`http://localhost:4000/api/orders?accountId=${DEMO_ACCOUNT_ID}`);
      const ordersData = await response.json();
      setOrders(ordersData.slice(0, 10));
    } catch (err) {
      console.error('Failed to cancel order:', err);
      alert('Failed to cancel order');
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const canCancelOrder = (order: any): boolean => {
    return order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED';
  };

  const getFilledQuantity = (order: any): number => {
    if (!order.fills || order.fills.length === 0) return 0;
    return order.fills.reduce((total: number, fill: any) => total + fill.quantity, 0);
  };

  const formatFilledProgress = (order: any): string => {
    const filled = getFilledQuantity(order);
    const total = order.quantity;
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
    
    if (filled === 0) {
      return `0/${total}`;
    }
    return `${filled}/${total} (${percentage}%)`;
  };

  return (
    <div className="card">
      <h2>Order Blotter</h2>
      <p>View all your orders and their status here. Auto-refreshes every 5 seconds. Cancel pending orders using the Actions column.</p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={async () => {
            try {
              const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/orders?accountId=${DEMO_ACCOUNT_ID}`);
              const ordersData = await response.json();
              setOrders(ordersData.slice(0, 10));
            } catch (error) {
              console.error('Error fetching orders:', error);
            }
          }} 
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            marginBottom: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ 
            marginTop: '20px', 
            padding: '20px', 
            textAlign: 'center', 
            backgroundColor: 'rgba(45, 55, 72, 0.6)', 
            borderRadius: '8px',
            color: '#a0aec0',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3>No orders yet</h3>
            <p>Place your first order using the Order Ticket to see it here!</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '14%' }}>Time</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '10%' }}>Symbol</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '10%' }}>Side</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '12%' }}>Quantity</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '14%' }}>Filled</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '10%' }}>Price</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '12%' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '14%' }}>Order ID</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd', width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #ddd' }}>
                    {order.instrument?.symbol || 'N/A'}
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    color: order.side === 'BUY' ? '#28a745' : '#dc3545',
                    fontWeight: 'bold',
                    border: '1px solid #ddd'
                  }}>
                    {order.side}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{order.quantity.toLocaleString()}</td>
                  <td style={{ 
                    padding: '10px',
                    fontWeight: '600',
                    color: getFilledQuantity(order) === order.quantity ? '#28a745' : 
                           getFilledQuantity(order) > 0 ? '#fd7e14' : '#6c757d',
                    border: '1px solid #ddd'
                  }}>
                    {formatFilledProgress(order)}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {order.price ? `$${parseFloat(order.price).toFixed(2)}` : 'Market'}
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    color: getStatusColor(order.status),
                    fontWeight: 'bold',
                    border: '1px solid #ddd'
                  }}>
                    {order.status}
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.8em', color: '#666', border: '1px solid #ddd' }}>
                    {order.id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {canCancelOrder(order) && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingOrders.has(order.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: cancellingOrders.has(order.id) ? 'not-allowed' : 'pointer',
                          fontSize: '0.8em',
                          opacity: cancellingOrders.has(order.id) ? 0.6 : 1
                        }}
                      >
                        {cancellingOrders.has(order.id) ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Mini Market Data Section */}
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '15px', color: '#e2e8f0' }}>Quick Market Data</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px'
          }}>
            {(() => {
              const stockInfo = {
                'AAPL': { name: 'Apple Inc.' },
                'TSLA': { name: 'Tesla, Inc.' },
                'GOOGL': { name: 'Alphabet Inc.' },
                'MSFT': { name: 'Microsoft Corp.' },
                'NVDA': { name: 'NVIDIA Corp.' },
                'SPY': { name: 'S&P 500 ETF' }
              };

              const symbols = Object.keys(stockInfo);
              return symbols.map((symbol) => {
                const backendPrice = backendPrices[symbol];
                const currentPrice = backendPrice ? backendPrice.price : 0;
                const change = backendPrice ? backendPrice.change : 0;
                const changePercent = backendPrice ? backendPrice.changePercent : 0;
                const isPositive = change >= 0;

                return (
                  <div key={symbol} style={{
                    padding: '10px',
                    backgroundColor: 'rgba(45, 55, 72, 0.6)',
                    borderRadius: '6px',
                    border: `1px solid ${isPositive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setCurrentPage('order-ticket')}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.8)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.6)';
                  }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '4px' 
                    }}>
                      <div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '14px',
                          color: '#e2e8f0' 
                        }}>
                          {symbol}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#a0aec0',
                          marginTop: '2px'
                        }}>
                          {stockInfo[symbol as keyof typeof stockInfo]?.name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '14px',
                          color: '#e2e8f0' 
                        }}>
                          ${currentPrice.toFixed(2)}
                        </div>
                        <div style={{ 
                          fontSize: '11px',
                          color: isPositive ? '#68d391' : '#fc8181',
                          fontWeight: '600'
                        }}>
                          {isPositive ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#718096',
                      fontStyle: 'italic'
                    }}>
                      Click to go to Order Ticket
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

const PositionsSection: React.FC<{
  backendPrices: Record<string, {price: number, previousClose: number, change: number, changePercent: number}>,
  setCurrentPage: (page: string) => void
}> = ({ backendPrices, setCurrentPage }) => {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchPositions = async () => {
    try {
      const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/positions?accountId=${DEMO_ACCOUNT_ID}`);
      const positionsData = await response.json();
      setPositions(positionsData);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    // Refresh every 5 seconds to show real-time updates
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResetPositions = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all positions? This will permanently delete all your current holdings and cannot be undone.'
    );

    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/positions?accountId=${DEMO_ACCOUNT_ID}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        // Immediately refresh positions to show empty state
        await fetchPositions();
      } else {
        alert('❌ Failed to reset positions');
      }
    } catch (error) {
      console.error('Error resetting positions:', error);
      alert('❌ Error resetting positions');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2>Positions</h2>
        {positions.length > 0 && (
          <button
            onClick={handleResetPositions}
            disabled={resetting}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: resetting ? 'not-allowed' : 'pointer',
              backgroundColor: resetting ? '#6c757d' : '#dc3545',
              color: 'white',
              transition: 'all 0.3s ease',
              opacity: resetting ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!resetting) {
                e.currentTarget.style.backgroundColor = '#c82333';
              }
            }}
            onMouseOut={(e) => {
              if (!resetting) {
                e.currentTarget.style.backgroundColor = '#dc3545';
              }
            }}
          >
            {resetting ? '🔄 Resetting...' : '🗑️ Reset All Positions'}
          </button>
        )}
      </div>
      <p>Your current holdings based on executed trades from the database.</p>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading positions...</div>
      ) : positions.length === 0 ? (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          textAlign: 'center', 
          backgroundColor: 'rgba(45, 55, 72, 0.6)', 
          borderRadius: '8px',
          color: '#a0aec0',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3>No positions</h3>
          <p>You don't have any current holdings. Place and execute some orders to see positions here!</p>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Symbol</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Avg Price</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Market Value</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => (
                <tr key={position.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {position.instrument.symbol}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {position.quantity.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${parseFloat(position.avgPrice).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${parseFloat(position.marketValue).toFixed(2)}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: parseFloat(position.unrealizedPL) >= 0 ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    ${parseFloat(position.unrealizedPL).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mini Market Data Section */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '15px', color: '#e2e8f0' }}>Quick Market Data</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px'
        }}>
          {(() => {
            const stockInfo = {
              'AAPL': { name: 'Apple Inc.' },
              'TSLA': { name: 'Tesla, Inc.' },
              'GOOGL': { name: 'Alphabet Inc.' },
              'MSFT': { name: 'Microsoft Corp.' },
              'NVDA': { name: 'NVIDIA Corp.' },
              'SPY': { name: 'S&P 500 ETF' }
            };

            const symbols = Object.keys(stockInfo);
            return symbols.map((symbol) => {
              const backendPrice = backendPrices[symbol];
              const currentPrice = backendPrice ? backendPrice.price : 0;
              const change = backendPrice ? backendPrice.change : 0;
              const changePercent = backendPrice ? backendPrice.changePercent : 0;
              const isPositive = change >= 0;

              return (
                <div key={symbol} style={{
                  padding: '10px',
                  backgroundColor: 'rgba(45, 55, 72, 0.6)',
                  borderRadius: '6px',
                  border: `1px solid ${isPositive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('order-ticket')}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.8)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.6)';
                }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '4px' 
                  }}>
                    <div>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px',
                        color: '#e2e8f0' 
                      }}>
                        {symbol}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#a0aec0',
                        marginTop: '2px'
                      }}>
                        {stockInfo[symbol as keyof typeof stockInfo]?.name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px',
                        color: '#e2e8f0' 
                      }}>
                        ${currentPrice.toFixed(2)}
                      </div>
                      <div style={{ 
                        fontSize: '11px',
                        color: isPositive ? '#68d391' : '#fc8181',
                        fontWeight: '600'
                      }}>
                        {isPositive ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#718096',
                    fontStyle: 'italic'
                  }}>
                    Click to go to Order Ticket
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {Object.keys(backendPrices).length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#a0aec0',
            fontStyle: 'italic'
          }}>
            Enable Market Simulation to see live prices
          </div>
        )}
      </div>
    </div>
  );
};

// Market simulation system
const MARKET_DATA: { [key: string]: { basePrice: number, currentPrice: number, trend: number, lastUpdate: number } } = {};

// Removed market hours restriction - simulation always runs for testing/demo purposes
const isMarketOpen = () => {
  return true; // Always open for continuous testing and demo
};

const getRealisticPrice = (symbol: string, avgPrice: number) => {
  const now = Date.now();
  
  // Initialize market data for new symbols
  if (!MARKET_DATA[symbol]) {
    MARKET_DATA[symbol] = {
      basePrice: avgPrice,
      currentPrice: avgPrice,
      trend: (Math.random() - 0.5) * 0.02, // Initial trend between -1% to +1%
      lastUpdate: now
    };
  }
  
  const data = MARKET_DATA[symbol];
  const timeSinceUpdate = now - data.lastUpdate;
  
  // Only update price if enough time has passed (1 second for faster testing) - market always open
  if (timeSinceUpdate > 1000) {
    // Increased volatility for testing and demonstration purposes
    const volatility = 0.045; // 4.5% typical movement (increased from 1.2%)
    const trendInfluence = 0.6; // Slightly less trend persistence
    const randomInfluence = 0.4; // More randomness for dynamic testing
    
    // Trend tends to persist but can reverse more frequently for dynamic testing
    if (Math.random() < 0.15) { // 15% chance to reverse trend (increased from 10%)
      data.trend *= -0.6; // Stronger reversals
    }
    
    // Calculate price change
    const trendMove = data.trend * trendInfluence;
    const randomMove = (Math.random() - 0.5) * volatility * randomInfluence;
    const totalMove = trendMove + randomMove;
    
    // Apply movement
    data.currentPrice *= (1 + totalMove);
    
    // Allow larger price swings for testing (within 30% of base price)
    const maxPrice = data.basePrice * 1.3;
    const minPrice = data.basePrice * 0.7;
    data.currentPrice = Math.max(minPrice, Math.min(maxPrice, data.currentPrice));
    
    // Slowly decay trend toward zero (mean reversion)
    data.trend *= 0.95;
    
    data.lastUpdate = now;
  }
  
  // Return current price (market always active)
  return data.currentPrice;
};

const getBidAskPrice = (symbol: string, avgPrice: number, side: 'BUY' | 'SELL') => {
  const midPrice = getRealisticPrice(symbol, avgPrice);
  const spread = midPrice * 0.001; // 0.1% spread (realistic for liquid stocks)
  
  if (side === 'BUY') {
    return midPrice + (spread / 2); // Buy at ask (slightly higher)
  } else {
    return midPrice - (spread / 2); // Sell at bid (slightly lower)
  }
};

// Toast notification component
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContainer = ({ toasts, removeToast }: { 
  toasts: Toast[], 
  removeToast: (id: number) => void 
}) => (
  <div style={{
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }}>
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={toast.type === 'success' ? 'success-message' : toast.type === 'error' ? 'error-message' : 'success-message'}
        style={{
          minWidth: '300px',
          cursor: 'pointer',
          position: 'relative'
        }}
        onClick={() => removeToast(toast.id)}
      >
        {toast.message}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            removeToast(toast.id);
          }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '8px',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

function App(): JSX.Element {
  const [currentPage, setCurrentPage] = useState('market-data');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [orderCount, setOrderCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<Array<{symbol: string, side: string, quantity: number, type: string, price?: number, time: string}>>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Removed simulateMarketOpen - market always active for demo
  const [priceUpdateTrigger, setPriceUpdateTrigger] = useState(0);
  const [backendPrices, setBackendPrices] = useState<Record<string, {price: number, previousClose: number, change: number, changePercent: number}>>({});

  // Function to fetch current prices from backend
  const fetchBackendPrices = async () => {
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/simulator/status`);
      if (response.ok) {
        const status = await response.json();
        const prices: Record<string, {price: number, previousClose: number, change: number, changePercent: number}> = {};
        
        status.currentPrices.forEach((priceData: any) => {
          prices[priceData.symbol] = {
            price: priceData.price,
            previousClose: priceData.previousClose,
            change: priceData.change || 0,
            changePercent: priceData.changePercent || 0
          };
        });
        
        setBackendPrices(prices);
        // Market simulation always active - no toggle needed
        return prices;
      }
    } catch (error) {
      console.warn('Failed to fetch backend prices:', error);
    }
    return {};
  };

  // Sync with backend simulator state and prices on load
  useEffect(() => {
    fetchBackendPrices();
  }, []);

  // Poll for price updates continuously
  useEffect(() => {
    const interval = setInterval(fetchBackendPrices, 2000); // Poll every 2 seconds continuously
    return () => clearInterval(interval);
  }, []);

  // Automatic price updates - faster for testing (always active)
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceUpdateTrigger(prev => prev + 1);
    }, 1500); // Update every 1.5 seconds (reduced from 3 seconds)

    return () => clearInterval(interval);
  }, []);

  // Toast functions
  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Calculate account balances
  const calculateBalances = () => {
    const startingCash = 100000; // Starting with $100k
    const totalInvested = recentOrders.reduce((sum, order) => {
      const orderPrice = order.price || 100;
      if (order.side === 'BUY') {
        return sum + (order.quantity * orderPrice);
      } else {
        return sum - (order.quantity * orderPrice);
      }
    }, 0);
    
    const positions = calculatePositions();
    const currentMarketValue = positions.reduce((sum, pos) => {
      const currentPrice = getRealisticPrice(pos.symbol, pos.avgPrice);
      return sum + (pos.quantity * currentPrice);
    }, 0);
    
    const cashBalance = startingCash - totalInvested;
    const totalValue = cashBalance + currentMarketValue;
    const buyingPower = cashBalance; // Simplified - usually includes margin
    
    return {
      cashBalance,
      buyingPower,
      totalValue,
      totalInvested: Math.abs(totalInvested),
      marketValue: currentMarketValue
    };
  };

  // Calculate positions from recent orders
  const calculatePositions = () => {
    const positionMap = new Map<string, {symbol: string, quantity: number, avgPrice: number, totalCost: number}>();
    
    recentOrders.forEach(order => {
      const currentPos = positionMap.get(order.symbol) || {
        symbol: order.symbol,
        quantity: 0,
        avgPrice: 0,
        totalCost: 0
      };
      
      const orderPrice = order.price || 100; // Default price for market orders
      
      if (order.side === 'BUY') {
        const newTotalCost = currentPos.totalCost + (order.quantity * orderPrice);
        const newQuantity = currentPos.quantity + order.quantity;
        positionMap.set(order.symbol, {
          symbol: order.symbol,
          quantity: newQuantity,
          avgPrice: newQuantity > 0 ? newTotalCost / newQuantity : 0,
          totalCost: newTotalCost
        });
      } else { // SELL
        const newQuantity = currentPos.quantity - order.quantity;
        const sellValue = order.quantity * orderPrice;
        positionMap.set(order.symbol, {
          symbol: order.symbol,
          quantity: newQuantity,
          avgPrice: currentPos.avgPrice, // Keep same avg price on sells
          totalCost: currentPos.totalCost - (currentPos.avgPrice * order.quantity)
        });
      }
    });
    
    // Filter out zero positions and convert to array
    return Array.from(positionMap.values()).filter(pos => pos.quantity > 0);
  };

  const handleSubmitOrder = async (side: 'BUY' | 'SELL') => {
    if (!symbol || !quantity) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    if (orderType === 'LIMIT' && !price) {
      addToast('Please enter a price for limit orders', 'error');
      return;
    }

    // Market always open for demo/testing - no restrictions

    setLoading(true);
    setMessage('');

    try {
      const order = await apiClient.createOrder({
        accountId: DEMO_ACCOUNT_ID,
        ticker: symbol.toUpperCase(),
        type: orderType,
        side,
        quantity,
        price: orderType === 'LIMIT' ? price : undefined,
      });

      if (orderType === 'LIMIT') {
        addToast(`${side} LIMIT order submitted! ${quantity} shares of ${symbol.toUpperCase()} at $${price!.toFixed(2)} (pending execution)`, 'success');
      } else {
        const executionPrice = getBidAskPrice(symbol.toUpperCase(), price || 100, side);
        addToast(`${side} MARKET order placed! ${quantity} shares of ${symbol.toUpperCase()} at ~$${executionPrice.toFixed(2)}`, 'success');
      }
      
      // Increment order counter and add to recent orders
      setOrderCount(orderCount + 1);
      const displayPrice = orderType === 'LIMIT' ? 
        price! : 
        getBidAskPrice(symbol.toUpperCase(), price || 100, side);
        
      setRecentOrders(prev => [{
        symbol: symbol.toUpperCase(),
        side,
        quantity,
        type: orderType,
        price: displayPrice,
        time: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 4)]); // Keep only last 5 orders
      
      // Reset form
      setSymbol('');
      setQuantity(100);
      setPrice(undefined);
    } catch (error) {
      addToast(`Error placing order: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header style={{ 
        background: 'rgba(45, 55, 72, 0.95)', 
        backdropFilter: 'blur(10px)',
        padding: '1.5rem', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div className="container">
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #553c9a 0%, #b91c5c 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                📈
              </div>
              <h1 className="header-logo" style={{ 
                margin: 0,
                fontSize: '24px'
              }}>
                Paper Trading Platform
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setCurrentPage('market-data')}
                className={`nav-button ${currentPage === 'market-data' ? 'active' : ''}`}
              >
                📊 Market Data
              </button>
              <button 
                onClick={() => setCurrentPage('order-ticket')}
                className={`nav-button ${currentPage === 'order-ticket' ? 'active' : ''}`}
              >
                Order Ticket
              </button>
              <button 
                onClick={() => setCurrentPage('blotter')}
                className={`nav-button ${currentPage === 'blotter' ? 'active' : ''}`}
              >
                Blotter
              </button>
              <button 
                onClick={() => setCurrentPage('positions')}
                className={`nav-button ${currentPage === 'positions' ? 'active' : ''}`}
              >
                Positions
              </button>
              <button 
                onClick={() => setCurrentPage('account')}
                className={`nav-button ${currentPage === 'account' ? 'active' : ''}`}
              >
                Account
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="container">
        {currentPage === 'market-data' ? (
          <div className="card" key={priceUpdateTrigger}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>📊 Live Market Data</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ 
                  fontSize: '14px', 
                  color: '#68d391',
                  fontWeight: 'bold'
                }}>
                  Market OPEN (24/7 Demo Mode)
                </span>
              </div>
            </div>
            <p>Real-time market data for all available instruments. Prices update every 3 seconds during market hours.</p>
            
            {(() => {
              // Define all available stocks with their company info (prices come from backend)
              const stockInfo = {
                'AAPL': { name: 'Apple Inc.', sector: 'Technology' },
                'TSLA': { name: 'Tesla, Inc.', sector: 'Automotive' },
                'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology' },
                'MSFT': { name: 'Microsoft Corporation', sector: 'Technology' },
                'NVDA': { name: 'NVIDIA Corporation', sector: 'Technology' },
                'SPY': { name: 'SPDR S&P 500 ETF', sector: 'ETF' }
              };
              
              // Get available stocks from backend prices or fallback to static list
              const availableStocks = Object.keys(backendPrices).length > 0 
                ? Object.keys(backendPrices).map(symbol => ({
                    symbol,
                    name: stockInfo[symbol as keyof typeof stockInfo]?.name || symbol,
                    sector: stockInfo[symbol as keyof typeof stockInfo]?.sector || 'Unknown',
                    basePrice: backendPrices[symbol].previousClose
                  }))
                : [
                    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', basePrice: 229.15 },
                    { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive', basePrice: 333.25 },
                    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', basePrice: 212.91 },
                    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', basePrice: 213.53 },
                    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', basePrice: 180.78 },
                    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', sector: 'ETF', basePrice: 646.03 }
                  ];

              return (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                    gap: '15px',
                    marginBottom: '25px'
                  }}>
                    {availableStocks.map((stock) => {
                      // Use backend prices if available, otherwise fall back to local simulation
                      const backendPrice = backendPrices[stock.symbol];
                      const currentPrice = backendPrice ? backendPrice.price : getRealisticPrice(stock.symbol, stock.basePrice);
                      const priceChange = backendPrice ? backendPrice.change : (currentPrice - stock.basePrice);
                      const priceChangePercent = backendPrice ? backendPrice.changePercent : ((currentPrice - stock.basePrice) / stock.basePrice) * 100;
                      const isPositive = priceChange >= 0;
                      
                      return (
                        <div key={stock.symbol} style={{
                          padding: '15px',
                          backgroundColor: 'rgba(45, 55, 72, 0.8)',
                          borderRadius: '8px',
                          border: `1px solid ${isPositive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`,
                          transition: 'all 0.3s ease'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <h3 style={{ 
                                margin: '0 0 4px 0', 
                                fontSize: '18px', 
                                fontWeight: 'bold',
                                color: '#e2e8f0'
                              }}>
                                {stock.symbol}
                              </h3>
                              <p style={{ 
                                margin: '0 0 2px 0', 
                                fontSize: '13px', 
                                color: '#a0aec0',
                                lineHeight: '1.2'
                              }}>
                                {stock.name}
                              </p>
                              <span style={{ 
                                fontSize: '11px', 
                                color: '#68d391',
                                backgroundColor: 'rgba(72, 187, 120, 0.2)',
                                padding: '2px 6px',
                                borderRadius: '3px'
                              }}>
                                {stock.sector}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#e2e8f0',
                                marginBottom: '2px'
                              }}>
                                ${currentPrice.toFixed(2)}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: isPositive ? '#68d391' : '#fc8181',
                                fontWeight: '600'
                              }}>
                                {isPositive ? '+' : ''}${priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                          
                          {/* Quick action buttons */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <button
                              onClick={() => {
                                setCurrentPage('order-ticket');
                                setSymbol(stock.symbol);
                                setOrderType('MARKET');
                                addToast(`Pre-filled order ticket for ${stock.symbol}`, 'info');
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: 'rgba(72, 187, 120, 0.3)',
                                color: '#68d391',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              🔵 Buy
                            </button>
                            <button
                              onClick={() => {
                                setCurrentPage('order-ticket');
                                setSymbol(stock.symbol);
                                setOrderType('MARKET');
                                addToast(`Pre-filled sell order for ${stock.symbol}`, 'info');
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: 'rgba(245, 101, 101, 0.3)',
                                color: '#fc8181',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              🔴 Sell
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Market summary */}
                  <div style={{
                    padding: '15px',
                    backgroundColor: 'rgba(45, 55, 72, 0.6)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Market Summary</h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                      gap: '15px' 
                    }}>
                      <div>
                        <strong>Total Instruments:</strong> {availableStocks.length}
                      </div>
                      <div>
                        <strong>Market Status:</strong> 🟢 Open (24/7 Demo)
                      </div>
                      <div>
                        <strong>Update Frequency:</strong> Every 3 seconds
                      </div>
                      <div>
                        <strong>Last Update:</strong> {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : currentPage === 'order-ticket' ? (
          <div className="card">
            <h2>Order Ticket</h2>
            <p>Place your trading orders here. Orders are executed instantly in paper trading mode.</p>
            
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              padding: '8px 12px', 
              borderRadius: '6px',
              marginBottom: '15px',
              backgroundColor: 'rgba(72, 187, 120, 0.2)',
              border: '1px solid rgba(72, 187, 120, 0.4)'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#48bb78',
                marginRight: '8px'
              }}></div>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#68d391'
              }}>
                Market OPEN (24/7 Demo Mode)
              </span>
            </div>
            
            
            {message && (
              <div style={{ 
                padding: '10px', 
                marginTop: '10px',
                backgroundColor: message.includes('✅') ? 'rgba(72, 187, 120, 0.2)' : 'rgba(245, 101, 101, 0.2)',
                border: `1px solid ${message.includes('✅') ? 'rgba(72, 187, 120, 0.4)' : 'rgba(245, 101, 101, 0.4)'}`,
                borderRadius: '8px',
                color: message.includes('✅') ? '#68d391' : '#fc8181'
              }}>
                {message}
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label>Symbol: </label>
                <input 
                  type="text" 
                  placeholder="e.g. AAPL" 
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  style={{ marginLeft: '10px', padding: '5px' }} 
                  disabled={loading}
                />
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <label>Quantity: </label>
                <input 
                  type="number" 
                  placeholder="100" 
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  style={{ marginLeft: '10px', padding: '5px' }} 
                  disabled={loading}
                />
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <label>Order Type: </label>
                <select 
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
                  style={{ marginLeft: '10px', padding: '5px' }}
                  disabled={loading}
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                </select>
              </div>

              {orderType === 'LIMIT' && (
                <div style={{ marginBottom: '10px' }}>
                  <label>Price: </label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={price || ''}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || undefined)}
                    style={{ marginLeft: '10px', padding: '5px' }} 
                    disabled={loading}
                    step="0.01"
                  />
                </div>
              )}
              
              <div style={{ marginTop: '20px' }}>
                <button 
                  className="button-buy" 
                  style={{ marginRight: '10px' }}
                  onClick={() => handleSubmitOrder('BUY')}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Buy'}
                </button>
                <button 
                  className="button-sell"
                  onClick={() => handleSubmitOrder('SELL')}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Sell'}
                </button>
              </div>
            </div>

            {/* Mini Market Data Section */}
            <div className="card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '15px', color: '#e2e8f0' }}>Quick Market Data</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px'
              }}>
                {(() => {
                  const stockInfo = {
                    'AAPL': { name: 'Apple Inc.' },
                    'TSLA': { name: 'Tesla, Inc.' },
                    'GOOGL': { name: 'Alphabet Inc.' },
                    'MSFT': { name: 'Microsoft Corp.' },
                    'NVDA': { name: 'NVIDIA Corp.' },
                    'SPY': { name: 'S&P 500 ETF' }
                  };

                  const symbols = Object.keys(stockInfo);
                  return symbols.map((symbol) => {
                    const backendPrice = backendPrices[symbol];
                    const currentPrice = backendPrice ? backendPrice.price : 0;
                    const change = backendPrice ? backendPrice.change : 0;
                    const changePercent = backendPrice ? backendPrice.changePercent : 0;
                    const isPositive = change >= 0;

                    return (
                      <div key={symbol} style={{
                        padding: '10px',
                        backgroundColor: 'rgba(45, 55, 72, 0.6)',
                        borderRadius: '6px',
                        border: `1px solid ${isPositive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => setSymbol(symbol)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.8)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.6)';
                      }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '4px' 
                        }}>
                          <div>
                            <div style={{ 
                              fontWeight: 'bold', 
                              fontSize: '14px',
                              color: '#e2e8f0' 
                            }}>
                              {symbol}
                            </div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#a0aec0',
                              marginTop: '2px'
                            }}>
                              {stockInfo[symbol as keyof typeof stockInfo]?.name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              fontSize: '14px',
                              color: '#e2e8f0' 
                            }}>
                              ${currentPrice.toFixed(2)}
                            </div>
                            <div style={{ 
                              fontSize: '11px',
                              color: isPositive ? '#68d391' : '#fc8181',
                              fontWeight: '600'
                            }}>
                              {isPositive ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#718096',
                          fontStyle: 'italic'
                        }}>
                          Click to set symbol in order ticket
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        ) : currentPage === 'blotter' ? (
          <BlotterSection backendPrices={backendPrices} setCurrentPage={setCurrentPage} />
        ) : currentPage === 'portfolio' ? (
          <div className="card">
            <h2>Portfolio Summary</h2>
            <p>Your account balance and performance metrics.</p>
            
            {recentOrders.length > 0 && (
              <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: 'rgba(45, 55, 72, 0.6)', 
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <div><strong>Total Orders:</strong> {recentOrders.length}</div>
                  <div><strong>Buy Orders:</strong> {recentOrders.filter(o => o.side === 'BUY').length}</div>
                  <div><strong>Sell Orders:</strong> {recentOrders.filter(o => o.side === 'SELL').length}</div>
                </div>
            )}
          </div>
        ) : currentPage === 'positions' ? (
          <PositionsSection backendPrices={backendPrices} setCurrentPage={setCurrentPage} />
        ) : (
          <div className="card" key={priceUpdateTrigger}>
            <h2>Account Information</h2>
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h3>Account Details</h3>
                  <p><strong>Name:</strong> Demo User</p>
                  <p><strong>Email:</strong> demo@example.com</p>
                  <p><strong>Account ID:</strong> {DEMO_ACCOUNT_ID}</p>
                </div>
                <div>
                  <h3>Balances</h3>
                  {(() => {
                    const balances = calculateBalances();
                    return (
                      <>
                        <p><strong>Cash Balance:</strong> ${balances.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p><strong>Buying Power:</strong> ${balances.buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p><strong>Total Value:</strong> ${balances.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        {balances.totalInvested > 0 && (
                          <>
                            <p><strong>Amount Invested:</strong> ${balances.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p><strong>Market Value:</strong> ${balances.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(45, 55, 72, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h3>Trading Activity</h3>
                <p><strong>Orders Placed This Session:</strong> {orderCount}</p>
                {orderCount > 0 && (
                  <p style={{ color: '#68d391', fontWeight: 'bold' }}>
                    🎉 Great job! You've successfully placed {orderCount} order{orderCount > 1 ? 's' : ''}!
                  </p>
                )}
                
                {recentOrders.length > 0 && (
                  <div style={{ marginTop: '15px' }}>
                    <h4>Recent Orders:</h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {recentOrders.map((order, index) => (
                        <div key={index} style={{ 
                          padding: '8px', 
                          margin: '5px 0', 
                          backgroundColor: 'rgba(45, 55, 72, 0.8)', 
                          borderRadius: '6px',
                          fontSize: '0.9em',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0'
                        }}>
                          <span style={{ fontWeight: 'bold', color: order.side === 'BUY' ? '#28a745' : '#dc3545' }}>
                            {order.side}
                          </span>
                          {' '}
                          <strong>{order.quantity}</strong> {order.symbol}
                          {' '}
                          <span style={{ color: '#6c757d' }}>
                            ({order.type}{order.price ? ` @ $${order.price}` : ''}) - {order.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mini Market Data Section */}
              <div className="card" style={{ marginTop: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#e2e8f0' }}>Quick Market Data</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px'
                }}>
                  {(() => {
                    const stockInfo = {
                      'AAPL': { name: 'Apple Inc.' },
                      'TSLA': { name: 'Tesla, Inc.' },
                      'GOOGL': { name: 'Alphabet Inc.' },
                      'MSFT': { name: 'Microsoft Corp.' },
                      'NVDA': { name: 'NVIDIA Corp.' },
                      'SPY': { name: 'S&P 500 ETF' }
                    };

                    const symbols = Object.keys(stockInfo);
                    return symbols.map((symbol) => {
                      const backendPrice = backendPrices[symbol];
                      const currentPrice = backendPrice ? backendPrice.price : 0;
                      const change = backendPrice ? backendPrice.change : 0;
                      const changePercent = backendPrice ? backendPrice.changePercent : 0;
                      const isPositive = change >= 0;

                      return (
                        <div key={symbol} style={{
                          padding: '10px',
                          backgroundColor: 'rgba(45, 55, 72, 0.6)',
                          borderRadius: '6px',
                          border: `1px solid ${isPositive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => setCurrentPage('order-ticket')}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.8)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(45, 55, 72, 0.6)';
                        }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start',
                            marginBottom: '4px' 
                          }}>
                            <div>
                              <div style={{ 
                                fontWeight: 'bold', 
                                fontSize: '14px',
                                color: '#e2e8f0' 
                              }}>
                                {symbol}
                              </div>
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#a0aec0',
                                marginTop: '2px'
                              }}>
                                {stockInfo[symbol as keyof typeof stockInfo]?.name}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ 
                                fontWeight: 'bold', 
                                fontSize: '14px',
                                color: '#e2e8f0' 
                              }}>
                                ${currentPrice.toFixed(2)}
                              </div>
                              <div style={{ 
                                fontSize: '11px',
                                color: isPositive ? '#68d391' : '#fc8181',
                                fontWeight: '600'
                              }}>
                                {isPositive ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#718096',
                            fontStyle: 'italic'
                          }}>
                            Click to go to Order Ticket
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                {Object.keys(backendPrices).length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#a0aec0',
                    fontStyle: 'italic'
                  }}>
                    Enable Market Simulation to see live prices
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default App;