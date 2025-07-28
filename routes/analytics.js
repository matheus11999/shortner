const express = require('express');
const database = require('../config/database');
const AnalyticsUtils = require('../utils/analytics');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Track analytics data - usado pelos AdSites
router.post('/track', async (req, res) => {
  try {
    const { 
      shortUrlId, 
      adsiteId, 
      siteId,
      userId,
      step, 
      action = 'view',
      bannerClicked = false,
      timeSpent = 0
    } = req.body;

    // Coletar dados do analytics
    const analyticsData = await AnalyticsUtils.collectAnalyticsData(req);
    
    // Registrar visitante único
    const isNewVisitor = await AnalyticsUtils.trackUniqueVisitor(
      database, 
      analyticsData.sessionId, 
      analyticsData.ip, 
      analyticsData.userAgent
    );

    // Inserir registro de analytics
    const result = database.run(`
      INSERT INTO click_analytics (
        short_url_id, adsite_id, user_id, site_id, session_id,
        ip_address, user_agent, referrer, country, city,
        device_type, browser, os, step, action,
        banner_clicked, time_spent, completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shortUrlId, adsiteId, userId, siteId, analyticsData.sessionId,
      analyticsData.ip, analyticsData.userAgent, analyticsData.referrer,
      analyticsData.country, analyticsData.city, analyticsData.deviceType,
      analyticsData.browser, analyticsData.os, step, action,
      bannerClicked ? 1 : 0, timeSpent, (action === 'complete') ? 1 : 0
    ]);

    // Atualizar contador de clicks na URL se for uma conversão
    if (action === 'complete' && shortUrlId) {
      database.run(
        'UPDATE short_urls SET clicks = clicks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [shortUrlId]
      );
    }

    res.json({ 
      success: true, 
      trackingId: result.lastInsertRowid,
      sessionId: analyticsData.sessionId,
      isNewVisitor
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Failed to track analytics' });
  }
});

// Dashboard geral para admin e cliente
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const isAdmin = req.user.role === 'admin';
    
    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-30 days')";
        break;
      case '1y':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 year')";
        break;
    }

    const userFilter = isAdmin ? '' : 'AND (su.user_id = ? OR cs.user_id = ?)';
    const userParams = isAdmin ? [] : [req.user.id, req.user.id];

    // Total de visualizações
    const totalViews = database.get(`
      SELECT COUNT(*) as count
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE 1=1 ${dateFilter} ${userFilter}
    `, userParams);

    // Visualizações únicas (por session_id)
    const uniqueViews = database.get(`
      SELECT COUNT(DISTINCT ca.session_id) as count
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE 1=1 ${dateFilter} ${userFilter}
    `, userParams);

    // Conversões (completed = 1)
    const conversions = database.get(`
      SELECT COUNT(*) as count
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE ca.completed = 1 ${dateFilter} ${userFilter}
    `, userParams);

    // Clicks em banners
    const bannerClicks = database.get(`
      SELECT COUNT(*) as count
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE ca.banner_clicked = 1 ${dateFilter} ${userFilter}
    `, userParams);

    // Top países
    const topCountries = database.all(`
      SELECT ca.country, COUNT(*) as count
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE ca.country IS NOT NULL ${dateFilter} ${userFilter}
      GROUP BY ca.country
      ORDER BY count DESC
      LIMIT 10
    `, userParams);

    // Clicks por dia
    const clicksByDate = database.all(`
      SELECT 
        DATE(ca.clicked_at) as date, 
        COUNT(*) as views,
        COUNT(DISTINCT ca.session_id) as unique_visitors,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE 1=1 ${dateFilter} ${userFilter}
      GROUP BY DATE(ca.clicked_at)
      ORDER BY date DESC
      LIMIT 30
    `, userParams);

    // Dispositivos
    const deviceStats = database.all(`
      SELECT 
        ca.device_type,
        COUNT(*) as count,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE ca.device_type IS NOT NULL ${dateFilter} ${userFilter}
      GROUP BY ca.device_type
      ORDER BY count DESC
    `, userParams);

    // Performance dos AdSites
    const adsitePerformance = database.all(`
      SELECT 
        a.name as adsite_name,
        COUNT(ca.id) as views,
        COUNT(CASE WHEN ca.banner_clicked = 1 THEN 1 END) as banner_clicks,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions,
        ROUND(AVG(ca.time_spent), 2) as avg_time_spent
      FROM adsites a
      LEFT JOIN click_analytics ca ON a.id = ca.adsite_id ${dateFilter.replace('ca.clicked_at', 'ca.clicked_at')}
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      WHERE 1=1 ${userFilter}
      GROUP BY a.id, a.name
      ORDER BY views DESC
      LIMIT 10
    `, userParams);

    const conversionRate = totalViews.count > 0 
      ? (conversions.count / totalViews.count * 100).toFixed(2) 
      : 0;

    const ctr = totalViews.count > 0 
      ? (bannerClicks.count / totalViews.count * 100).toFixed(2) 
      : 0;

    res.json({
      summary: {
        totalViews: totalViews.count || 0,
        uniqueViews: uniqueViews.count || 0,
        conversions: conversions.count || 0,
        bannerClicks: bannerClicks.count || 0,
        conversionRate,
        ctr
      },
      topCountries,
      clicksByDate,
      deviceStats,
      adsitePerformance
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Analytics por site específico (para clientes)
router.get('/sites/:siteId', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { period = '7d' } = req.query;
    const isAdmin = req.user.role === 'admin';

    // Verificar se o usuário tem acesso ao site
    let siteQuery = 'SELECT id, user_id, name FROM client_sites WHERE id = ?';
    let siteParams = [siteId];

    if (!isAdmin) {
      siteQuery += ' AND user_id = ?';
      siteParams.push(req.user.id);
    }

    const site = database.get(siteQuery, siteParams);

    if (!site) {
      return res.status(404).json({ error: 'Site not found or access denied' });
    }

    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-30 days')";
        break;
      case '1y':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 year')";
        break;
    }

    // URLs do site com estatísticas
    const urlStats = database.all(`
      SELECT 
        su.short_code, 
        su.original_url, 
        su.clicks as total_clicks,
        COUNT(ca.id) as period_views,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions,
        COUNT(CASE WHEN ca.banner_clicked = 1 THEN 1 END) as banner_clicks,
        COUNT(DISTINCT ca.session_id) as unique_visitors
      FROM short_urls su
      LEFT JOIN click_analytics ca ON su.id = ca.short_url_id ${dateFilter}
      WHERE su.site_id = ?
      GROUP BY su.id
      ORDER BY period_views DESC
    `, [siteId]);

    // Clicks por data
    const clicksByDate = database.all(`
      SELECT 
        DATE(ca.clicked_at) as date, 
        COUNT(*) as views,
        COUNT(DISTINCT ca.session_id) as unique_visitors,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions
      FROM click_analytics ca
      JOIN short_urls su ON ca.short_url_id = su.id
      WHERE su.site_id = ? ${dateFilter}
      GROUP BY DATE(ca.clicked_at)
      ORDER BY date DESC
    `, [siteId]);

    // Top referrers
    const topReferrers = database.all(`
      SELECT 
        ca.referrer,
        COUNT(*) as count
      FROM click_analytics ca
      JOIN short_urls su ON ca.short_url_id = su.id
      WHERE su.site_id = ? AND ca.referrer != '' ${dateFilter}
      GROUP BY ca.referrer
      ORDER BY count DESC
      LIMIT 10
    `, [siteId]);

    res.json({
      site: {
        id: site.id,
        name: site.name
      },
      urlStats,
      clicksByDate,
      topReferrers
    });

  } catch (error) {
    console.error('Site analytics error:', error);
    res.status(500).json({ error: 'Failed to load site analytics' });
  }
});

// Analytics para admin - performance dos AdSites
router.get('/adsites/:adsiteId', authenticateToken, async (req, res) => {
  try {
    const { adsiteId } = req.params;
    const { period = '7d' } = req.query;

    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const adsite = database.get('SELECT * FROM adsites WHERE id = ?', [adsiteId]);

    if (!adsite) {
      return res.status(404).json({ error: 'AdSite not found' });
    }

    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-30 days')";
        break;
      case '1y':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 year')";
        break;
    }

    const stats = database.get(`
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT ca.session_id) as unique_visitors,
        COUNT(CASE WHEN ca.banner_clicked = 1 THEN 1 END) as banner_clicks,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions,
        ROUND(AVG(ca.time_spent), 2) as avg_time_spent
      FROM click_analytics ca
      WHERE ca.adsite_id = ? ${dateFilter}
    `, [adsiteId]);

    const clientSites = database.all(`
      SELECT 
        cs.name as site_name,
        u.name as client_name,
        COUNT(ca.id) as views,
        COUNT(CASE WHEN ca.completed = 1 THEN 1 END) as conversions
      FROM click_analytics ca
      JOIN client_sites cs ON ca.site_id = cs.id
      JOIN users u ON cs.user_id = u.id
      WHERE ca.adsite_id = ? ${dateFilter}
      GROUP BY cs.id, u.id
      ORDER BY views DESC
    `, [adsiteId]);

    res.json({
      adsite: {
        id: adsite.id,
        name: adsite.name,
        forcedClick: adsite.forced_click,
        timerDuration: adsite.timer_duration
      },
      stats,
      clientSites
    });

  } catch (error) {
    console.error('AdSite analytics error:', error);
    res.status(500).json({ error: 'Failed to load AdSite analytics' });
  }
});

// Export analytics data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'json', period = '30d', siteId } = req.query;
    const isAdmin = req.user.role === 'admin';

    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-30 days')";
        break;
      case '1y':
        dateFilter = "AND ca.clicked_at >= datetime('now', '-1 year')";
        break;
    }

    let query = `
      SELECT 
        su.short_code,
        su.original_url,
        cs.name as site_name,
        u.name as client_name,
        a.name as adsite_name,
        ca.clicked_at,
        ca.session_id,
        ca.ip_address,
        ca.country,
        ca.city,
        ca.device_type,
        ca.browser,
        ca.os,
        ca.step,
        ca.action,
        ca.banner_clicked,
        ca.time_spent,
        ca.completed
      FROM click_analytics ca
      LEFT JOIN short_urls su ON ca.short_url_id = su.id
      LEFT JOIN client_sites cs ON ca.site_id = cs.id
      LEFT JOIN users u ON cs.user_id = u.id
      LEFT JOIN adsites a ON ca.adsite_id = a.id
      WHERE 1=1 ${dateFilter}
    `;

    let params = [];

    if (!isAdmin) {
      query += ' AND (cs.user_id = ? OR u.id = ?)';
      params.push(req.user.id, req.user.id);
    }

    if (siteId) {
      query += ' AND cs.id = ?';
      params.push(siteId);
    }

    query += ' ORDER BY ca.clicked_at DESC';

    const data = database.all(query, params);

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics_${period}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',')
  ).join('\n');

  return headers + '\n' + rows;
}

module.exports = router;