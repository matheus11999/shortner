const express = require('express');
const database = require('../config/database');
const AnalyticsUtils = require('../utils/analytics');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware para log de analytics
const logAnalytics = (req, res, next) => {
    console.log(`📊 Analytics: ${req.method} ${req.path}`, {
        body: req.body,
        headers: req.headers,
        ip: req.ip
    });
    next();
};

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

    // Validar parâmetros obrigatórios
    if (!step || !action) {
      return res.status(400).json({ error: 'Step and action are required' });
    }

    // Coletar dados do analytics
    const analyticsData = await AnalyticsUtils.collectAnalyticsData(req);
    
    // Registrar visitante único
    const isNewVisitor = await AnalyticsUtils.trackUniqueVisitor(
      database, 
      analyticsData.sessionId, 
      analyticsData.ip, 
      analyticsData.userAgent
    );

    // Inserir registro de analytics usando PostgreSQL
    const result = await database.query(`
      INSERT INTO click_analytics (
        short_url_id, adsite_id, user_id, site_id, session_id,
        ip_address, user_agent, referrer, country, city,
        device_type, browser, os, step, action,
        banner_clicked, time_spent, completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `, [
      shortUrlId || null, 
      adsiteId || null, 
      userId || null, 
      siteId || null, 
      analyticsData.sessionId,
      analyticsData.ip, 
      analyticsData.userAgent, 
      analyticsData.referrer,
      analyticsData.country, 
      analyticsData.city, 
      analyticsData.deviceType,
      analyticsData.browser, 
      analyticsData.os, 
      step, 
      action,
      bannerClicked || false, 
      timeSpent || 0, 
      (action === 'complete') || false
    ]);

    // Atualizar contador de clicks na URL se for uma conversão
    if (action === 'complete' && shortUrlId) {
      try {
        await database.query(
          'UPDATE short_urls SET clicks = clicks + 1, updated_at = NOW() WHERE id = $1',
          [shortUrlId]
        );
      } catch (updateError) {
        console.error('Error updating click count:', updateError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Analytics recorded',
      trackingId: result.rows[0]?.id || null,
      sessionId: analyticsData.sessionId,
      isNewVisitor
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(400).json({ error: 'Failed to track analytics', details: error.message });
  }
});

// NEW ANALYTICS SYSTEM - Receive analytics from WordPress
router.post('/wordpress', logAnalytics, async (req, res) => {
    try {
        const data = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        
        console.log('📊 WordPress Analytics:', data);

        // Handle different analytics actions
        switch (data.action) {
            case 'session_started':
                await handleSessionStarted(data, ip);
                break;
            case 'banner_click':
                await handleBannerClick(data, ip);
                break;
            case 'step1_completed':
                await handleStepCompleted(data, 1);
                break;
            case 'session_completed':
                await handleSessionCompleted(data);
                break;
            default:
                console.log(`Unknown analytics action: ${data.action}`);
        }

        res.json({ success: true, message: 'Analytics recorded' });
    } catch (error) {
        console.error('❌ Error processing WordPress analytics:', error);
        res.status(500).json({ error: 'Failed to process analytics' });
    }
});

// Handle session started
async function handleSessionStarted(data, ip) {
    const query = `
        INSERT INTO session_analytics (
            session_id, client_site_id, original_url, ip_address, 
            user_agent, referrer, start_time, step1_start, status
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'started')
        ON CONFLICT (session_id) DO UPDATE SET
            updated_at = NOW()
        RETURNING id
    `;

    const values = [
        data.session_id,
        data.client_site_id || null,
        data.original_url || '',
        ip,
        data.user_agent || '',
        data.referrer || '',
    ];

    const result = await database.query(query, values);
    console.log('✅ Session started recorded:', result.rows[0]);
}

// Handle banner click
async function handleBannerClick(data, ip) {
    // Insert banner click
    const clickQuery = `
        INSERT INTO banner_clicks (
            session_id, client_site_id, banner_id, step, index_position,
            timestamp, ip_address, user_agent, screen_resolution, current_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
    `;

    const clickValues = [
        data.session_id,
        data.client_site_id || null,
        data.banner_id,
        data.step,
        data.index || 0,
        data.timestamp || Date.now(),
        ip,
        data.user_agent || '',
        data.screen_resolution || '',
        data.current_url || ''
    ];

    const clickResult = await database.query(clickQuery, clickValues);

    // Update session analytics  
    const updateQuery = `
        UPDATE session_analytics 
        SET total_clicks = total_clicks + 1,
            ${data.step === 1 ? 'clicks_step1' : 'clicks_step2'} = ${data.step === 1 ? 'clicks_step1' : 'clicks_step2'} + 1,
            updated_at = NOW()
        WHERE session_id = $1
    `;

    await database.query(updateQuery, [data.session_id]);
    console.log('✅ Banner click recorded:', clickResult.rows[0]);
}

// Handle step completed
async function handleStepCompleted(data, step) {
    const updateField = step === 1 ? 
        'step1_end = NOW(), step1_duration = $2' : 
        'step2_end = NOW(), step2_duration = $2';

    const query = `
        UPDATE session_analytics 
        SET ${updateField}, status = $3, updated_at = NOW()
        WHERE session_id = $1
    `;

    const values = [
        data.session_id,
        data.duration || 0,
        step === 1 ? 'step1_completed' : 'step2_completed'
    ];

    await database.query(query, values);
    console.log(`✅ Step ${step} completion recorded`);
}

