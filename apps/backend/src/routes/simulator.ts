import { Router } from 'express';
import { ExecutionSimulator } from '../services/executionSimulator';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Global simulator instance (shared with orders route)
let simulatorInstance: ExecutionSimulator | null = null;

export const getSimulatorInstance = (): ExecutionSimulator => {
  if (!simulatorInstance) {
    simulatorInstance = new ExecutionSimulator(prisma);
  }
  return simulatorInstance;
};

// Start market simulation
router.post('/start', async (req, res) => {
  try {
    const simulator = getSimulatorInstance();
    await simulator.initialize();
    await simulator.startSimulation();
    
    res.json({
      success: true,
      message: 'Market simulation started',
      isRunning: true
    });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// Stop market simulation
router.post('/stop', async (req, res) => {
  try {
    const simulator = getSimulatorInstance();
    await simulator.stopSimulation();
    
    res.json({
      success: true,
      message: 'Market simulation stopped',
      isRunning: false
    });
  } catch (error) {
    console.error('Error stopping simulation:', error);
    res.status(500).json({ error: 'Failed to stop simulation' });
  }
});

// Get simulation status
router.get('/status', async (req, res) => {
  try {
    const simulator = getSimulatorInstance();
    const currentPrices = simulator.getCurrentPrices();
    const pendingOrders = simulator.getPendingOrders();
    
    // Get persistent state from database
    const state = await prisma.simulatorState.findFirst();
    const isRunning = state?.isRunning || false;
    const currentIndices = (state?.currentIndices as Record<string, number>) || {};
    
    const pricesArray = Array.from(currentPrices.entries()).map(([symbol, bar]) => ({
      symbol,
      price: bar.close,
      timestamp: bar.timestamp,
      volume: bar.volume,
      currentIndex: currentIndices[symbol] || 0
    }));
    
    res.json({
      isRunning,
      currentPrices: pricesArray,
      pendingOrdersCount: pendingOrders.length,
      pendingOrders: pendingOrders.map(order => ({
        orderId: order.orderId,
        type: order.type,
        side: order.side,
        quantity: order.quantity,
        remainingQuantity: order.remainingQuantity,
        price: order.price
      })),
      config: {
        playbackSpeedMs: state?.playbackSpeedMs || 3000,
        bidAskSpreadBps: state?.bidAskSpreadBps || 20,
        feePerShare: state?.feePerShare ? parseFloat(state.feePerShare.toString()) : 0.005,
        slippageBps: state?.slippageBps || 5,
        maxPartialFillPct: state?.maxPartialFillPct ? parseFloat(state.maxPartialFillPct.toString()) : 0.30
      }
    });
  } catch (error) {
    console.error('Error getting simulation status:', error);
    res.status(500).json({ error: 'Failed to get simulation status' });
  }
});

// Update simulation configuration
router.put('/config', async (req, res) => {
  try {
    const {
      bidAskSpreadBps,
      feePerShare,
      slippageBps,
      playbackSpeedMs,
      maxPartialFillPct
    } = req.body;

    const simulator = getSimulatorInstance();
    simulator.updateConfig({
      bidAskSpreadBps,
      feePerShare,
      slippageBps,
      playbackSpeedMs,
      maxPartialFillPct
    });
    
    res.json({
      success: true,
      message: 'Simulation configuration updated'
    });
  } catch (error) {
    console.error('Error updating simulation config:', error);
    res.status(500).json({ error: 'Failed to update simulation config' });
  }
});

export default router;