import { useState, useEffect } from 'react';
import { apiClient, Account as AccountType } from '../api/client';

const DEMO_ACCOUNT_ID = 'cmervfosj0000c04oi42mn7zl';

export const Account = (): JSX.Element => {
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAccount = async () => {
    try {
      setLoading(true);
      const accountData = await apiClient.getAccount(DEMO_ACCOUNT_ID);
      setAccount(accountData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
    
    // Refresh account every 10 seconds
    const interval = setInterval(fetchAccount, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const calculateEquity = () => {
    if (!account) return '$0.00';
    // For now, equity = cash balance + positions value
    // In a real app, this would include position values
    return formatCurrency(account.balance);
  };

  return (
    <div className="card">
      <h2>Account Information</h2>
      <p>View your account details and balances here. Auto-refreshes every 10 seconds.</p>
      
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
          onClick={fetchAccount} 
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            marginBottom: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>

        {loading && !account ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            Loading account information...
          </div>
        ) : account ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}>
              <h3>Account Details</h3>
              <p><strong>Name:</strong> {account.name}</p>
              <p><strong>Email:</strong> {account.email}</p>
              <p><strong>Account ID:</strong> {account.id.substring(0, 8)}...</p>
              <p><strong>Created:</strong> {new Date(account.createdAt).toLocaleDateString()}</p>
            </div>
            <div style={{ 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              backgroundColor: '#e9f7ef'
            }}>
              <h3>Balances</h3>
              <p><strong>Cash Balance:</strong> {formatCurrency(account.balance)}</p>
              <p><strong>Buying Power:</strong> {formatCurrency(account.buyingPower)}</p>
              <p><strong>Total Equity:</strong> {calculateEquity()}</p>
              <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
                Last updated: {new Date(account.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No account data available
          </div>
        )}
      </div>
    </div>
  );
};