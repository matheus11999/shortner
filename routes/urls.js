const express = require('express');
const database = require('../config/database');
const { authenticateToken, authenticateApiToken } = require('../middleware/auth');

const router = express.Router();

const generateShortCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

router.post('/shorten', (req, res) => {
  const { url, integrationCode } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!integrationCode) {
    return res.status(400).json({ error: 'Integration code is required' });
  }

  database.getDB().get(
    'SELECT id, user_id FROM client_sites WHERE integration_code = ?',
    [integrationCode],
    (err, site) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!site) {
        return res.status(400).json({ error: 'Invalid integration code' });
      }

      const shortCode = generateShortCode();
      const shortUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/${shortCode}`;

      database.getDB().run(
        'INSERT INTO short_urls (original_url, short_code, user_id, site_id) VALUES (?, ?, ?, ?)',
        [url, shortCode, site.user_id, site.id],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return router.post('/shorten', req, res);
            }
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            id: this.lastID,
            originalUrl: url,
            shortUrl,
            shortCode
          });
        }
      );
    }
  );
});

router.post('/shorten-auth', authenticateToken, (req, res) => {
  const { url, siteId } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let siteQuery = 'SELECT id, user_id FROM client_sites WHERE id = ?';
  let siteParams = [siteId];

  if (req.user.role !== 'admin') {
    siteQuery += ' AND user_id = ?';
    siteParams.push(req.user.id);
  }

  database.getDB().get(siteQuery, siteParams, (err, site) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!site) {
      return res.status(400).json({ error: 'Site not found' });
    }

    const shortCode = generateShortCode();
    const shortUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/${shortCode}`;

    database.getDB().run(
      'INSERT INTO short_urls (original_url, short_code, user_id, site_id) VALUES (?, ?, ?, ?)',
      [url, shortCode, site.user_id, site.id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return router.post('/shorten-auth', req, res);
          }
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          id: this.lastID,
          originalUrl: url,
          shortUrl,
          shortCode
        });
      }
    );
  });
});

router.get('/list', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, siteId } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT su.*, cs.name as site_name
    FROM short_urls su
    LEFT JOIN client_sites cs ON su.site_id = cs.id
    WHERE 1=1
  `;
  let params = [];

  if (req.user.role !== 'admin') {
    query += ' AND su.user_id = ?';
    params.push(req.user.id);
  }

  if (siteId) {
    query += ' AND su.site_id = ?';
    params.push(siteId);
  }

  query += ' ORDER BY su.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  database.getDB().all(query, params, (err, urls) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const countQuery = query.replace(/SELECT su.*/, 'SELECT COUNT(*) as total').replace(/ORDER BY.*/, '');
    const countParams = params.slice(0, -2);

    database.getDB().get(countQuery, countParams, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        urls: urls.map(url => ({
          ...url,
          shortUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/${url.short_code}`
        })),
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.total / limit)
      });
    });
  });
});

router.get('/:code/stats', authenticateToken, (req, res) => {
  const { code } = req.params;

  let query = `
    SELECT su.*, cs.name as site_name
    FROM short_urls su
    LEFT JOIN client_sites cs ON su.site_id = cs.id
    WHERE su.short_code = ?
  `;
  let params = [code];

  if (req.user.role !== 'admin') {
    query += ' AND su.user_id = ?';
    params.push(req.user.id);
  }

  database.getDB().get(query, params, (err, url) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    database.getDB().all(
      `SELECT DATE(clicked_at) as date, COUNT(*) as clicks
       FROM click_analytics
       WHERE short_url_id = ?
       GROUP BY DATE(clicked_at)
       ORDER BY date DESC
       LIMIT 30`,
      [url.id],
      (err, analytics) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          ...url,
          shortUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/${url.short_code}`,
          analytics
        });
      }
    );
  });
});

router.delete('/:code', authenticateToken, (req, res) => {
  const { code } = req.params;

  let query = 'DELETE FROM short_urls WHERE short_code = ?';
  let params = [code];

  if (req.user.role !== 'admin') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }

  database.getDB().run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    res.json({ message: 'URL deleted successfully' });
  });
});

module.exports = router;