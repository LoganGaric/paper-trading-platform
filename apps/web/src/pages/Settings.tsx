import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const API_BASE_URL = 'http://localhost:4000';

interface RiskLimits {
  maxOrdersPerDay: number;
  maxNotionalPerSymbol: number;
  maxQuantityPerSymbol: number;
  killSwitchActive: boolean;
}

interface SimulatorConfig {
  bidAskSpreadBps: number;
  feePerShare: number;
  slippageBps: number;
  playbackSpeedMs: number;
  maxPartialFillPct: number;
}

export const Settings = (): JSX.Element => {
  const [riskLimits, setRiskLimits] = useState<RiskLimits | null>(null);
  const [simulatorConfig, setSimulatorConfig] = useState<SimulatorConfig>({
    bidAskSpreadBps: 20,
    feePerShare: 0.005,
    slippageBps: 5,
    playbackSpeedMs: 3000,
    maxPartialFillPct: 0.3
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRiskLimits();
  }, []);

  const fetchRiskLimits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/risk/limits`);
      const limits = await response.json();
      setRiskLimits(limits);
    } catch (error) {
      console.error('Failed to fetch risk limits:', error);
    }
  };

  const updateRiskLimits = async () => {
    if (!riskLimits) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/risk/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskLimits)
      });
      
      if (response.ok) {
        setMessage('✅ Risk limits updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Failed to update risk limits');
      }
    } catch (error) {
      setMessage('❌ Failed to update risk limits');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const updateSimulatorConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/simulator/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulatorConfig)
      });
      
      if (response.ok) {
        setMessage('✅ Simulator configuration updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Failed to update simulator config');
      }
    } catch (error) {
      setMessage('❌ Failed to update simulator configuration');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const toggleKillSwitch = async () => {
    if (!riskLimits) return;
    
    setLoading(true);
    try {
      const endpoint = riskLimits.killSwitchActive ? 'disable' : 'enable';
      const response = await fetch(`${API_BASE_URL}/api/risk/kill-switch/${endpoint}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        setRiskLimits({ ...riskLimits, killSwitchActive: result.killSwitchActive });
        setMessage(`✅ ${result.message}`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Failed to toggle kill switch');
      }
    } catch (error) {
      setMessage('❌ Failed to toggle kill switch');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Settings</h2>
      <p>Configure your trading platform risk limits and simulator parameters.</p>
      
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
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Risk Management</h3>
          {riskLimits && (
            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Max Orders Per Day:
                <input 
                  type="number" 
                  value={riskLimits.maxOrdersPerDay}
                  onChange={(e) => setRiskLimits({ ...riskLimits, maxOrdersPerDay: parseInt(e.target.value) })}
                  style={{ marginLeft: '10px', padding: '5px', width: '100px' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Max Notional Per Symbol:
                <input 
                  type="number" 
                  value={riskLimits.maxNotionalPerSymbol}
                  onChange={(e) => setRiskLimits({ ...riskLimits, maxNotionalPerSymbol: parseInt(e.target.value) })}
                  style={{ marginLeft: '10px', padding: '5px', width: '120px' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '15px' }}>
                Max Quantity Per Symbol:
                <input 
                  type="number" 
                  value={riskLimits.maxQuantityPerSymbol}
                  onChange={(e) => setRiskLimits({ ...riskLimits, maxQuantityPerSymbol: parseInt(e.target.value) })}
                  style={{ marginLeft: '10px', padding: '5px', width: '120px' }}
                />
              </label>
              <div style={{ marginBottom: '15px' }}>
                <button 
                  onClick={toggleKillSwitch}
                  disabled={loading}
                  style={{ 
                    padding: '8px 16px', 
                    marginRight: '10px',
                    backgroundColor: riskLimits.killSwitchActive ? '#dc3545' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {riskLimits.killSwitchActive ? 'Disable Kill Switch' : 'Enable Kill Switch'}
                </button>
                <span style={{ 
                  color: riskLimits.killSwitchActive ? '#dc3545' : '#28a745',
                  fontWeight: 'bold'
                }}>
                  {riskLimits.killSwitchActive ? '🔴 ACTIVE - Orders Blocked' : '🟢 INACTIVE - Normal Trading'}
                </span>
              </div>
              <button 
                onClick={updateRiskLimits}
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
                {loading ? 'Updating...' : 'Update Risk Limits'}
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Simulator Configuration</h3>
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Bid-Ask Spread (bps):
              <input 
                type="number" 
                value={simulatorConfig.bidAskSpreadBps}
                onChange={(e) => setSimulatorConfig({ ...simulatorConfig, bidAskSpreadBps: parseFloat(e.target.value) })}
                style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                step="1"
              />
              <small style={{ marginLeft: '10px', color: '#666' }}>({(simulatorConfig.bidAskSpreadBps / 100).toFixed(2)}%)</small>
            </label>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Fee Per Share:
              <input 
                type="number" 
                value={simulatorConfig.feePerShare}
                onChange={(e) => setSimulatorConfig({ ...simulatorConfig, feePerShare: parseFloat(e.target.value) })}
                style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                step="0.001"
              />
            </label>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Slippage (bps):
              <input 
                type="number" 
                value={simulatorConfig.slippageBps}
                onChange={(e) => setSimulatorConfig({ ...simulatorConfig, slippageBps: parseFloat(e.target.value) })}
                style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                step="1"
              />
              <small style={{ marginLeft: '10px', color: '#666' }}>({(simulatorConfig.slippageBps / 100).toFixed(2)}%)</small>
            </label>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Playback Speed (ms):
              <input 
                type="number" 
                value={simulatorConfig.playbackSpeedMs}
                onChange={(e) => setSimulatorConfig({ ...simulatorConfig, playbackSpeedMs: parseInt(e.target.value) })}
                style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                step="100"
              />
            </label>
            <label style={{ display: 'block', marginBottom: '15px' }}>
              Max Partial Fill %:
              <input 
                type="number" 
                value={simulatorConfig.maxPartialFillPct * 100}
                onChange={(e) => setSimulatorConfig({ ...simulatorConfig, maxPartialFillPct: parseFloat(e.target.value) / 100 })}
                style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                step="5"
                min="0"
                max="100"
              />
            </label>
            <button 
              onClick={updateSimulatorConfig}
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
              {loading ? 'Updating...' : 'Update Simulator Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};