import { Router } from 'express';
import { getMetrics } from '../middleware/metrics';

const router = Router();

/**
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain');
    res.send(await getMetrics());
  } catch (error: any) {
    res.status(500).send(`Error generating metrics: ${error.message}`);
  }
});

export default router;