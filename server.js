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

// Configure trust proxy for production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP'
});

app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/urls', urlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/', redirectRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
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
    console.log(`Server running on port ${PORT}`);
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