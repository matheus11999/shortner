const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Login attempt for:', email);
  console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = database.get('SELECT * FROM users WHERE email = ?', [email]);
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

router.post('/register', (req, res) => {
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
    const result = database.run(
      'INSERT INTO users (email, password, name, role, api_token) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, 'client', apiToken]
    );

    const token = jwt.sign(
      { id: result.lastInsertRowid, email, role: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.lastInsertRowid,
        email,
        name,
        role: 'client'
      }
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Database error' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = database.get(
      'SELECT id, email, name, role, custom_cpm, api_token FROM users WHERE id = ?',
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
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/refresh-token', authenticateToken, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, role: req.user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token });
});

module.exports = router;