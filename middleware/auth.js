const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Use same fallback as in auth route
  const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
  
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      console.log('🚨 JWT verification error:', err.message);
      console.log('🔍 Token received:', token.substring(0, 20) + '...');
      console.log('📋 Request from:', req.get('User-Agent') || 'Unknown');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireClient = (req, res, next) => {
  if (req.user.role !== 'client' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Client access required' });
  }
  next();
};

const authenticateApiToken = async (req, res, next) => {
  const apiToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-token'];
  
  if (!apiToken) {
    return res.status(401).json({ error: 'API token required' });
  }

  try {
    const user = await database.get(
      'SELECT id, email, role FROM users WHERE api_token = $1',
      [apiToken]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid API token' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('🚨 API Token auth error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireClient,
  authenticateApiToken
};