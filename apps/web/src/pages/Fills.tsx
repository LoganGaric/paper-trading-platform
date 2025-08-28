import { useState, useEffect } from 'react';
import { apiClient, Fill } from '../api/client';

const DEMO_ACCOUNT_ID = 'cmervfosj0000c04oi42mn7zl';

export const Fills = (): JSX.Element => {
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFills = async () => {
    try {
      setLoading(true);
      const fillsData = await apiClient.getFills(DEMO_ACCOUNT_ID);
      setFills(fillsData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFills();
    
    // Refresh fills every 5 seconds
    const interval = setInterval(fetchFills, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: string) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateTradeValue = (quantity: number, price: string) => {
    return `$${(quantity * parseFloat(price)).toFixed(2)}`;
  };

  return (
    <div className="card">
      <h2>Fills</h2>
      <p>View all your executed trades here. Auto-refreshes every 5 seconds.</p>
      
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
          onClick={fetchFills} 
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

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Executed At</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Side</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Quantity</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Price</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Trade Value</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Fill ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && fills.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading fills...
                </td>
              </tr>
            ) : fills.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No fills yet. Place a market order to see executions here!
                </td>
              </tr>
            ) : (
              fills.map((fill) => (
                <tr key={fill.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{formatDateTime(fill.executedAt)}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{fill.symbol.ticker}</td>
                  <td style={{ 
                    padding: '10px', 
                    color: fill.side === 'BUY' ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {fill.side}
                  </td>
                  <td style={{ padding: '10px' }}>{fill.quantity.toLocaleString()}</td>
                  <td style={{ padding: '10px' }}>{formatPrice(fill.price)}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>
                    {calculateTradeValue(fill.quantity, fill.price)}
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.8em', color: '#666' }}>
                    {fill.id.substring(0, 8)}...
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {fills.length > 0 && (
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
            <strong>Total Fills: </strong>{fills.length}
            {' | '}
            <strong>Total Buy Volume: </strong>
            {fills
              .filter(f => f.side === 'BUY')
              .reduce((sum, f) => sum + f.quantity, 0)
              .toLocaleString()} shares
            {' | '}
            <strong>Total Sell Volume: </strong>
            {fills
              .filter(f => f.side === 'SELL')
              .reduce((sum, f) => sum + f.quantity, 0)
              .toLocaleString()} shares
          </div>
        )}
      </div>
    </div>
  );
};