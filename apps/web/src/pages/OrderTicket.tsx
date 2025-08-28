import { useState } from 'react';
import { apiClient } from '../api/client';

// Demo account ID - in a real app, this would come from authentication
const DEMO_ACCOUNT_ID = 'cmervfosj0000c04oi42mn7zl';

export const OrderTicket = (): JSX.Element => {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmitOrder = async (side: 'BUY' | 'SELL') => {
    if (!symbol || !quantity) {
      setMessage('Please fill in all required fields');
      return;
    }

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

      setMessage(`✅ Order placed successfully! Order ID: ${order.id}`);
      
      // Reset form
      setSymbol('');
      setQuantity(100);
      setPrice(undefined);
    } catch (error) {
      setMessage(`❌ Error placing order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Order Ticket</h2>
      <p>Place your trading orders here. Orders are executed instantly in paper trading mode.</p>
      
      {message && (
        <div style={{ 
          padding: '10px', 
          marginTop: '10px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          color: message.includes('✅') ? '#155724' : '#721c24'
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
            className="button" 
            style={{ marginRight: '10px' }}
            onClick={() => handleSubmitOrder('BUY')}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Buy'}
          </button>
          <button 
            className="button secondary"
            onClick={() => handleSubmitOrder('SELL')}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
};