import express from 'express';

const router = express.Router();

// Debug token endpoints have been permanently decommissioned for security
router.all('*', (_req, res) => {
  res.status(404).json({ success: false, message: 'Debug endpoints are disabled' });
});

export default router;
