const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Login attempt for:', email);
  console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await database.get('SELECT * FROM users WHERE email = $1', [email]);
    console.log('👤 User found:', !!user);

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    console.log('🔒 Password match:', passwordMatch);

    if (!passwordMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Use default JWT secret if not provided
    const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for:', email);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('🚨 Login error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const apiToken = uuidv4();

  try {
    const result = await database.query(
      'INSERT INTO users (email, password, name, role, api_token) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [email, hashedPassword, name, 'client', apiToken]
    );

    const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
    const token = jwt.sign(
      { id: result.rows[0].id, email, role: 'client' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.rows[0].id,
        email,
        name,
        role: 'client'
      }
    });
  } catch (err) {
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('🚨 Register error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await database.get(
      'SELECT id, email, name, role, custom_cpm, api_token FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      customCpm: user.custom_cpm,
      apiToken: user.api_token
    });
  } catch (err) {
    console.error('🚨 Get user error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Endpoint específico para WordPress Plugin usando API Token
router.get('/me-api', async (req, res) => {
  const apiToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-token'];
  
  console.log('🔗 WordPress plugin auth attempt');
  console.log('🔑 API Token provided:', !!apiToken);
  
  if (!apiToken) {
    console.log('❌ No API token provided');
    return res.status(401).json({ error: 'API token required' });
  }

  try {
    const user = await database.get(
      'SELECT id, email, name, role, custom_cpm, api_token FROM users WHERE api_token = $1',
      [apiToken]
    );
    
    console.log('👤 User found by API token:', !!user);
    
    if (!user) {
      console.log('❌ Invalid API token');
      return res.status(401).json({ error: 'Invalid API token' });
    }
    
    console.log('✅ WordPress plugin auth successful for:', user.email);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      customCpm: user.custom_cpm,
      apiToken: user.api_token
    });
  } catch (err) {
    console.error('🚨 WordPress auth error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/refresh-token', authenticateToken, (req, res) => {
  const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, role: req.user.role },
    jwtSecret,
    { expiresIn: '24h' }
  );

  res.json({ token });
});

module.exports = router;