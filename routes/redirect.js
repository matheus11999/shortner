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
    const site = await database.get('SELECT * FROM client_sites WHERE integration_code = $1 AND status = $2', [code, 'active']);
    
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
    const adsite = await database.get('SELECT * FROM adsites WHERE id = $1 AND status = $2', [site.assigned_adsite_id, 'active']);
    
    if (!adsite) {
      // Se AdSite não existe ou inativo, redirecionar diretamente
      return res.redirect(magnetUrl);
    }

    // Criar um post simulado (não buscar do WordPress)
    const fakePost = await generateFakePost(adsite);

    // Criar um objeto short_url fake para o sistema
    const fakeShortUrl = {
      id: Date.now(), // ID temporário
      original_url: magnetUrl,
      short_code: 'magnet_' + code.substring(0, 8),
      site_id: site.id
    };

    const step1Banners = await getBannerConfigs(adsite.id, 1);
    const step2Banners = await getBannerConfigs(adsite.id, 2);
    const step1Ads = await getAdvertisements(adsite.id, 1);
    const step2Ads = await getAdvertisements(adsite.id, 2);

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

// Função para gerar post simulado baseado no AdSite
async function generateFakePost(adsite) {
  const postTemplates = [
    {
      title: "🔥 Download Disponível - Conteúdo Premium",
      content: `
        <div class="post-content">
          <h3>📁 Seu download está sendo preparado</h3>
          <p>Olá! Você está prestes a acessar um conteúdo exclusivo através do ${adsite.name}.</p>
          <p>Para garantir a sustentabilidade do nosso serviço, pedimos que visualize alguns anúncios de nossos parceiros.</p>
          <div class="features">
            <ul>
              <li>✅ Download 100% gratuito</li>
              <li>✅ Sem cadastro necessário</li>
              <li>✅ Conteúdo verificado</li>
              <li>✅ Suporte 24/7</li>
            </ul>
          </div>
          <p><strong>Instruções:</strong> Aguarde os timers e clique nos banners para liberar seu download.</p>
        </div>
      `
    },
    {
      title: "🎯 Acesso Liberado - Conteúdo Exclusivo",
      content: `
        <div class="post-content">
          <h3>🌟 Bem-vindo ao ${adsite.name}</h3>
          <p>Você está acessando um de nossos conteúdos mais populares!</p>
          <p>Antes de prosseguir com o download, apoie nossos parceiros visualizando os anúncios abaixo.</p>
          <div class="info-box">
            <p><strong>💡 Por que anúncios?</strong></p>
            <p>Os anúncios nos permitem manter este serviço gratuito para todos os usuários.</p>
          </div>
          <p>Após visualizar os anúncios, seu download será liberado automaticamente.</p>
        </div>
      `
    },
    {
      title: "📱 Download Express - Acesso Rápido",
      content: `
        <div class="post-content">
          <h3>⚡ Download Express</h3>
          <p>Você escolheu o ${adsite.name} para seu download. Excelente escolha!</p>
          <p>Nosso sistema garante downloads seguros e rápidos para todos os usuários.</p>
          <div class="stats">
            <p>📊 <strong>Estatísticas:</strong></p>
            <ul>
              <li>🔥 +10k downloads hoje</li>
              <li>⭐ 4.8/5 avaliação dos usuários</li>
              <li>🚀 Velocidade média: 50MB/s</li>
            </ul>
          </div>
          <p>Complete a visualização dos anúncios para iniciar o download.</p>
        </div>
      `
    }
  ];

  // Selecionar template aleatório
  const randomTemplate = postTemplates[Math.floor(Math.random() * postTemplates.length)];
  
  return {
    title: randomTemplate.title,
    content: randomTemplate.content,
    url: `${adsite.url}/download-${Date.now()}`
  };
}

