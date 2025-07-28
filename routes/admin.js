const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { authenticateToken, requireAdmin, authenticateApiToken } = require('../middleware/auth');

const router = express.Router();

// Clientes
router.get('/clients', authenticateToken, requireAdmin, (req, res) => {
  try {
    const clients = database.all(
      `SELECT u.id, u.email, u.name, u.custom_cpm, u.created_at,
              COUNT(cs.id) as site_count
       FROM users u
       LEFT JOIN client_sites cs ON u.id = cs.user_id
       WHERE u.role = 'client'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(clients);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/clients', authenticateToken, requireAdmin, (req, res) => {
  const { email, password, name, customCpm = 0 } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const apiToken = uuidv4();

    const result = database.run(
      'INSERT INTO users (email, password, name, role, custom_cpm, api_token) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, 'client', customCpm, apiToken]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      email,
      name,
      customCpm,
      apiToken
    });
  } catch (err) {
    console.error('Database error:', err);
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/clients/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, customCpm, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const result = database.run(
      'UPDATE users SET name = ?, custom_cpm = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = ?',
      [name, customCpm || 0, email, parseInt(id), 'client']
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

router.delete('/clients/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = database.run(
      'DELETE FROM users WHERE id = ? AND role = "client"',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// AdSites
router.get('/adsites', authenticateToken, requireAdmin, (req, res) => {
  try {
    const adsites = database.all(
      `SELECT a.id, a.name, a.url, a.api_token, a.banner_code, a.forced_click, a.timer_duration, a.wp_api_url, a.wp_token, a.status, a.created_at, COUNT(ad.id) as ad_count
       FROM adsites a
       LEFT JOIN advertisements ad ON a.id = ad.adsite_id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    );
    
    // Convert snake_case to camelCase for frontend
    const formattedAdsites = adsites.map(adsite => ({
      id: adsite.id,
      name: adsite.name,
      url: adsite.url,
      apiToken: adsite.api_token,
      bannerCode: adsite.banner_code,
      forcedClick: adsite.forced_click === 1,
      timerDuration: adsite.timer_duration,
      wpApiUrl: adsite.wp_api_url,
      wpToken: adsite.wp_token,
      status: adsite.status,
      createdAt: adsite.created_at,
      adCount: adsite.ad_count
    }));
    
    res.json(formattedAdsites);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/adsites', authenticateToken, requireAdmin, (req, res) => {
  const { name, url, forcedClick, timerDuration } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    const apiToken = uuidv4();
    
    const result = database.run(
      'INSERT INTO adsites (name, url, api_token, forced_click, timer_duration) VALUES (?, ?, ?, ?, ?)',
      [name, url, apiToken, forcedClick ? 1 : 0, timerDuration || 5]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      url,
      apiToken,
      status: 'active',
      createdAt: new Date().toISOString(),
      adCount: 0
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/adsites/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, url, forcedClick, timerDuration, wpApiUrl, wpToken, status } = req.body;

  try {
    const result = database.run(
      'UPDATE adsites SET name = ?, url = ?, forced_click = ?, timer_duration = ?, wp_api_url = ?, wp_token = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, url, forcedClick ? 1 : 0, timerDuration || 5, wpApiUrl || null, wpToken || null, status || 'active', id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Adsite not found' });
    }

    res.json({ message: 'Adsite updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/adsites/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = database.run('DELETE FROM adsites WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Adsite not found' });
    }

    res.json({ message: 'Adsite deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Advertisements
router.get('/advertisements', authenticateToken, requireAdmin, (req, res) => {
  const { adsiteId } = req.query;

  try {
    let query = `
      SELECT ad.*, a.name as adsite_name
      FROM advertisements ad
      JOIN adsites a ON ad.adsite_id = a.id
    `;
    let params = [];

    if (adsiteId) {
      query += ' WHERE ad.adsite_id = ?';
      params.push(adsiteId);
    }

    query += ' ORDER BY ad.adsite_id, ad.step, ad.position';

    const ads = database.all(query, params);
    res.json(ads);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/advertisements', authenticateToken, requireAdmin, (req, res) => {
  const { adsiteId, type, content, redirectUrl, step, position = 0 } = req.body;

  if (!adsiteId || !type || !content || !step) {
    return res.status(400).json({ error: 'Adsite ID, type, content, and step are required' });
  }

  try {
    const result = database.run(
      'INSERT INTO advertisements (adsite_id, type, content, redirect_url, step, position) VALUES (?, ?, ?, ?, ?, ?)',
      [adsiteId, type, content, redirectUrl || null, step, position]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      adsiteId,
      type,
      content,
      redirectUrl,
      step,
      position
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/advertisements/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { type, content, redirectUrl, step, position, status } = req.body;

  try {
    const result = database.run(
      'UPDATE advertisements SET type = ?, content = ?, redirect_url = ?, step = ?, position = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [type, content, redirectUrl || null, step, position, status || 'active', id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Advertisement not found' });
    }

    res.json({ message: 'Advertisement updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/advertisements/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = database.run('DELETE FROM advertisements WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Advertisement not found' });
    }

    res.json({ message: 'Advertisement deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Download WordPress Plugin
router.get('/wordpress-plugin', authenticateToken, requireAdmin, (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const archiver = require('archiver');
  
  try {
    const pluginPath = path.join(__dirname, '../../wordpress-plugin');
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="url-shortener-adsite.zip"');
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(pluginPath, 'url-shortener-adsite');
    archive.finalize();
  } catch (err) {
    console.error('Plugin download error:', err);
    res.status(500).json({ error: 'Error generating plugin download' });
  }
});

// Banner Configurations
router.get('/banner-configs/:adsiteId', authenticateToken, requireAdmin, (req, res) => {
  const { adsiteId } = req.params;
  const { step } = req.query;

  try {
    let query = 'SELECT * FROM banner_configs WHERE adsite_id = ?';
    let params = [adsiteId];

    if (step) {
      query += ' AND step = ?';
      params.push(step);
    }

    query += ' ORDER BY step, banner_type, position';

    const configs = database.all(query, params);
    res.json(configs);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/banner-configs', authenticateToken, requireAdmin, (req, res) => {
  const { adsiteId, step, banners } = req.body;

  if (!adsiteId || !step || !banners) {
    return res.status(400).json({ error: 'AdSite ID, step, and banners configuration are required' });
  }

  try {
    // Primeiro, remover configurações existentes para este adsite e step
    database.run('DELETE FROM banner_configs WHERE adsite_id = ? AND step = ?', [adsiteId, step]);

    // Inserir novas configurações
    const insertStmt = database.prepare(`
      INSERT INTO banner_configs (adsite_id, step, banner_type, position, code, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Banners 300x250 (3 unidades)
    banners['300x250'].forEach((code, index) => {
      if (code && code.trim()) {
        insertStmt.run(adsiteId, step, '300x250', index + 1, code.trim(), 1);
      }
    });

    // Banners 728x90 (2 unidades)
    banners['728x90'].forEach((code, index) => {
      if (code && code.trim()) {
        insertStmt.run(adsiteId, step, '728x90', index + 1, code.trim(), 1);
      }
    });

    // Banner 300x600 (1 unidade)
    banners['300x600'].forEach((code, index) => {
      if (code && code.trim()) {
        insertStmt.run(adsiteId, step, '300x600', index + 1, code.trim(), 1);
      }
    });

    res.json({ message: 'Banner configuration saved successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/banner-configs/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { code, active } = req.body;

  try {
    const result = database.run(
      'UPDATE banner_configs SET code = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [code, active ? 1 : 0, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Banner configuration not found' });
    }

    res.json({ message: 'Banner configuration updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/banner-configs/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = database.run('DELETE FROM banner_configs WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Banner configuration not found' });
    }

    res.json({ message: 'Banner configuration deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Client Sites Management (Admin)
router.get('/client-sites', authenticateToken, requireAdmin, (req, res) => {
  const { clientId } = req.query;

  try {
    let query = `
      SELECT cs.*, u.name as client_name, u.email as client_email, a.name as adsite_name
      FROM client_sites cs
      JOIN users u ON cs.user_id = u.id
      LEFT JOIN adsites a ON cs.assigned_adsite_id = a.id
      WHERE 1=1
    `;
    let params = [];

    if (clientId) {
      query += ' AND cs.user_id = ?';
      params.push(clientId);
    }

    query += ' ORDER BY cs.created_at DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);
    
    const sites = database.all(query, params);
    console.log('Query result:', sites);
    res.json(sites);
  } catch (err) {
    console.error('Database error in client-sites:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/client-sites', authenticateToken, requireAdmin, (req, res) => {
  const { userId, name, url, assignedAdsiteId, magnetIntercept } = req.body;

  if (!userId || !name || !url) {
    return res.status(400).json({ error: 'User ID, name, and URL are required' });
  }

  try {
    // Gerar código de integração único
    const integrationCode = uuidv4();
    
    const result = database.run(
      'INSERT INTO client_sites (user_id, name, url, assigned_adsite_id, integration_code, magnet_intercept) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, url, assignedAdsiteId || null, integrationCode, magnetIntercept ? 1 : 0]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      userId,
      name,
      url,
      assignedAdsiteId,
      integrationCode,
      magnetIntercept: magnetIntercept ? 1 : 0,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/client-sites/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, url, assignedAdsiteId, magnetIntercept, status } = req.body;

  try {
    const result = database.run(
      'UPDATE client_sites SET name = ?, url = ?, assigned_adsite_id = ?, magnet_intercept = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, url, assignedAdsiteId || null, magnetIntercept ? 1 : 0, status || 'active', id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client site not found' });
    }

    res.json({ message: 'Client site updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/client-sites/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = database.run('DELETE FROM client_sites WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client site not found' });
    }

    res.json({ message: 'Client site deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// WordPress Plugin specific routes using API Token authentication
router.post('/wordpress/adsites', authenticateApiToken, requireAdmin, (req, res) => {
  const { name, url, forcedClick, timerDuration, wpApiUrl, wpToken } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    const apiToken = uuidv4();
    
    const result = database.run(
      'INSERT INTO adsites (name, url, api_token, forced_click, timer_duration, wp_api_url, wp_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, url, apiToken, forcedClick ? 1 : 0, timerDuration || 5, wpApiUrl, wpToken]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      url,
      apiToken,
      forcedClick: forcedClick ? 1 : 0,
      timerDuration: timerDuration || 5,
      wpApiUrl,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database error:', err);
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'AdSite with this name already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/wordpress/banner-configs/:adsiteId', authenticateApiToken, (req, res) => {
  const { adsiteId } = req.params;

  try {
    const configs = database.all(
      'SELECT * FROM banner_configs WHERE adsite_id = ? ORDER BY step, banner_type, position',
      [adsiteId]
    );
    res.json(configs);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/wordpress/sync-post', authenticateApiToken, (req, res) => {
  const postData = req.body;
  
  console.log('📝 WordPress post sync received:', postData.title);
  
  // For now, just log the post data and return success
  // In a real implementation, you would save this to wp_posts_cache table
  
  try {
    // Optional: Save to cache table if needed
    // const result = database.run(
    //   'INSERT OR REPLACE INTO wp_posts_cache (adsite_id, post_id, title, content, url) VALUES (?, ?, ?, ?, ?)',
    //   [req.user.id, postData.id, postData.title, postData.content, postData.url]
    // );
    
    res.json({ 
      success: true, 
      message: 'Post synchronized successfully',
      post: {
        id: postData.id,
        title: postData.title,
        url: postData.url
      }
    });
  } catch (err) {
    console.error('🚨 WordPress sync error:', err);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

module.exports = router;