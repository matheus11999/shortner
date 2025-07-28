const Database = require('better-sqlite3');
const path = require('path');

// Para produção, usar volume persistente
const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

class DatabaseManager {
  constructor() {
    try {
      this.db = new Database(dbPath);
      console.log('Connected to SQLite database');
      this.initTables();
    } catch (err) {
      console.error('Error opening database:', err.message);
    }
  }

  initTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client',
        name TEXT NOT NULL,
        custom_cpm REAL DEFAULT 0,
        api_token TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS adsites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        api_token TEXT UNIQUE NOT NULL,
        banner_code TEXT,
        forced_click BOOLEAN DEFAULT 0,
        timer_duration INTEGER DEFAULT 5,
        wp_api_url TEXT,
        wp_token TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS client_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        assigned_adsite_id INTEGER,
        integration_code TEXT UNIQUE,
        magnet_intercept BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (assigned_adsite_id) REFERENCES adsites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS advertisements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adsite_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        redirect_url TEXT,
        step INTEGER NOT NULL,
        position INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (adsite_id) REFERENCES adsites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS site_adsites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL,
        adsite_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (site_id) REFERENCES client_sites (id),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        UNIQUE(site_id, adsite_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS short_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        site_id INTEGER,
        clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (site_id) REFERENCES client_sites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS click_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        short_url_id INTEGER NOT NULL,
        adsite_id INTEGER,
        user_id INTEGER,
        site_id INTEGER,
        session_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        country TEXT,
        city TEXT,
        device_type TEXT,
        browser TEXT,
        os TEXT,
        step INTEGER NOT NULL,
        action TEXT NOT NULL,
        banner_clicked BOOLEAN DEFAULT 0,
        time_spent INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT 0,
        clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (short_url_id) REFERENCES short_urls (id),
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (site_id) REFERENCES client_sites (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS unique_visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
        visit_count INTEGER DEFAULT 1
      )`,

      `CREATE TABLE IF NOT EXISTS wp_posts_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adsite_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (adsite_id) REFERENCES adsites (id)
      )`,

      `CREATE TABLE IF NOT EXISTS banner_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adsite_id INTEGER NOT NULL,
        step INTEGER NOT NULL,
        banner_type TEXT NOT NULL,
        position INTEGER NOT NULL,
        code TEXT NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (adsite_id) REFERENCES adsites (id),
        UNIQUE(adsite_id, step, banner_type, position)
      )`
    ];

    tables.forEach((table, index) => {
      try {
        this.db.exec(table);
      } catch (err) {
        console.error(`Error creating table ${index + 1}:`, err.message);
      }
    });

    this.createDefaultAdmin();
  }

  createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@urlshortener.com';
    const adminPassword = 'admin123';
    
    try {
      const stmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
      const row = stmt.get(adminEmail);
      
      if (!row) {
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);
        const insertStmt = this.db.prepare(
          'INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)'
        );
        insertStmt.run(adminEmail, hashedPassword, 'admin', 'Administrator');
        console.log('Default admin user created');
        console.log('Email:', adminEmail);
        console.log('Password:', adminPassword);
      }
    } catch (err) {
      console.error('Error creating admin user:', err.message);
    }
  }

  getDB() {
    return this.db;
  }

  close() {
    try {
      this.db.close();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Helper methods for better-sqlite3
  prepare(sql) {
    return this.db.prepare(sql);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  // Compatibility methods
  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
}

module.exports = new DatabaseManager();