import { useState, useEffect } from 'react';
import { apiClient, Position } from '../api/client';

const DEMO_ACCOUNT_ID = 'cmet25ndn000013oj3yflwmti';

export const Positions = (): JSX.Element => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const positionsData = await apiClient.getPositions(DEMO_ACCOUNT_ID);
      setPositions(positionsData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    
    // Refresh positions every 5 seconds
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: string) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const formatPnL = (pnl: string) => {
    const value = parseFloat(pnl);
    const color = value >= 0 ? '#28a745' : '#dc3545';
    const sign = value >= 0 ? '+' : '';
    return (
      <span style={{ color, fontWeight: 'bold' }}>
        {sign}${value.toFixed(2)}
      </span>
    );
  };

  const calculateTotalPnL = () => {
    return positions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPL), 0);
  };

  const calculateTotalValue = () => {
    return positions.reduce((sum, pos) => sum + parseFloat(pos.marketValue), 0);
  };

  const handleResetPositions = async () => {
    if (!window.confirm('Are you sure you want to reset all positions? This will clear all positions, orders, and trading history. This action cannot be undone.')) {
      return;
    }

    try {
      setResetting(true);
      const result = await apiClient.resetPositions(DEMO_ACCOUNT_ID);
      setError('');
      
      // Show success message with details
      const successMsg = `✅ Complete reset successful! Cleared ${result.deletedPositions} positions, ${result.deletedOrders} orders, ${result.deletedEvents} events, and ${result.deletedFills} fills.`;
      
      // Refresh positions after reset
      await fetchPositions();
      
      // You could add a toast notification here if you have a toast system
      console.log(successMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset account data');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="card">
      <h2>Positions</h2>
      <p>View your current positions and P&L here. Auto-refreshes every 5 seconds.</p>
      
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
        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchPositions} 
            disabled={loading}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          {positions.length > 0 && (
            <button 
              onClick={handleResetPositions} 
              disabled={resetting || loading}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (resetting || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {resetting ? 'Resetting...' : 'Reset All Positions'}
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Quantity</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Avg Price</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Current Price</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Market Value</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Unrealized P&L</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>P&L %</th>
            </tr>
          </thead>
          <tbody>
            {loading && positions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading positions...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No positions yet. Buy some shares to see positions here!
                </td>
              </tr>
            ) : (
              positions.map((position) => {
                const pnlPercent = (parseFloat(position.unrealizedPL) / (position.quantity * parseFloat(position.avgPrice))) * 100;
                return (
                  <tr key={position.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{position.symbol.ticker}</td>
                    <td style={{ padding: '10px' }}>{position.quantity.toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>{formatPrice(position.avgPrice)}</td>
                    <td style={{ padding: '10px' }}>{formatPrice(position.symbol.price)}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{formatPrice(position.marketValue)}</td>
                    <td style={{ padding: '10px' }}>{formatPnL(position.unrealizedPL)}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ 
                        color: pnlPercent >= 0 ? '#28a745' : '#dc3545',
                        fontWeight: 'bold'
                      }}>
                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        
        {positions.length > 0 && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#e9ecef', 
            borderRadius: '4px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px'
          }}>
            <div>
              <strong>Total Positions: </strong>{positions.length}
            </div>
            <div>
              <strong>Total Market Value: </strong>
              <span style={{ fontWeight: 'bold' }}>
                ${calculateTotalValue().toFixed(2)}
              </span>
            </div>
            <div>
              <strong>Total Unrealized P&L: </strong>
              <span style={{ 
                color: calculateTotalPnL() >= 0 ? '#28a745' : '#dc3545',
                fontWeight: 'bold'
              }}>
                {calculateTotalPnL() >= 0 ? '+' : ''}${calculateTotalPnL().toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};