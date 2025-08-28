import { Router } from 'express';
import { RiskEngine } from '../services/riskEngine';

const router = Router();

// Get current risk limits
router.get('/limits', async (req, res) => {
  try {
    const limits = RiskEngine.getRiskLimits();
    res.json(limits);
  } catch (error) {
    console.error('Error fetching risk limits:', error);
    res.status(500).json({ error: 'Failed to fetch risk limits' });
  }
});

// Update risk limits
router.put('/limits', async (req, res) => {
  try {
    const updates = req.body;
    RiskEngine.updateRiskLimits(updates);
    const newLimits = RiskEngine.getRiskLimits();
    res.json(newLimits);
  } catch (error) {
    console.error('Error updating risk limits:', error);
    res.status(500).json({ error: 'Failed to update risk limits' });
  }
});

// Enable kill switch
router.post('/kill-switch/enable', async (req, res) => {
  try {
    await RiskEngine.enableKillSwitch();
    res.json({ 
      success: true, 
      message: 'Global kill switch activated - all new orders blocked',
      killSwitchActive: true 
    });
  } catch (error) {
    console.error('Error enabling kill switch:', error);
    res.status(500).json({ error: 'Failed to enable kill switch' });
  }
});

// Disable kill switch
router.post('/kill-switch/disable', async (req, res) => {
  try {
    await RiskEngine.disableKillSwitch();
    res.json({ 
      success: true, 
      message: 'Global kill switch deactivated - normal trading resumed',
      killSwitchActive: false 
    });
  } catch (error) {
    console.error('Error disabling kill switch:', error);
    res.status(500).json({ error: 'Failed to disable kill switch' });
  }
});

// Get kill switch status
router.get('/kill-switch', async (req, res) => {
  try {
    const isActive = RiskEngine.isKillSwitchActive();
    res.json({ 
      killSwitchActive: isActive,
      message: isActive ? 'Kill switch is ACTIVE - new orders blocked' : 'Kill switch is INACTIVE - normal trading'
    });
  } catch (error) {
    console.error('Error checking kill switch status:', error);
    res.status(500).json({ error: 'Failed to check kill switch status' });
  }
});

export default router;