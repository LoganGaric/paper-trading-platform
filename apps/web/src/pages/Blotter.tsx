import { useState, useEffect } from 'react';
import { apiClient, Order } from '../api/client';

const DEMO_ACCOUNT_ID = 'cmet25ndn000013oj3yflwmti';

export const Blotter = (): JSX.Element => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersData = await apiClient.getOrders(DEMO_ACCOUNT_ID);
      setOrders(ordersData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Refresh orders every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: string | undefined) => {
    if (!price) return 'Market';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return '#28a745';
      case 'CANCELLED':
        return '#dc3545';
      case 'PENDING':
        return '#ffc107';
      case 'PARTIALLY_FILLED':
        return '#fd7e14';
      case 'REJECTED':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    setCancellingOrders(prev => new Set(prev).add(orderId));
    try {
      await apiClient.cancelOrder(orderId);
      setError('');
      // Refresh orders to show updated status
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const canCancelOrder = (order: Order): boolean => {
    const canCancel = order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED';
    console.log(`Order ${order.id}: status=${order.status}, canCancel=${canCancel}`);
    return canCancel;
  };

  const getFilledQuantity = (order: Order): number => {
    if (!order.fills || order.fills.length === 0) return 0;
    return order.fills.reduce((total: number, fill: any) => total + fill.quantity, 0);
  };

  const formatFilledProgress = (order: Order): string => {
    const filled = getFilledQuantity(order);
    const total = order.quantity;
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
    
    if (filled === 0) {
      return `0/${total}`;
    }
    return `${filled}/${total} (${percentage}%)`;
  };

  const getRemainingQuantity = (order: Order): number => {
    const filled = getFilledQuantity(order);
    return order.quantity - filled;
  };

  return (
    <div className="card">
      <h2 style={{color: 'lime', fontSize: '32px', backgroundColor: 'black', padding: '20px', border: '5px solid red'}}>🚨 TEST UPDATE - CAN YOU SEE THIS? 🚨</h2>
      <p style={{color: 'blue', fontSize: '24px', fontWeight: 'bold'}}>⭐ IF YOU CAN SEE THIS BIG BLUE TEXT, THE PAGE IS UPDATING! ⭐</p>
      <p>View all your orders and their status here. Auto-refreshes every 5 seconds. Cancel pending orders using the Actions column.</p>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          marginTop: '10px'
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={fetchOrders} 
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

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Time</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Symbol</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Side</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Quantity</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Filled</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Remaining</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Price</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Order ID</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && orders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No orders yet. Place your first order using the Order Ticket!
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formatDateTime(order.createdAt)}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #ddd' }}>{order.instrument?.symbol || 'N/A'}</td>
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
                  <td style={{ 
                    padding: '10px',
                    fontWeight: '600',
                    color: getRemainingQuantity(order) === 0 ? '#28a745' : '#dc3545',
                    border: '1px solid #ddd'
                  }}>
                    {getRemainingQuantity(order).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formatPrice(order.price)}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};