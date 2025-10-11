import { Router } from 'express';

const router = Router();

// Basic view routes for the application
router.get('/', (req, res) => {
  res.json({ 
    message: 'Trek Tribe API Server',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/404', (req, res) => {
  res.status(404).json({ 
    error: 'Page not found',
    path: req.originalUrl 
  });
});

router.get('/error', (req, res) => {
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

export default router;