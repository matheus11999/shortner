const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');

// Configuração da conexão PostgreSQL
const getDatabaseUrl = () => {
  // Produção: postgres://mateus:260520jm@evoapi_url-db:5432/url?sslmode=disable
  // Desenvolvimento: postgres://mateus:260520jm@89.28.236.67:5555/url?sslmode=disable
  
  if (process.env.NODE_ENV === 'production') {
    return process.env.DATABASE_URL || 'postgres://mateus:260520jm@evoapi_url-db:5432/url?sslmode=disable';
  } else {
    return process.env.DATABASE_URL || 'postgres://mateus:260520jm@89.28.236.67:5555/url?sslmode=disable';
  }
};

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    const databaseUrl = getDatabaseUrl();
    
    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      console.log(`🐘 Connected to PostgreSQL database`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Database URL: ${databaseUrl.replace(/:[\w]+@/, ':***@')}`);
      
      client.release();

      await this.initTables();
      await this.createDefaultAdmin();
      
      this.isInitialized = true;
    } catch (err) {
      console.error('🚨 Error connecting to PostgreSQL:', err.message);
      throw err;
    }
  }

  async initTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'client',
        name VARCHAR(255) NOT NULL,
        custom_cpm DECIMAL(10,2) DEFAULT 0,
        api_token VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS adsites (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        api_token VARCHAR(255) UNIQUE NOT NULL,
        banner_code TEXT,
        forced_click BOOLEAN DEFAULT FALSE,
        timer_duration INTEGER DEFAULT 5,
        wp_api_url VARCHAR(500),
        wp_token VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS client_sites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        assigned_adsite_id INTEGER,
        integration_code VARCHAR(255) UNIQUE,
        magnet_intercept BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (assigned_adsite_id) REFERENCES adsites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS advertisements (
        id SERIAL PRIMARY KEY,
        adsite_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        redirect_url VARCHAR(500),
        step INTEGER NOT NULL,
        position INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS site_adsites (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL,
        adsite_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (site_id) REFERENCES client_sites (id),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        UNIQUE(site_id, adsite_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS short_urls (
        id SERIAL PRIMARY KEY,
        original_url TEXT NOT NULL,
        short_code VARCHAR(20) UNIQUE NOT NULL,
        user_id INTEGER,
        site_id INTEGER,
        clicks INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (site_id) REFERENCES client_sites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS click_analytics (
        id SERIAL PRIMARY KEY,
        short_url_id INTEGER NOT NULL,
        adsite_id INTEGER,
        user_id INTEGER,
        site_id INTEGER,
        session_id VARCHAR(255) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        referrer TEXT,
        country VARCHAR(100),
        city VARCHAR(100),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        step INTEGER NOT NULL,
        action VARCHAR(100) NOT NULL,
        banner_clicked BOOLEAN DEFAULT FALSE,
        time_spent INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        clicked_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (short_url_id) REFERENCES short_urls (id),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (site_id) REFERENCES client_sites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS unique_visitors (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        ip_address INET,
        user_agent TEXT,
        first_visit TIMESTAMP DEFAULT NOW(),
        last_visit TIMESTAMP DEFAULT NOW(),
        visit_count INTEGER DEFAULT 1
      )`,

      `CREATE TABLE IF NOT EXISTS wp_posts_cache (
        id SERIAL PRIMARY KEY,
        adsite_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        url VARCHAR(500) NOT NULL,
        cached_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id)
      )`,

      `CREATE TABLE IF NOT EXISTS banner_configs (
        id SERIAL PRIMARY KEY,
        adsite_id INTEGER NOT NULL,
        step INTEGER NOT NULL,
        banner_type VARCHAR(50) NOT NULL,
        position INTEGER NOT NULL,
        code TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        UNIQUE(adsite_id, step, banner_type, position)
      )`
    ];

    let tablesCreated = 0;
    for (const [index, table] of tables.entries()) {
      try {
        await this.pool.query(table);
        tablesCreated++;
      } catch (err) {
        console.error(`🚨 Error creating table ${index + 1}:`, err.message);
      }
    }

    console.log(`📋 Database initialized with ${tablesCreated}/${tables.length} tables`);
  }

  async createDefaultAdmin() {
    const adminEmail = 'admin@urlshortener.com';
    const adminPassword = 'admin123';
    
    try {
      const result = await this.pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
      
      if (result.rows.length === 0) {
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);
        await this.pool.query(
          'INSERT INTO users (email, password, role, name) VALUES ($1, $2, $3, $4)',
          [adminEmail, hashedPassword, 'admin', 'Administrator']
        );
        console.log('✅ Default admin user created');
        console.log('📧 Email:', adminEmail);
        console.log('🔑 Password:', adminPassword);
      } else {
        console.log('👤 Admin user already exists, skipping creation');
      }
    } catch (err) {
      console.error('🚨 Error creating admin user:', err.message);
    }
  }

  async query(text, params) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.pool.query(text, params);
  }

  async getClient() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.pool.connect();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 PostgreSQL connection pool closed');
    }
  }

  // Helper methods for compatibility with existing code
  async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    const result = await this.query(sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  }
}

// Export singleton instance
const databaseManager = new DatabaseManager();

// Auto-initialize on import with better error handling
databaseManager.initialize().catch(err => {
  console.error('🚨 Failed to initialize database:', err);
  console.error('Stack:', err.stack);
  // Don't exit process - let server start but log errors
  console.log('⚠️ Server starting without database connection');
});

module.exports = databaseManager;