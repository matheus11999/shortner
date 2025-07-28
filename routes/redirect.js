const express = require('express');
const axios = require('axios');
const database = require('../config/database');

const router = express.Router();

// Endpoint para magnet links criptografados
router.get('/magnet', async (req, res) => {
  const { code, m } = req.query;

  if (!code || !m) {
    return res.status(400).send('Parâmetros inválidos');
  }

  try {
    // Buscar o site pelo código de integração
    const site = database.get('SELECT * FROM client_sites WHERE integration_code = ? AND status = ?', [code, 'active']);
    
    if (!site) {
      return res.status(404).send('Site não encontrado');
    }

    // Descriptografar o magnet link
    let magnetUrl;
    try {
      magnetUrl = decodeURIComponent(Buffer.from(m, 'base64').toString());
    } catch (error) {
      return res.status(400).send('Magnet link inválido');
    }

    // Verificar se tem AdSite atribuído
    if (!site.assigned_adsite_id) {
      // Se não tem AdSite, redirecionar diretamente para o magnet
      return res.redirect(magnetUrl);
    }

    // Buscar o AdSite
    const adsite = database.get('SELECT * FROM adsites WHERE id = ? AND status = ?', [site.assigned_adsite_id, 'active']);
    
    if (!adsite) {
      // Se AdSite não existe ou inativo, redirecionar diretamente
      return res.redirect(magnetUrl);
    }

    // Criar um post fake do WordPress para o sistema funcionar
    const fakePost = {
      title: 'Download via Magnet Link',
      content: `
        <div class="magnet-download-info">
          <h3>📁 Preparando seu download...</h3>
          <p>Seu download será iniciado após visualizar os anúncios.</p>
          <div class="magnet-info">
            <strong>Tipo:</strong> Arquivo via Magnet Link<br>
            <strong>Status:</strong> Aguardando clique nos banners
          </div>
        </div>
      `
    };

    // Criar um objeto short_url fake para o sistema
    const fakeShortUrl = {
      id: Date.now(), // ID temporário
      original_url: magnetUrl,
      short_code: 'magnet_' + code.substring(0, 8),
      site_id: site.id
    };

    const step1Banners = getBannerConfigs(adsite.id, 1);
    const step2Banners = getBannerConfigs(adsite.id, 2);
    const step1Ads = getAdvertisements(adsite.id, 1);
    const step2Ads = getAdvertisements(adsite.id, 2);

    const redirectPage = generateRedirectPage({
      wpPost: fakePost,
      shortUrl: fakeShortUrl,
      adsite: adsite,
      step1Banners,
      step2Banners,
      step1Ads,
      step2Ads
    });

    res.send(redirectPage);
    
  } catch (error) {
    console.error('Magnet redirect error:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

router.get('/redirect', async (req, res) => {
  const { shortnerurl } = req.query;

  if (!shortnerurl) {
    return res.status(400).json({ error: 'Short URL code required' });
  }

  try {
    const shortUrl = getShortUrlData(shortnerurl);
    if (!shortUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    const adsites = getAdsitesForUrl(shortUrl.site_id);
    if (adsites.length === 0) {
      return redirectToOriginal(res, shortUrl);
    }

    const selectedAdsite = selectRandomAdsite(adsites);
    const wpPost = await getRandomWordPressPost(selectedAdsite);
    
    if (!wpPost) {
      return redirectToOriginal(res, shortUrl);
    }

    await trackClick(shortUrl.id, selectedAdsite.id, req);

    const step1Banners = getBannerConfigs(selectedAdsite.id, 1);
    const step2Banners = getBannerConfigs(selectedAdsite.id, 2);
    const step1Ads = getAdvertisements(selectedAdsite.id, 1);
    const step2Ads = getAdvertisements(selectedAdsite.id, 2);

    const redirectPage = generateRedirectPage({
      wpPost,
      shortUrl,
      adsite: selectedAdsite,
      step1Banners,
      step2Banners,
      step1Ads,
      step2Ads
    });

    res.send(redirectPage);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const shortUrl = getShortUrlByCode(code);
    if (!shortUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    incrementClickCount(shortUrl.id);
    
    const adsites = getAdsitesForUrl(shortUrl.site_id);
    if (adsites.length === 0) {
      return res.redirect(shortUrl.original_url);
    }

    const selectedAdsite = selectRandomAdsite(adsites);
    const wpPost = await getRandomWordPressPost(selectedAdsite);
    
    if (!wpPost) {
      return res.redirect(shortUrl.original_url);
    }

    await trackClick(shortUrl.id, selectedAdsite.id, req);

    const step1Banners = getBannerConfigs(selectedAdsite.id, 1);
    const step2Banners = getBannerConfigs(selectedAdsite.id, 2);
    const step1Ads = getAdvertisements(selectedAdsite.id, 1);
    const step2Ads = getAdvertisements(selectedAdsite.id, 2);

    const redirectPage = generateRedirectPage({
      wpPost,
      shortUrl,
      adsite: selectedAdsite,
      step1Banners,
      step2Banners,
      step1Ads,
      step2Ads
    });

    res.send(redirectPage);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
});

router.post('/complete/:clickId', (req, res) => {
  const { clickId } = req.params;

  try {
    database.run('UPDATE click_analytics SET completed = 1 WHERE id = ?', [clickId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

function getShortUrlData(code) {
  try {
    return database.get('SELECT * FROM short_urls WHERE short_code = ?', [code]);
  } catch (error) {
    console.error('Error getting short URL data:', error);
    return null;
  }
}

function getShortUrlByCode(code) {
  try {
    return database.get('SELECT * FROM short_urls WHERE short_code = ?', [code]);
  } catch (error) {
    console.error('Error getting short URL by code:', error);
    return null;
  }
}

function getAdsitesForUrl(siteId) {
  try {
    // For now, return all active adsites (simplified)
    return database.all('SELECT * FROM adsites WHERE status = ? ORDER BY RANDOM() LIMIT 3', ['active']);
  } catch (error) {
    console.error('Error getting adsites for URL:', error);
    return [];
  }
}

function selectRandomAdsite(adsites) {
  return adsites[Math.floor(Math.random() * adsites.length)];
}

async function getRandomWordPressPost(adsite) {
  if (!adsite.wp_api_url) {
    return null;
  }

  try {
    let cachedPosts = getCachedPosts(adsite.id);
    
    if (cachedPosts.length === 0) {
      await refreshWordPressPosts(adsite);
      cachedPosts = getCachedPosts(adsite.id);
    }

    if (cachedPosts.length === 0) {
      return null;
    }

    return cachedPosts[Math.floor(Math.random() * cachedPosts.length)];
  } catch (error) {
    console.error('Error getting WordPress post:', error);
    return null;
  }
}

function getCachedPosts(adsiteId) {
  try {
    return database.all('SELECT * FROM wp_posts_cache WHERE adsite_id = ? ORDER BY cached_at DESC LIMIT 50', [adsiteId]);
  } catch (error) {
    console.error('Error getting cached posts:', error);
    return [];
  }
}

async function refreshWordPressPosts(adsite) {
  try {
    const headers = {};
    if (adsite.wp_token) {
      headers['Authorization'] = `Bearer ${adsite.wp_token}`;
    }

    const response = await axios.get(`${adsite.wp_api_url}/wp-json/wp/v2/posts`, {
      headers,
      params: { per_page: 20 }
    });

    database.run('DELETE FROM wp_posts_cache WHERE adsite_id = ?', [adsite.id]);

    for (const post of response.data) {
      database.run(
        'INSERT INTO wp_posts_cache (adsite_id, post_id, title, content, url) VALUES (?, ?, ?, ?, ?)',
        [adsite.id, post.id, post.title.rendered, post.content.rendered, post.link]
      );
    }
  } catch (error) {
    console.error('Error refreshing WordPress posts:', error);
  }
}

function getBannerConfigs(adsiteId, step) {
  try {
    return database.all(
      'SELECT * FROM banner_configs WHERE adsite_id = ? AND step = ? AND active = 1 ORDER BY banner_type, position',
      [adsiteId, step]
    );
  } catch (error) {
    console.error('Error getting banner configs:', error);
    return [];
  }
}

function getAdvertisements(adsiteId, step) {
  try {
    return database.all(
      'SELECT * FROM advertisements WHERE adsite_id = ? AND step = ? AND status = ? ORDER BY position',
      [adsiteId, step, 'active']
    );
  } catch (error) {
    console.error('Error getting advertisements:', error);
    return [];
  }
}

async function trackClick(shortUrlId, adsiteId, req) {
  const AnalyticsUtils = require('../utils/analytics');
  
  try {
    // Use the new analytics system
    const analyticsData = await AnalyticsUtils.collectAnalyticsData(req);
    
    // Track unique visitor
    const isNewVisitor = await AnalyticsUtils.trackUniqueVisitor(
      database, 
      analyticsData.sessionId, 
      analyticsData.ip, 
      analyticsData.userAgent
    );

    // Insert analytics record
    const result = database.run(`
      INSERT INTO click_analytics (
        short_url_id, adsite_id, session_id,
        ip_address, user_agent, referrer, country, city,
        device_type, browser, os, step, action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shortUrlId, adsiteId, analyticsData.sessionId,
      analyticsData.ip, analyticsData.userAgent, analyticsData.referrer,
      analyticsData.country, analyticsData.city, analyticsData.deviceType,
      analyticsData.browser, analyticsData.os, 1, 'initial_view'
    ]);

    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error tracking click:', error);
    return null;
  }
}

function incrementClickCount(shortUrlId) {
  try {
    database.run('UPDATE short_urls SET clicks = clicks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [shortUrlId]);
  } catch (error) {
    console.error('Error incrementing click count:', error);
  }
}

function redirectToOriginal(res, shortUrl) {
  res.redirect(shortUrl.original_url);
}

function generateRedirectPage({ wpPost, shortUrl, adsite, step1Banners, step2Banners, step1Ads, step2Ads }) {
  const forcedClick = adsite.forced_click === 1;
  const timerDuration = adsite.timer_duration || 5;

  // Função para gerar banners aleatórios
  const getRandomBanners = (banners, count) => {
    const shuffled = [...banners].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Selecionar banners aleatórios para cada step
  const selectedStep1Banners = getRandomBanners(step1Banners, Math.min(3, step1Banners.length));
  const selectedStep2Banners = getRandomBanners(step2Banners, Math.min(3, step2Banners.length));
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wpPost.title}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        .step { display: none; }
        .step.active { display: block; }
        .countdown { font-weight: bold; color: #ef4444; }
        .ad-container { margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
        .banner-container { 
            margin: 20px 0; 
            padding: 15px; 
            border: 2px solid #3b82f6; 
            border-radius: 8px; 
            background: #eff6ff; 
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .banner-container:hover { 
            border-color: #1d4ed8; 
            background: #dbeafe; 
            transform: translateY(-2px);
        }
        .banner-container.clicked {
            border-color: #10b981;
            background: #d1fae5;
        }
        .forced-click-message {
            background: linear-gradient(45deg, #fbbf24, #f59e0b);
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            font-weight: bold;
            text-align: center;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h1 class="text-3xl font-bold mb-6 text-gray-800">${wpPost.title}</h1>
            
            <!-- Step 1 -->
            <div id="step1" class="step active">
                <div class="prose max-w-none mb-6">
                    <div class="text-gray-700">${wpPost.content.substring(0, 500)}...</div>
                </div>
                
                ${selectedStep1Banners.map((banner, index) => `
                    <div class="banner-container" onclick="trackBannerClick(1, '${banner.banner_type}', ${banner.position})">
                        <div class="text-sm text-blue-600 mb-2 font-medium">📢 Anúncio ${banner.banner_type} #${banner.position}</div>
                        ${banner.code}
                    </div>
                `).join('')}
                
                ${step1Ads.map(ad => `
                    <div class="ad-container" onclick="trackBannerClick(1)">
                        <div class="text-sm text-gray-500 mb-2">Anúncio</div>
                        ${generateAdContent(ad)}
                    </div>
                `).join('')}
                
                <div class="text-center mt-8">
                    <div class="text-gray-600 mb-4">
                        Aguarde <span id="countdown1" class="countdown">5</span> segundos para continuar
                    </div>
                    <button 
                        id="continueBtn" 
                        class="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed"
                        disabled
                    >
                        Continuar
                    </button>
                </div>
            </div>
            
            <!-- Step 2 -->
            <div id="step2" class="step">
                <div class="prose max-w-none mb-6">
                    <div class="text-gray-700">${wpPost.content}</div>
                </div>
                
                ${forcedClick ? `
                    <div class="forced-click-message" id="forcedClickMessage">
                        🎯 Para liberar o download, você deve clicar em qualquer banner após o timer!
                    </div>
                ` : ''}
                
                ${selectedStep2Banners.map((banner, index) => `
                    <div class="banner-container" id="banner_${banner.banner_type}_${banner.position}" onclick="trackBannerClick(2, '${banner.banner_type}', ${banner.position})">
                        <div class="text-sm text-blue-600 mb-2 font-medium">📢 Anúncio ${banner.banner_type} #${banner.position} - Clique para continuar</div>
                        ${banner.code}
                    </div>
                `).join('')}
                
                ${step2Ads.map((ad, index) => `
                    <div class="banner-container" id="ad_banner_${index}" onclick="trackBannerClick(2, 'ad', ${index})">
                        <div class="text-sm text-blue-600 mb-2 font-medium">📢 Anúncio Patrocinado - Clique para continuar</div>
                        ${generateAdContent(ad)}
                    </div>
                `).join('')}
                
                <div class="text-center mt-8">
                    <div class="text-gray-600 mb-4" id="step2Message">
                        Aguarde <span id="countdown2" class="countdown">${timerDuration}</span> segundos para ${forcedClick ? 'poder clicar no banner' : 'baixar'}
                    </div>
                    <button 
                        id="downloadBtn" 
                        class="bg-green-600 text-white px-8 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed"
                        disabled
                    >
                        Download
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        let step1Timer = 5;
        let step2Timer = ${timerDuration};
        let currentStep = 1;
        let bannerClicked = false;
        let step2StartTime = null;
        const forcedClick = ${forcedClick};
        const sessionId = Math.random().toString(36).substring(2);
        
        function updateCountdown() {
            if (currentStep === 1) {
                document.getElementById('countdown1').textContent = step1Timer;
                if (step1Timer <= 0) {
                    document.getElementById('continueBtn').disabled = false;
                    document.getElementById('continueBtn').classList.remove('opacity-50', 'cursor-not-allowed');
                    document.getElementById('continueBtn').classList.add('hover:bg-blue-700');
                } else {
                    step1Timer--;
                }
            } else if (currentStep === 2) {
                document.getElementById('countdown2').textContent = step2Timer;
                
                if (step2Timer <= 0) {
                    if (forcedClick) {
                        document.getElementById('step2Message').innerHTML = 
                            bannerClicked 
                                ? '<span class="text-green-600 font-bold">✅ Banner clicado! Agora você pode baixar.</span>'
                                : '<span class="text-red-600 font-bold">⏰ Clique em qualquer banner para liberar o download!</span>';
                        
                        if (bannerClicked) {
                            enableDownload();
                        }
                    } else {
                        enableDownload();
                    }
                } else {
                    step2Timer--;
                }
            }
        }
        
        function enableDownload() {
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            downloadBtn.classList.add('hover:bg-green-700');
            
            if (forcedClick) {
                document.getElementById('forcedClickMessage').style.display = 'none';
            }
        }
        
        function trackBannerClick(step, bannerType = null, position = null) {
            const timeSpent = step2StartTime ? Math.floor((Date.now() - step2StartTime) / 1000) : 0;
            
            if (step === 2) {
                bannerClicked = true;
                
                // Visual feedback
                let clickedElement;
                if (bannerType && position) {
                    if (bannerType === 'ad') {
                        clickedElement = document.getElementById('ad_banner_' + position);
                    } else {
                        clickedElement = document.getElementById('banner_' + bannerType + '_' + position);
                    }
                } else {
                    // Fallback para compatibilidade
                    clickedElement = document.querySelector('.banner-container');
                }
                    
                if (clickedElement) {
                    clickedElement.classList.add('clicked');
                    clickedElement.innerHTML = clickedElement.innerHTML.replace('Clique para continuar', '✅ Clicado!');
                }
                
                // Enable download if timer is done and forced click is enabled
                if (forcedClick && step2Timer <= 0) {
                    enableDownload();
                    document.getElementById('step2Message').innerHTML = 
                        '<span class="text-green-600 font-bold">✅ Banner clicado! Agora você pode baixar.</span>';
                }
            }
            
            // Track analytics
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shortUrlId: ${shortUrl.id},
                    adsiteId: ${adsite.id},
                    step: step,
                    action: 'banner_click',
                    bannerClicked: true,
                    timeSpent: timeSpent,
                    bannerType: bannerType,
                    bannerPosition: position
                })
            }).catch(err => console.error('Analytics error:', err));
        }
        
        const countdownInterval = setInterval(updateCountdown, 1000);
        
        document.getElementById('continueBtn').addEventListener('click', function() {
            if (!this.disabled) {
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
                currentStep = 2;
                step2StartTime = Date.now();
                
                // Track step 2 view
                fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shortUrlId: ${shortUrl.id},
                        adsiteId: ${adsite.id},
                        step: 2,
                        action: 'view'
                    })
                }).catch(err => console.error('Analytics error:', err));
            }
        });
        
        document.getElementById('downloadBtn').addEventListener('click', function() {
            if (!this.disabled) {
                const timeSpent = step2StartTime ? Math.floor((Date.now() - step2StartTime) / 1000) : 0;
                
                // Track completion
                fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shortUrlId: ${shortUrl.id},
                        adsiteId: ${adsite.id},
                        step: 2,
                        action: 'complete',
                        bannerClicked: bannerClicked,
                        timeSpent: timeSpent
                    })
                }).then(() => {
                    clearInterval(countdownInterval);
                    window.location.href = '${shortUrl.original_url}';
                }).catch(err => {
                    console.error('Analytics error:', err);
                    clearInterval(countdownInterval);
                    window.location.href = '${shortUrl.original_url}';
                });
            }
        });
        
        // Initial tracking for step 1
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shortUrlId: ${shortUrl.id},
                adsiteId: ${adsite.id},
                step: 1,
                action: 'view'
            })
        }).catch(err => console.error('Analytics error:', err));
    </script>
</body>
</html>`;
}

function generateAdContent(ad) {
  switch (ad.type) {
    case 'banner':
      return `<img src="${ad.content}" alt="Advertisement" class="w-full max-w-lg mx-auto rounded" />`;
    case 'text':
      return `<div class="text-center">${ad.content}</div>`;
    case 'html':
      return ad.content;
    case 'video':
      return `<video controls class="w-full max-w-lg mx-auto rounded">
                <source src="${ad.content}" type="video/mp4">
              </video>`;
    default:
      return `<div class="text-center">${ad.content}</div>`;
  }
}

module.exports = router;