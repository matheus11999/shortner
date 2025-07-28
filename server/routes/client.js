const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const database = require('../config/database');
const { authenticateToken, requireClient } = require('../middleware/auth');

const router = express.Router();

// Client Sites (para clientes visualizarem seus próprios sites)
router.get('/sites', authenticateToken, (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;
    
    const sites = database.all(`
      SELECT cs.*, a.name as adsite_name, 
             COUNT(su.id) as url_count, 
             SUM(su.clicks) as total_clicks
      FROM client_sites cs
      LEFT JOIN adsites a ON cs.assigned_adsite_id = a.id
      LEFT JOIN short_urls su ON cs.id = su.site_id
      WHERE cs.user_id = ? AND cs.status = 'active'
      GROUP BY cs.id
      ORDER BY cs.created_at DESC
    `, [userId || req.user.id]);

    res.json(sites);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/sites', authenticateToken, (req, res) => {
  const { name, url } = req.body;
  const userId = req.user.role === 'admin' ? req.body.userId : req.user.id;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  const integrationCode = generateIntegrationCode();

  database.getDB().run(
    'INSERT INTO client_sites (user_id, name, url, integration_code) VALUES (?, ?, ?, ?)',
    [userId || req.user.id, name, url, integrationCode],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        id: this.lastID,
        name,
        url,
        integrationCode
      });
    }
  );
});

router.put('/sites/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, url, status } = req.body;
  const userId = req.user.role === 'admin' ? req.body.userId : req.user.id;

  let query = 'UPDATE client_sites SET name = ?, url = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  let params = [name, url, status || 'active', id];

  if (req.user.role !== 'admin') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }

  database.getDB().run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: 'Site updated successfully' });
  });
});

router.delete('/sites/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  let query = 'DELETE FROM client_sites WHERE id = ?';
  let params = [id];

  if (req.user.role !== 'admin') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }

  database.getDB().run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: 'Site deleted successfully' });
  });
});

// Get integration code for a specific site
router.get('/sites/:id/integration-code', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    let query = `
      SELECT cs.*, a.name as adsite_name, a.url as adsite_url
      FROM client_sites cs
      LEFT JOIN adsites a ON cs.assigned_adsite_id = a.id
      WHERE cs.id = ?
    `;
    let params = [id];

    if (req.user.role !== 'admin') {
      query += ' AND cs.user_id = ?';
      params.push(req.user.id);
    }

    const site = database.get(query, params);

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Gerar código JavaScript de integração
    const integrationCode = generateMagnetInterceptorScript(site);
    
    res.json({
      site: {
        id: site.id,
        name: site.name,
        url: site.url,
        adsiteName: site.adsite_name
      },
      code: integrationCode
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/sites/:id/regenerate-code', authenticateToken, (req, res) => {
  const { id } = req.params;
  const newCode = generateIntegrationCode();

  let query = 'UPDATE client_sites SET integration_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  let params = [newCode, id];

  if (req.user.role !== 'admin') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }

  database.getDB().run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const integrationScript = generateIntegrationScript(newCode);
    res.json({ code: integrationScript, integrationCode: newCode });
  });
});