// Handle session completed
async function handleSessionCompleted(data) {
    const query = `
        UPDATE session_analytics 
        SET step2_end = NOW(),
            total_duration = $2,
            step1_duration = $3,
            step2_duration = $4,
            completion_rate = $5,
            total_clicks = $6,
            clicks_step1 = $7,
            clicks_step2 = $8,
            status = 'completed',
            updated_at = NOW()
        WHERE session_id = $1
        RETURNING *
    `;

    const values = [
        data.session_id,
        data.total_duration || 0,
        data.step1_duration || 0,
        data.step2_duration || 0,
        data.completion_rate || 100,
        data.total_clicks || 0,
        data.clicks_step1 || 0,
        data.clicks_step2 || 0
    ];

    const result = await database.query(query, values);
    
    // Update daily client analytics
    if (data.client_site_id) {
        await updateDailyClientAnalytics(data);
    }
    
    console.log('✅ Session completed recorded:', result.rows[0]);
}

// Update daily client analytics
async function updateDailyClientAnalytics(data) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const query = `
            INSERT INTO client_analytics (
                client_site_id, date, unique_users, total_sessions, completed_sessions,
                total_clicks, step1_clicks, step2_clicks, avg_session_duration,
                completion_rate, impressions
            ) VALUES ($1, $2, 1, 1, 1, $3, $4, $5, $6, $7, 1)
            ON CONFLICT (client_site_id, date) DO UPDATE SET
                total_sessions = client_analytics.total_sessions + 1,
                completed_sessions = client_analytics.completed_sessions + 1,
                total_clicks = client_analytics.total_clicks + $3,
                step1_clicks = client_analytics.step1_clicks + $4,
                step2_clicks = client_analytics.step2_clicks + $5,
                avg_session_duration = (
                    (client_analytics.avg_session_duration * (client_analytics.total_sessions - 1) + $6) / 
                    client_analytics.total_sessions
                ),
                completion_rate = (
                    client_analytics.completed_sessions::DECIMAL / client_analytics.total_sessions * 100
                ),
                impressions = client_analytics.impressions + 1,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            data.client_site_id,
            today,
            data.total_clicks || 0,
            data.clicks_step1 || 0,
            data.clicks_step2 || 0,
            Math.round((data.total_duration || 0) / 1000), // Convert to seconds
            data.completion_rate || 100
        ];

        const result = await database.query(query, values);
        console.log('✅ Daily client analytics updated:', result.rows[0]);
    } catch (error) {
        console.error('❌ Error updating daily client analytics:', error);
    }
}

// Get analytics for a client site
router.get('/client/:siteId', authenticateToken, async (req, res) => {
    try {
        const { siteId } = req.params;
        const { startDate, endDate } = req.query;

        // Get daily analytics
        let query = `
            SELECT * FROM client_analytics 
            WHERE client_site_id = $1
        `;
        let values = [siteId];

        if (startDate && endDate) {
            query += ` AND date BETWEEN $2 AND $3`;
            values.push(startDate, endDate);
        }

        query += ` ORDER BY date DESC LIMIT 30`;

        const dailyStats = await database.query(query, values);

        // Get recent sessions
        const sessionQuery = `
            SELECT session_id, original_url, start_time, total_duration, 
                   completion_rate, total_clicks, status
            FROM session_analytics 
            WHERE client_site_id = $1 
            ORDER BY start_time DESC 
            LIMIT 100
        `;

        const sessions = await database.query(sessionQuery, [siteId]);

        // Calculate totals
        const totalsQuery = `
            SELECT 
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(DISTINCT session_id) FILTER (WHERE status = 'completed') as completed_sessions,
                SUM(total_clicks) as total_clicks,
                AVG(total_duration) as avg_duration,
                SUM(impressions) as total_impressions,
                SUM(cpm_earnings) as total_earnings
            FROM client_analytics 
            WHERE client_site_id = $1
        `;

        const totals = await database.query(totalsQuery, [siteId]);

        res.json({
            daily_stats: dailyStats.rows,
            recent_sessions: sessions.rows,
            totals: totals.rows[0] || {}
        });

    } catch (error) {
        console.error('❌ Error fetching client analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get all analytics summary (admin)
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        // Get overview stats
        const overviewQuery = `
            SELECT 
                COUNT(DISTINCT client_site_id) as total_clients,
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(DISTINCT session_id) FILTER (WHERE status = 'completed') as completed_sessions,
                SUM(total_clicks) as total_clicks,
                AVG(total_duration) as avg_duration,
                SUM(impressions) as total_impressions,
                SUM(cpm_earnings) as total_earnings
            FROM client_analytics 
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        `;

        const overview = await database.query(overviewQuery);

        // Get top clients
        const topClientsQuery = `
            SELECT 
                client_site_id,
                SUM(total_sessions) as sessions,
                SUM(completed_sessions) as completed,
                SUM(total_clicks) as clicks,
                SUM(impressions) as impressions,
                SUM(cpm_earnings) as earnings
            FROM client_analytics 
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY client_site_id 
            ORDER BY sessions DESC 
            LIMIT 10
        `;

        const topClients = await database.query(topClientsQuery);

        // Get daily trends
        const trendsQuery = `
            SELECT 
                date,
                SUM(total_sessions) as sessions,
                SUM(completed_sessions) as completed,
                SUM(total_clicks) as clicks,
                SUM(impressions) as impressions,
                SUM(cpm_earnings) as earnings
            FROM client_analytics 
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date 
            ORDER BY date DESC
        `;

        const trends = await database.query(trendsQuery);

        res.json({
            overview: overview.rows[0] || {},
            top_clients: topClients.rows,
            daily_trends: trends.rows
        });

    } catch (error) {
        console.error('❌ Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
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