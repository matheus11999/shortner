const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
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

const authenticateApiToken = (req, res, next) => {
  const apiToken = req.headers['x-api-token'];
  
  if (!apiToken) {
    return res.status(401).json({ error: 'API token required' });
  }

  try {
    const user = database.get(
      'SELECT id, email, role FROM users WHERE api_token = ?',
      [apiToken]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid API token' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireClient,
  authenticateApiToken
};