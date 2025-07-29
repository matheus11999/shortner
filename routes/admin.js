const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { authenticateToken, requireAdmin, authenticateApiToken, authenticateAdsiteToken } = require('../middleware/auth');

const router = express.Router();

// Clientes
router.get('/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const clients = await database.all(
      `SELECT u.id, u.email, u.name, u.custom_cpm, u.created_at,
              COUNT(cs.id) as site_count
       FROM users u
       LEFT JOIN client_sites cs ON u.id = cs.user_id
       WHERE u.role = 'client'
       GROUP BY u.id, u.email, u.name, u.custom_cpm, u.created_at
       ORDER BY u.created_at DESC`
    );
    res.json(clients);
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/clients', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, customCpm = 0 } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const apiToken = uuidv4();

    const result = await database.query(
      'INSERT INTO users (email, password, name, role, custom_cpm, api_token) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [email, hashedPassword, name, 'client', customCpm, apiToken]
    );

    res.status(201).json({
      id: result.rows[0].id,
      email,
      name,
      customCpm,
      apiToken
    });
  } catch (err) {
    console.error('🚨 Database error:', err);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.put('/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, customCpm, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const result = await database.query(
      'UPDATE users SET name = $1, custom_cpm = $2, email = $3, updated_at = NOW() WHERE id = $4 AND role = $5',
      [name, customCpm || 0, email, parseInt(id), 'client']
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.delete('/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await database.query(
      'DELETE FROM users WHERE id = $1 AND role = $2',
      [id, 'client']
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// AdSites
router.get('/adsites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adsites = await database.all(
      `SELECT a.*, 
              COUNT(cs.id) as assigned_sites_count
       FROM adsites a
       LEFT JOIN client_sites cs ON a.id = cs.assigned_adsite_id
       GROUP BY a.id, a.name, a.url, a.api_token, a.banner_code, a.forced_click, a.timer_duration, a.wp_api_url, a.wp_token, a.status, a.created_at, a.updated_at
       ORDER BY a.created_at DESC`
    );

    // Convert snake_case to camelCase for frontend compatibility
    const formattedAdsites = adsites.map(adsite => ({
      ...adsite,
      apiToken: adsite.api_token,
      bannerCode: adsite.banner_code,
      forcedClick: adsite.forced_click,
      timerDuration: adsite.timer_duration,
      wpApiUrl: adsite.wp_api_url,
      wpToken: adsite.wp_token,
      createdAt: adsite.created_at,
      updatedAt: adsite.updated_at,
      assignedSitesCount: adsite.assigned_sites_count
    }));

    res.json(formattedAdsites);
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/adsites', authenticateToken, requireAdmin, async (req, res) => {
  const { name, url, forcedClick, timerDuration, wpApiUrl, wpToken } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    const apiToken = uuidv4();
    
    const result = await database.query(
      'INSERT INTO adsites (name, url, api_token, forced_click, timer_duration, wp_api_url, wp_token) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, url, apiToken, forcedClick || false, timerDuration || 5, wpApiUrl, wpToken]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name,
      url,
      apiToken,
      forcedClick: forcedClick || false,
      timerDuration: timerDuration || 5,
      wpApiUrl,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('🚨 Database error:', err);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'AdSite with this name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.put('/adsites/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, url, forcedClick, timerDuration, wpApiUrl, wpToken, status } = req.body;

  try {
    const result = await database.query(
      'UPDATE adsites SET name = $1, url = $2, forced_click = $3, timer_duration = $4, wp_api_url = $5, wp_token = $6, status = $7, updated_at = NOW() WHERE id = $8',
      [name, url, forcedClick || false, timerDuration || 5, wpApiUrl, wpToken, status || 'active', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'AdSite not found' });
    }

    res.json({ message: 'AdSite updated successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.delete('/adsites/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await database.query('DELETE FROM adsites WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'AdSite not found' });
    }

    res.json({ message: 'AdSite deleted successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Banner Configs
router.get('/banner-configs/:adsiteId', authenticateToken, requireAdmin, async (req, res) => {
  const { adsiteId } = req.params;

  try {
    const configs = await database.all(
      'SELECT * FROM banner_configs WHERE adsite_id = $1 ORDER BY step, banner_type, position',
      [adsiteId]
    );
    res.json(configs);
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/banner-configs', authenticateToken, requireAdmin, async (req, res) => {
  const { adsiteId, configs } = req.body;

  if (!adsiteId || !configs || !Array.isArray(configs)) {
    return res.status(400).json({ error: 'AdSite ID and configs array are required' });
  }

  try {
    // Delete existing configs for this adsite
    await database.query('DELETE FROM banner_configs WHERE adsite_id = $1', [adsiteId]);

    // Insert new configs
    for (const config of configs) {
      if (config.code && config.code.trim()) {
        await database.query(
          'INSERT INTO banner_configs (adsite_id, step, banner_type, position, code, active) VALUES ($1, $2, $3, $4, $5, $6)',
          [adsiteId, config.step, config.banner_type, config.position, config.code, config.active !== false]
        );
      }
    }

    res.json({ message: 'Banner configurations saved successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.put('/banner-configs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, active } = req.body;

  try {
    const result = await database.query(
      'UPDATE banner_configs SET code = $1, active = $2, updated_at = NOW() WHERE id = $3',
      [code, active !== false, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Banner configuration not found' });
    }

    res.json({ message: 'Banner configuration updated successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.delete('/banner-configs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await database.query('DELETE FROM banner_configs WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Banner configuration not found' });
    }

    res.json({ message: 'Banner configuration deleted successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Client Sites Management (Admin)
router.get('/client-sites', authenticateToken, requireAdmin, async (req, res) => {
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
      query += ' AND cs.user_id = $1';
      params.push(clientId);
    }

    query += ' ORDER BY cs.created_at DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);
    
    const sites = await database.all(query, params);
    console.log('Query result:', sites);
    res.json(sites);
  } catch (err) {
    console.error('🚨 Database error in client-sites:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/client-sites', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, name, url, assignedAdsiteId, magnetIntercept } = req.body;

  if (!userId || !name || !url) {
    return res.status(400).json({ error: 'User ID, name, and URL are required' });
  }

  try {
    // Gerar código de integração único
    const integrationCode = uuidv4();
    
    const result = await database.query(
      'INSERT INTO client_sites (user_id, name, url, assigned_adsite_id, integration_code, magnet_intercept) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, name, url, assignedAdsiteId || null, integrationCode, magnetIntercept !== false]
    );

    res.status(201).json({
      id: result.rows[0].id,
      userId,
      name,
      url,
      assignedAdsiteId,
      integrationCode,
      magnetIntercept: magnetIntercept !== false,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.put('/client-sites/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, url, assignedAdsiteId, magnetIntercept, status } = req.body;

  try {
    const result = await database.query(
      'UPDATE client_sites SET name = $1, url = $2, assigned_adsite_id = $3, magnet_intercept = $4, status = $5, updated_at = NOW() WHERE id = $6',
      [name, url, assignedAdsiteId || null, magnetIntercept !== false, status || 'active', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client site not found' });
    }

    res.json({ message: 'Client site updated successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.delete('/client-sites/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await database.query('DELETE FROM client_sites WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client site not found' });
    }

    res.json({ message: 'Client site deleted successfully' });
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// WordPress Plugin specific routes using AdSite Token authentication
router.get('/wordpress/adsite/validate-token', authenticateAdsiteToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token válido',
      adsite: {
        id: req.adsite.id,
        name: req.adsite.name,
        url: req.adsite.url,
        status: req.adsite.status
      }
    });
  } catch (err) {
    console.error('🚨 Validate token error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/wordpress/adsites', authenticateAdsiteToken, async (req, res) => {
  const { name, url, forcedClick, timerDuration, wpApiUrl, wpToken } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    const apiToken = uuidv4();
    
    const result = await database.query(
      'INSERT INTO adsites (name, url, api_token, forced_click, timer_duration, wp_api_url, wp_token) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, url, apiToken, forcedClick || false, timerDuration || 5, wpApiUrl, wpToken]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name,
      url,
      apiToken,
      forcedClick: forcedClick || false,
      timerDuration: timerDuration || 5,
      wpApiUrl,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('🚨 Database error:', err);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'AdSite with this name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.get('/wordpress/banner-configs/:adsiteId', authenticateAdsiteToken, async (req, res) => {
  const { adsiteId } = req.params;

  try {
    const configs = await database.all(
      'SELECT * FROM banner_configs WHERE adsite_id = $1 ORDER BY step, banner_type, position',
      [adsiteId]
    );
    res.json(configs);
  } catch (err) {
    console.error('🚨 Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/wordpress/sync-post', authenticateAdsiteToken, async (req, res) => {
  const postData = req.body;
  
  console.log('📝 WordPress post sync received:', postData.title);
  
  // For now, just log the post data and return success
  // In a real implementation, you would save this to wp_posts_cache table
  
  try {
    // Optional: Save to cache table if needed
    // const result = await database.query(
    //   'INSERT INTO wp_posts_cache (adsite_id, post_id, title, content, url) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (adsite_id, post_id) DO UPDATE SET title = $3, content = $4, url = $5, cached_at = NOW()',
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