router.get('/sites/:id/analytics', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { period = '7d' } = req.query;

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

  let siteQuery = 'SELECT id FROM client_sites WHERE id = ?';
  let siteParams = [id];

  if (req.user.role !== 'admin') {
    siteQuery += ' AND user_id = ?';
    siteParams.push(req.user.id);
  }

  database.getDB().get(siteQuery, siteParams, (err, site) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const queries = {
      totalClicks: `
        SELECT COUNT(*) as count
        FROM click_analytics ca
        JOIN short_urls su ON ca.short_url_id = su.id
        WHERE su.site_id = ? ${dateFilter}
      `,
      completedClicks: `
        SELECT COUNT(*) as count
        FROM click_analytics ca
        JOIN short_urls su ON ca.short_url_id = su.id
        WHERE su.site_id = ? AND ca.completed = 1 ${dateFilter}
      `,
      topCountries: `
        SELECT country, COUNT(*) as count
        FROM click_analytics ca
        JOIN short_urls su ON ca.short_url_id = su.id
        WHERE su.site_id = ? AND country IS NOT NULL ${dateFilter}
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `,
      clicksByDate: `
        SELECT DATE(ca.clicked_at) as date, COUNT(*) as clicks
        FROM click_analytics ca
        JOIN short_urls su ON ca.short_url_id = su.id
        WHERE su.site_id = ? ${dateFilter}
        GROUP BY DATE(ca.clicked_at)
        ORDER BY date DESC
      `
    };

    Promise.all([
      new Promise((resolve, reject) => {
        database.getDB().get(queries.totalClicks, [id], (err, result) => {
          if (err) reject(err);
          else resolve(result.count);
        });
      }),
      new Promise((resolve, reject) => {
        database.getDB().get(queries.completedClicks, [id], (err, result) => {
          if (err) reject(err);
          else resolve(result.count);
        });
      }),
      new Promise((resolve, reject) => {
        database.getDB().all(queries.topCountries, [id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        database.getDB().all(queries.clicksByDate, [id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      })
    ]).then(([totalClicks, completedClicks, topCountries, clicksByDate]) => {
      res.json({
        totalClicks,
        completedClicks,
        conversionRate: totalClicks > 0 ? (completedClicks / totalClicks * 100).toFixed(2) : 0,
        topCountries,
        clicksByDate
      });
    }).catch(err => {
      console.error('Analytics error:', err);
      res.status(500).json({ error: 'Database error' });
    });
  });
});

function generateIntegrationCode() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

// Função para gerar código de integração JavaScript para interceptação de magnet links
function generateMagnetInterceptorScript(site) {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
  
  return `
<!-- URL Shortener Magnet Link Interceptor -->
<script>
(function() {
  'use strict';
  
  const SITE_CODE = '${site.integration_code}';
  const SERVER_URL = '${serverUrl}';
  
  // Função para criptografar magnet link
  function encryptMagnetLink(magnetUrl) {
    return btoa(encodeURIComponent(magnetUrl));
  }
  
  // Função para interceptar cliques em magnet links
  function interceptMagnetLinks() {
    // Interceptar cliques em links magnet
    document.addEventListener('click', function(e) {
      const target = e.target;
      let magnetUrl = null;
      
      // Verificar se é um link magnet direto
      if (target.tagName === 'A' && target.href && target.href.startsWith('magnet:')) {
        magnetUrl = target.href;
      }
      // Verificar se está dentro de um link magnet
      else if (target.closest && target.closest('a[href^="magnet:"]')) {
        magnetUrl = target.closest('a[href^="magnet:"]').href;
      }
      
      if (magnetUrl) {
        e.preventDefault();
        
        // Criptografar o magnet link
        const encryptedMagnet = encryptMagnetLink(magnetUrl);
        
        // Redirecionar para o servidor
        const redirectUrl = SERVER_URL + '/magnet?code=' + SITE_CODE + '&m=' + encryptedMagnet;
        window.open(redirectUrl, '_blank');
        
        // Analytics opcional
        if (typeof gtag !== 'undefined') {
          gtag('event', 'magnet_link_click', {
            'site_code': SITE_CODE,
            'magnet_hash': encryptedMagnet.substring(0, 10)
          });
        }
      }
    }, true);
    
    // Interceptar magnet links adicionados dinamicamente
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              const magnetLinks = node.querySelectorAll ? node.querySelectorAll('a[href^="magnet:"]') : [];
              magnetLinks.forEach(function(link) {
                if (!link.dataset.intercepted) {
                  link.dataset.intercepted = 'true';
                }
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptMagnetLinks);
  } else {
    interceptMagnetLinks();
  }
})();
</script>
<!-- Fim do URL Shortener Magnet Link Interceptor -->`.trim();
}

module.exports = router;