router.get('/redirect', async (req, res) => {
  const { shortnerurl } = req.query;

  if (!shortnerurl) {
    return res.status(400).json({ error: 'Short URL code required' });
  }

  try {
    const shortUrl = await getShortUrlData(shortnerurl);
    if (!shortUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    const adsites = await getAdsitesForUrl(shortUrl.site_id);
    if (adsites.length === 0) {
      return redirectToOriginal(res, shortUrl);
    }

    const selectedAdsite = selectRandomAdsite(adsites);
    const wpPost = await generateFakePost(selectedAdsite);
    
    await trackClick(shortUrl.id, selectedAdsite.id, req);

    const step1Banners = await getBannerConfigs(selectedAdsite.id, 1);
    const step2Banners = await getBannerConfigs(selectedAdsite.id, 2);
    const step1Ads = await getAdvertisements(selectedAdsite.id, 1);
    const step2Ads = await getAdvertisements(selectedAdsite.id, 2);

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
    const shortUrl = await getShortUrlByCode(code);
    if (!shortUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    await incrementClickCount(shortUrl.id);
    
    const adsites = await getAdsitesForUrl(shortUrl.site_id);
    if (adsites.length === 0) {
      return res.redirect(shortUrl.original_url);
    }

    const selectedAdsite = selectRandomAdsite(adsites);
    const wpPost = await generateFakePost(selectedAdsite);
    
    await trackClick(shortUrl.id, selectedAdsite.id, req);

    const step1Banners = await getBannerConfigs(selectedAdsite.id, 1);
    const step2Banners = await getBannerConfigs(selectedAdsite.id, 2);
    const step1Ads = await getAdvertisements(selectedAdsite.id, 1);
    const step2Ads = await getAdvertisements(selectedAdsite.id, 2);

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

router.post('/complete/:clickId', async (req, res) => {
  const { clickId } = req.params;

  try {
    await database.query('UPDATE click_analytics SET completed = true WHERE id = $1', [clickId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

async function getShortUrlData(code) {
  try {
    return await database.get('SELECT * FROM short_urls WHERE short_code = $1', [code]);
  } catch (error) {
    console.error('Error getting short URL data:', error);
    return null;
  }
}

async function getShortUrlByCode(code) {
  try {
    return await database.get('SELECT * FROM short_urls WHERE short_code = $1', [code]);
  } catch (error) {
    console.error('Error getting short URL by code:', error);
    return null;
  }
}

async function getAdsitesForUrl(siteId) {
  try {
    // For now, return all active adsites (simplified)
    return await database.all('SELECT * FROM adsites WHERE status = $1 ORDER BY RANDOM() LIMIT 3', ['active']);
  } catch (error) {
    console.error('Error getting adsites for URL:', error);
    return [];
  }
}

function selectRandomAdsite(adsites) {
  return adsites[Math.floor(Math.random() * adsites.length)];
}

async function getBannerConfigs(adsiteId, step) {
  try {
    return await database.all(
      'SELECT * FROM banner_configs WHERE adsite_id = $1 AND step = $2 AND active = true ORDER BY banner_type, position',
      [adsiteId, step]
    );
  } catch (error) {
    console.error('Error getting banner configs:', error);
    return [];
  }
}

async function getAdvertisements(adsiteId, step) {
  try {
    return await database.all(
      'SELECT * FROM advertisements WHERE adsite_id = $1 AND step = $2 AND status = $3 ORDER BY position',
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
    const result = await database.query(`
      INSERT INTO click_analytics (
        short_url_id, adsite_id, session_id,
        ip_address, user_agent, referrer, country, city,
        device_type, browser, os, step, action
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id
    `, [
      shortUrlId, adsiteId, analyticsData.sessionId,
      analyticsData.ip, analyticsData.userAgent, analyticsData.referrer,
      analyticsData.country, analyticsData.city, analyticsData.deviceType,
      analyticsData.browser, analyticsData.os, 1, 'initial_view'
    ]);

    return result.rows[0].id;
  } catch (error) {
    console.error('Error tracking click:', error);
    return null;
  }
}

async function incrementClickCount(shortUrlId) {
  try {
    await database.query('UPDATE short_urls SET clicks = clicks + 1, updated_at = NOW() WHERE id = $1', [shortUrlId]);
  } catch (error) {
    console.error('Error incrementing click count:', error);
  }
}

function redirectToOriginal(res, shortUrl) {
  res.redirect(shortUrl.original_url);
}

function generateRedirectPage({ wpPost, shortUrl, adsite, step1Banners, step2Banners, step1Ads, step2Ads }) {
  const forcedClick = adsite.forced_click === true;
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
        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-primary: #1f2937;
                --bg-secondary: #374151;
                --text-primary: #f9fafb;
                --text-secondary: #d1d5db;
                --border-color: #4b5563;
            }
        }
        
        @media (prefers-color-scheme: light) {
            :root {
                --bg-primary: #f9fafb;
                --bg-secondary: #ffffff;
                --text-primary: #1f2937;
                --text-secondary: #6b7280;
                --border-color: #e5e7eb;
            }
        }
        
        .dark-mode-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        }
        
        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            transition: all 0.3s ease;
        }
        
        .content-container {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
        }
        
        .step { display: none; }
        .step.active { display: block; }
        .countdown { font-weight: bold; color: #ef4444; }
        
        .ad-container { 
            margin: 20px 0; 
            padding: 15px; 
            border: 1px solid var(--border-color); 
            border-radius: 8px; 
            background-color: var(--bg-primary);
        }
        
        .banner-container { 
            margin: 20px 0; 
            padding: 15px; 
            border: 2px solid #3b82f6; 
            border-radius: 8px; 
            background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
            color: white;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .banner-container:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
            background: linear-gradient(135deg, #1d4ed8, #1e40af);
        }
        
        .banner-container.clicked {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #10b981;
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
        
        .post-content ul {
            list-style: none;
            padding-left: 0;
        }
        
        .post-content li {
            margin: 8px 0;
            padding: 4px 0;
        }
        
        .info-box, .stats {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .features ul {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .container {
                padding: 16px;
            }
            
            .banner-container {
                margin: 15px 0;
                padding: 12px;
            }
            
            .features ul {
                grid-template-columns: 1fr;
            }
            
            .dark-mode-toggle {
                top: 10px;
                right: 10px;
                padding: 6px 10px;
                font-size: 12px;
            }
        }
        
        /* Dark mode class toggle */
        .dark {
            --bg-primary: #1f2937;
            --bg-secondary: #374151;
            --text-primary: #f9fafb;
            --text-secondary: #d1d5db;
            --border-color: #4b5563;
        }
        
        .light {
            --bg-primary: #f9fafb;
            --bg-secondary: #ffffff;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: #e5e7eb;
        }
    </style>
</head>
<body class="min-h-screen transition-all duration-300">
    <button class="dark-mode-toggle" onclick="toggleDarkMode()" id="darkModeToggle">
        🌙 Dark Mode
    </button>
    
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="content-container rounded-lg shadow-lg p-6 transition-all duration-300">
            <h1 class="text-2xl md:text-3xl font-bold mb-6" style="color: var(--text-primary)">${wpPost.title}</h1>
            
            <!-- Step 1 -->
            <div id="step1" class="step active">
                <div class="prose max-w-none mb-6">
                    <div style="color: var(--text-secondary)">${wpPost.content}</div>
                </div>
                
                ${selectedStep1Banners.map((banner, index) => `
                    <div class="banner-container" onclick="trackBannerClick(1, '${banner.banner_type}', ${banner.position})">
                        <div class="text-sm mb-2 font-medium">📢 Anúncio ${banner.banner_type} #${banner.position}</div>
                        ${banner.code}
                    </div>
                `).join('')}
                
                ${step1Ads.map(ad => `
                    <div class="ad-container" onclick="trackBannerClick(1)">
                        <div class="text-sm mb-2" style="color: var(--text-secondary)">Anúncio</div>
                        ${generateAdContent(ad)}
                    </div>
                `).join('')}
                
                <div class="text-center mt-8">
                    <div class="mb-4" style="color: var(--text-secondary)">
                        Aguarde <span id="countdown1" class="countdown">5</span> segundos para continuar
                    </div>
                    <button 
                        id="continueBtn" 
                        class="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed transition-all duration-300"
                        disabled
                    >
                        Continuar
                    </button>
                </div>
            </div>
            
            <!-- Step 2 -->
            <div id="step2" class="step">
                <div class="prose max-w-none mb-6">
                    <div style="color: var(--text-secondary)">${wpPost.content}</div>
                </div>
                
                ${forcedClick ? `
                    <div class="forced-click-message" id="forcedClickMessage">
                        🎯 Para liberar o download, você deve clicar em qualquer banner após o timer!
                    </div>
                ` : ''}
                
                ${selectedStep2Banners.map((banner, index) => `
                    <div class="banner-container" id="banner_${banner.banner_type}_${banner.position}" onclick="trackBannerClick(2, '${banner.banner_type}', ${banner.position})">
                        <div class="text-sm mb-2 font-medium">📢 Anúncio ${banner.banner_type} #${banner.position} - Clique para continuar</div>
                        ${banner.code}
                    </div>
                `).join('')}
                
                ${step2Ads.map((ad, index) => `
                    <div class="banner-container" id="ad_banner_${index}" onclick="trackBannerClick(2, 'ad', ${index})">
                        <div class="text-sm mb-2 font-medium">📢 Anúncio Patrocinado - Clique para continuar</div>
                        ${generateAdContent(ad)}
                    </div>
                `).join('')}
                
                <div class="text-center mt-8">
                    <div class="mb-4" style="color: var(--text-secondary)" id="step2Message">
                        Aguarde <span id="countdown2" class="countdown">${timerDuration}</span> segundos para ${forcedClick ? 'poder clicar no banner' : 'baixar'}
                    </div>
                    <button 
                        id="downloadBtn" 
                        class="bg-green-600 text-white px-6 md:px-8 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed transition-all duration-300"
                        disabled
                    >
                        📥 Download
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
        
        // Dark mode functionality
        function toggleDarkMode() {
            const body = document.body;
            const toggle = document.getElementById('darkModeToggle');
            
            if (body.classList.contains('dark')) {
                body.classList.remove('dark');
                body.classList.add('light');
                toggle.textContent = '🌙 Dark Mode';
                localStorage.setItem('darkMode', 'false');
            } else {
                body.classList.remove('light');
                body.classList.add('dark');
                toggle.textContent = '☀️ Light Mode';
                localStorage.setItem('darkMode', 'true');
            }
        }
        
        // Initialize dark mode based on preference
        function initDarkMode() {
            const savedMode = localStorage.getItem('darkMode');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const toggle = document.getElementById('darkModeToggle');
            
            if (savedMode === 'true' || (savedMode === null && prefersDark)) {
                document.body.classList.add('dark');
                toggle.textContent = '☀️ Light Mode';
            } else {
                document.body.classList.add('light');
                toggle.textContent = '🌙 Dark Mode';
            }
        }
        
        function updateCountdown() {
            if (currentStep === 1) {
                document.getElementById('countdown1').textContent = step1Timer;
                if (step1Timer <= 0) {
                    const btn = document.getElementById('continueBtn');
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    btn.classList.add('hover:bg-blue-700');
                } else {
                    step1Timer--;
                }
            } else if (currentStep === 2) {
                document.getElementById('countdown2').textContent = step2Timer;
                
                if (step2Timer <= 0) {
                    if (forcedClick) {
                        document.getElementById('step2Message').innerHTML = 
                            bannerClicked 
                                ? '<span class="text-green-400 font-bold">✅ Banner clicado! Agora você pode baixar.</span>'
                                : '<span class="text-red-400 font-bold">⏰ Clique em qualquer banner para liberar o download!</span>';
                        
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
                const msg = document.getElementById('forcedClickMessage');
                if (msg) msg.style.display = 'none';
            }
        }
        
        function trackBannerClick(step, bannerType = null, position = null) {
            const timeSpent = step2StartTime ? Math.floor((Date.now() - step2StartTime) / 1000) : 0;
            
            if (step === 2) {
                bannerClicked = true;
                
                // Visual feedback
                let clickedElement;
                if (bannerType && position !== null) {
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
                        '<span class="text-green-400 font-bold">✅ Banner clicado! Agora você pode baixar.</span>';
                }
            }
            
            // Track analytics (simplified for demo)
            console.log('Banner clicked:', { step, bannerType, position, timeSpent });
        }
        
        const countdownInterval = setInterval(updateCountdown, 1000);
        
        document.getElementById('continueBtn').addEventListener('click', function() {
            if (!this.disabled) {
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
                currentStep = 2;
                step2StartTime = Date.now();
            }
        });
        
        document.getElementById('downloadBtn').addEventListener('click', function() {
            if (!this.disabled) {
                const timeSpent = step2StartTime ? Math.floor((Date.now() - step2StartTime) / 1000) : 0;
                
                console.log('Download initiated:', { bannerClicked, timeSpent });
                clearInterval(countdownInterval);
                window.location.href = '${shortUrl.original_url}';
            }
        });
        
        // Initialize dark mode on page load
        initDarkMode();
        
        // Listen for system dark mode changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (!localStorage.getItem('darkMode')) {
                if (e.matches) {
                    document.body.classList.remove('light');
                    document.body.classList.add('dark');
                    document.getElementById('darkModeToggle').textContent = '☀️ Light Mode';
                } else {
                    document.body.classList.remove('dark');
                    document.body.classList.add('light');
                    document.getElementById('darkModeToggle').textContent = '🌙 Dark Mode';
                }
            }
        });
    </script>
</body>
</html>`;
}

function generateAdContent(ad) {
  switch (ad.type) {
    case 'banner':
      return `<img src="${ad.content}" alt="Advertisement" class="w-full max-w-lg mx-auto rounded shadow-lg" />`;
    case 'text':
      return `<div class="text-center text-lg">${ad.content}</div>`;
    case 'html':
      return ad.content;
    case 'video':
      return `<video controls class="w-full max-w-lg mx-auto rounded shadow-lg">
                <source src="${ad.content}" type="video/mp4">
              </video>`;
    default:
      return `<div class="text-center text-lg">${ad.content}</div>`;
  }
}

module.exports = router;