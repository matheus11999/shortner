const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const database = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const urlRoutes = require('./routes/urls');
const redirectRoutes = require('./routes/redirect');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure trust proxy - always enable in production or when behind reverse proxy
// EasyPanel runs behind reverse proxy, so we need this
app.set('trust proxy', 1);

console.log(`🔧 Trust proxy enabled. NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🌍 CLIENT_URL: ${process.env.CLIENT_URL}`);
console.log(`🐘 DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP',
  // Explicitly configure for proxy environments
  trustProxy: true
});

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration - Maximum permissive for EasyPanel
app.use(cors({
  origin: true, // Accept all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-API-Token'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Additional CORS headers middleware - maximum permissive
app.use((req, res, next) => {
  // Always set permissive CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-API-Token');
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('✈️ OPTIONS preflight for:', req.headers.origin);
    return res.status(200).end();
  }
  
  next();
});

// Log all incoming requests (moved before routes)
app.use((req, res, next) => {
  console.log(`📋 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('   Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/urls', urlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/', redirectRoutes);

// Enhanced error logging middleware
app.use((err, req, res, next) => {
  console.error('🚨 ERROR OCCURRED:');
  console.error('Time:', new Date().toISOString());
  console.error('URL:', req.method, req.originalUrl);
  console.error('Headers:', req.headers);
  console.error('Body:', req.body);
  console.error('Error Stack:', err.stack);
  console.error('Error Message:', err.message);
  console.error('========================');
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    ...(process.env.NODE_ENV !== 'production' && { details: err.message })
  });
});

// Função para fechar qualquer processo usando a porta
function killPortProcess(port) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    
    // Tentar encontrar e matar processo na porta (Linux/Mac)
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (stdout) {
        const pid = stdout.trim();
        exec(`kill -9 ${pid}`, (killError) => {
          if (!killError) {
            console.log(`Processo na porta ${port} foi finalizado`);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Tentar fechar porta antes de iniciar
killPortProcess(PORT).then(() => {
  const server = app.listen(PORT, () => {
    console.log('🚀 ================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 Database: ${process.env.DB_PATH || 'default sqlite'}`);
    console.log(`🚀 Client URL: ${process.env.CLIENT_URL || 'not set'}`);
    console.log('🚀 ================================');
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Porta ${PORT} ainda está em uso. Tentando novamente em 2 segundos...`);
      setTimeout(() => {
        killPortProcess(PORT).then(() => {
          server.listen(PORT);
        });
      }, 2000);
    } else {
      console.error('Erro no servidor:', err);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await database.close();
  process.exit(0);
});