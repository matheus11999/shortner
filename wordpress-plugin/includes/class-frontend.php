<?php

if (!defined('ABSPATH')) {
    exit;
}

class URLShortener_Frontend {
    
    private static $instance = null;
    private $api;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->api = URLShortener_API::get_instance();
        
        // Add rewrite rules and hooks
        add_action('init', array($this, 'add_rewrite_rules'));
        add_action('template_redirect', array($this, 'handle_post_request'));
        add_filter('the_content', array($this, 'replace_post_content'), 999);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
        add_filter('query_vars', array($this, 'add_query_vars'));
    }
    
    public function add_rewrite_rules() {
        // Create physical post.php file to handle requests
        add_action('wp_loaded', array($this, 'create_post_php_handler'));
        
        // Add multiple rewrite rules for comprehensive coverage
        add_rewrite_rule(
            '^post\.php$',
            'index.php?urlshortener_handler=1',
            'top'
        );
        
        // Also handle with query vars
        add_rewrite_rule(
            '^post\.php\?u=([^&]+)',
            'index.php?urlshortener_handler=1&urlshortener_u=$matches[1]',
            'top'
        );
        
        // Flush rewrite rules if they haven't been flushed
        if (get_option('urlshortener_rewrite_rules_flushed') !== URLSHORTENER_VERSION) {
            flush_rewrite_rules();
            update_option('urlshortener_rewrite_rules_flushed', URLSHORTENER_VERSION);
        }
    }
    
    public function add_query_vars($vars) {
        $vars[] = 'urlshortener_handler';
        $vars[] = 'urlshortener_u';
        $vars[] = 'u';
        return $vars;
    }
    
    public function handle_post_request() {
        // Handle multiple ways this could be accessed
        $handler = get_query_var('urlshortener_handler');
        $is_post_php = (strpos($_SERVER['REQUEST_URI'], '/post.php') !== false);
        
        // Get 'u' parameter from multiple sources
        $encoded_url = '';
        if (isset($_GET['u']) && !empty($_GET['u'])) {
            $encoded_url = sanitize_text_field($_GET['u']);
        } elseif (get_query_var('urlshortener_u')) {
            $encoded_url = sanitize_text_field(get_query_var('urlshortener_u'));
        }
        
        if (($handler || $is_post_php) && !empty($encoded_url)) {
            try {
                $short_url = base64_decode($encoded_url);
                
                if ($short_url && filter_var($short_url, FILTER_VALIDATE_URL)) {
                    // Store in session/transient for later use
                    $this->store_short_url_data($short_url);
                    
                    // Redirect to a random post
                    $this->redirect_to_random_post();
                } else {
                    // Invalid URL, try to redirect to the decoded string anyway
                    if ($short_url) {
                        $this->store_short_url_data($short_url);
                        $this->redirect_to_random_post();
                    }
                }
            } catch (Exception $e) {
                // Invalid URL, redirect to home
                wp_redirect(home_url());
                exit;
            }
        }
    }
    
    private function store_short_url_data($short_url) {
        // Get URL data from API
        $url_data = $this->get_url_data($short_url);
        
        if ($url_data) {
            // Store in transient for 1 hour
            $session_key = 'urlshortener_' . md5($short_url . time());
            set_transient($session_key, $url_data, HOUR_IN_SECONDS);
            
            // Store session key in cookie
            setcookie('urlshortener_session', $session_key, time() + HOUR_IN_SECONDS, '/');
        }
    }
    
    private function get_url_data($short_url) {
        $settings = get_option('urlshortener_settings');
        
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            return false;
        }
        
        // Extract short code from URL
        $short_code = $this->extract_short_code($short_url);
        
        if (!$short_code) {
            return false;
        }
        
        // Call API to get URL data
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $response = wp_remote_get($api_url . '/api/urls/' . $short_code . '/data', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return $data;
    }
    
    private function extract_short_code($url) {
        // Extract short code from various URL formats
        if (preg_match('/\/([a-zA-Z0-9_-]+)$/', $url, $matches)) {
            return $matches[1];
        }
        
        if (preg_match('/shortnerurl=([a-zA-Z0-9_-]+)/', $url, $matches)) {
            return $matches[1];
        }
        
        return false;
    }
    
    private function redirect_to_random_post() {
        // Get a random published post
        $posts = get_posts(array(
            'numberposts' => 5,
            'post_status' => 'publish',
            'orderby' => 'rand'
        ));
        
        if (!empty($posts)) {
            $random_post = $posts[0];
            wp_redirect(get_permalink($random_post->ID));
            exit;
        } else {
            // No posts found, redirect to home
            wp_redirect(home_url());
            exit;
        }
    }
    
    public function handle_ads_display() {
        // Check if we have stored URL data
        if (isset($_COOKIE['urlshortener_session'])) {
            $session_key = sanitize_text_field($_COOKIE['urlshortener_session']);
            $url_data = get_transient($session_key);
            
            if ($url_data && is_single()) {
                // We're on a single post and have URL data to display
                add_filter('body_class', array($this, 'add_ads_body_class'));
            }
        }
    }
    
    public function add_ads_body_class($classes) {
        $classes[] = 'urlshortener-ads-active';
        return $classes;
    }
    
    public function replace_post_content($content) {
        if (!is_single() || is_admin()) {
            return $content;
        }
        
        // Check if we have stored URL data
        if (!isset($_COOKIE['urlshortener_session'])) {
            return $content;
        }
        
        $session_key = sanitize_text_field($_COOKIE['urlshortener_session']);
        $url_data = get_transient($session_key);
        
        if (!$url_data) {
            return $content;
        }
        
        // Get ads data from API
        $ads_data = $this->get_ads_data($url_data);
        
        if (!$ads_data) {
            return $content;
        }
        
        // Generate ads HTML
        $ads_html = $this->generate_ads_html($url_data, $ads_data);
        
        // Clean up after displaying
        delete_transient($session_key);
        setcookie('urlshortener_session', '', time() - 3600, '/');
        
        return $ads_html;
    }
    
    private function get_ads_data($url_data) {
        $settings = get_option('urlshortener_settings');
        
        if (empty($settings['api_url']) || empty($settings['api_token']) || !isset($settings['connected_adsite'])) {
            return false;
        }
        
        $adsite_id = $settings['connected_adsite']['id'];
        
        // Get banner configs from API
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $response = wp_remote_get($api_url . '/api/admin/wordpress/banner-configs/' . $adsite_id, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $banner_configs = json_decode($body, true);
        
        // Separate by steps
        $step1_banners = array();
        $step2_banners = array();
        
        foreach ($banner_configs as $banner) {
            if ($banner['step'] == 1) {
                $step1_banners[] = $banner;
            } else {
                $step2_banners[] = $banner;
            }
        }
        
        return array(
            'adsite' => $settings['connected_adsite'],
            'step1_banners' => $step1_banners,
            'step2_banners' => $step2_banners,
            'original_url' => $url_data['original_url'] ?? '#'
        );
    }
    
    private function generate_ads_html($url_data, $ads_data) {
        $adsite = $ads_data['adsite'];
        $step1_banners = $ads_data['step1_banners'];
        $step2_banners = $ads_data['step2_banners'];
        $original_url = $ads_data['original_url'];
        
        $timer_duration = 5; // Default timer
        $forced_click = false; // Default behavior
        
        // Select random banners (max 3 per step)
        $selected_step1 = array_slice(array_rand(array_flip($step1_banners), min(3, count($step1_banners))), 0, 3);
        $selected_step2 = array_slice(array_rand(array_flip($step2_banners), min(3, count($step2_banners))), 0, 3);
        
        ob_start();
        ?>
        <div id="urlshortener-ads-container" class="urlshortener-ads-wrapper">
            <style>
                :root {
                    --bg-primary: #ffffff;
                    --bg-secondary: #f8f9fa;
                    --text-primary: #212529;
                    --text-secondary: #6c757d;
                    --border-color: #dee2e6;
                    --accent-color: #007bff;
                    --success-color: #28a745;
                    --warning-color: #ffc107;
                }
                
                [data-theme="dark"] {
                    --bg-primary: #1a1a1a;
                    --bg-secondary: #2d2d2d;
                    --text-primary: #ffffff;
                    --text-secondary: #b0b0b0;
                    --border-color: #404040;
                    --accent-color: #0d6efd;
                    --success-color: #198754;
                    --warning-color: #ffc107;
                }
                
                .urlshortener-ads-wrapper {
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    min-height: 100vh;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    transition: all 0.3s ease;
                }
                
                .urlshortener-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    border: 1px solid var(--border-color);
                }
                
                .urlshortener-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--border-color);
                }
                
                .urlshortener-title {
                    font-size: 2rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--text-primary);
                }
                
                .urlshortener-subtitle {
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                }
                
                .urlshortener-step {
                    display: none;
                }
                
                .urlshortener-step.active {
                    display: block;
                    animation: fadeIn 0.5s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .urlshortener-banner {
                    margin: 20px 0;
                    padding: 20px;
                    background: linear-gradient(135deg, var(--accent-color), #0056b3);
                    border-radius: 8px;
                    color: white;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 3px solid transparent;
                    position: relative;
                    overflow: hidden;
                }
                
                .urlshortener-banner:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 15px rgba(0,123,255,0.3);
                }
                
                .urlshortener-banner.clicked {
                    background: linear-gradient(135deg, var(--success-color), #1e7e34);
                    border-color: var(--success-color);
                }
                
                .urlshortener-banner-label {
                    font-size: 0.9rem;
                    margin-bottom: 10px;
                    opacity: 0.9;
                    font-weight: 500;
                }
                
                .urlshortener-timer {
                    text-align: center;
                    margin: 30px 0;
                    padding: 20px;
                    background: var(--bg-primary);
                    border-radius: 8px;
                    border: 2px solid var(--border-color);
                }
                
                .urlshortener-countdown {
                    font-size: 2rem;
                    font-weight: bold;
                    color: var(--warning-color);
                    margin-bottom: 10px;
                }
                
                .urlshortener-button {
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-block;
                    text-decoration: none;
                    min-width: 200px;
                }
                
                .urlshortener-button:hover {
                    background: #0056b3;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,123,255,0.3);
                }
                
                .urlshortener-button:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .urlshortener-button.success {
                    background: var(--success-color);
                }
                
                .urlshortener-button.success:hover {
                    background: #1e7e34;
                }
                
                .urlshortener-dark-toggle {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--bg-secondary);
                    border: 2px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 10px 15px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    z-index: 1000;
                }
                
                .urlshortener-dark-toggle:hover {
                    background: var(--accent-color);
                    color: white;
                    border-color: var(--accent-color);
                }
                
                .urlshortener-progress {
                    width: 100%;
                    height: 6px;
                    background: var(--border-color);
                    border-radius: 3px;
                    margin: 20px 0;
                    overflow: hidden;
                }
                
                .urlshortener-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent-color), var(--success-color));
                    transition: width 0.3s ease;
                    border-radius: 3px;
                }
                
                /* Responsive Design */
                @media (max-width: 768px) {
                    .urlshortener-ads-wrapper {
                        padding: 10px;
                    }
                    
                    .urlshortener-container {
                        padding: 20px;
                        margin: 0;
                    }
                    
                    .urlshortener-title {
                        font-size: 1.5rem;
                    }
                    
                    .urlshortener-banner {
                        margin: 15px 0;
                        padding: 15px;
                    }
                    
                    .urlshortener-button {
                        width: 100%;
                        padding: 12px 20px;
                    }
                    
                    .urlshortener-dark-toggle {
                        top: 10px;
                        right: 10px;
                        padding: 8px 12px;
                        font-size: 0.8rem;
                    }
                }
                
                /* Banner content styling */
                .urlshortener-banner iframe,
                .urlshortener-banner img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 4px;
                }
                
                .urlshortener-banner-content {
                    position: relative;
                    z-index: 2;
                }
                
                /* Loading animation */
                .urlshortener-loading {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s ease-in-out infinite;
                    margin-right: 8px;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
            
            <button class="urlshortener-dark-toggle" onclick="toggleDarkMode()">
                🌙 Modo Escuro
            </button>
            
            <div class="urlshortener-container">
                <div class="urlshortener-header">
                    <h1 class="urlshortener-title">🎯 Seu download está quase pronto!</h1>
                    <p class="urlshortener-subtitle">Aguarde alguns segundos e visualize nossos parceiros</p>
                    <div class="urlshortener-progress">
                        <div class="urlshortener-progress-bar" id="progress-bar" style="width: 0%"></div>
                    </div>
                </div>
                
                <!-- Step 1 -->
                <div id="step1" class="urlshortener-step active">
                    <h2 style="text-align: center; margin-bottom: 25px;">📋 Etapa 1 de 2</h2>
                    
                    <?php foreach ($selected_step1 as $index => $banner): ?>
                        <div class="urlshortener-banner" onclick="trackBannerClick(1, <?php echo $index; ?>)">
                            <div class="urlshortener-banner-label">
                                📢 Anúncio <?php echo $banner['banner_type']; ?> #<?php echo $banner['position']; ?>
                            </div>
                            <div class="urlshortener-banner-content">
                                <?php echo wp_kses_post($banner['code']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    
                    <div class="urlshortener-timer">
                        <div class="urlshortener-countdown" id="countdown1">5</div>
                        <p>segundos para continuar</p>
                        <button class="urlshortener-button" id="continue-btn" disabled onclick="goToStep2()">
                            Continuar para Etapa 2
                        </button>
                    </div>
                </div>
                
                <!-- Step 2 -->
                <div id="step2" class="urlshortener-step">
                    <h2 style="text-align: center; margin-bottom: 25px;">🎯 Etapa 2 de 2</h2>
                    
                    <?php foreach ($selected_step2 as $index => $banner): ?>
                        <div class="urlshortener-banner" onclick="trackBannerClick(2, <?php echo $index; ?>)">
                            <div class="urlshortener-banner-label">
                                📢 Anúncio <?php echo $banner['banner_type']; ?> #<?php echo $banner['position']; ?> - Clique aqui
                            </div>
                            <div class="urlshortener-banner-content">
                                <?php echo wp_kses_post($banner['code']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    
                    <div class="urlshortener-timer">
                        <div class="urlshortener-countdown" id="countdown2"><?php echo $timer_duration; ?></div>
                        <p id="step2-message">segundos para liberar o download</p>
                        <a href="<?php echo esc_url($original_url); ?>" class="urlshortener-button success" id="download-btn" style="pointer-events: none; opacity: 0.6;">
                            <span class="urlshortener-loading" id="download-loading" style="display: none;"></span>
                            📥 Acessar Conteúdo
                        </a>
                    </div>
                </div>
            </div>
            
            <script>
                let step1Timer = 5;
                let step2Timer = <?php echo $timer_duration; ?>;
                let currentStep = 1;
                let bannerClicked = false;
                
                // Dark mode functionality
                function toggleDarkMode() {
                    const container = document.getElementById('urlshortener-ads-container');
                    const toggle = document.querySelector('.urlshortener-dark-toggle');
                    
                    if (container.getAttribute('data-theme') === 'dark') {
                        container.removeAttribute('data-theme');
                        toggle.textContent = '🌙 Modo Escuro';
                        localStorage.setItem('urlshortener-theme', 'light');
                    } else {
                        container.setAttribute('data-theme', 'dark');
                        toggle.textContent = '☀️ Modo Claro';
                        localStorage.setItem('urlshortener-theme', 'dark');
                    }
                }
                
                // Initialize theme
                function initTheme() {
                    const savedTheme = localStorage.getItem('urlshortener-theme');
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    
                    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                        document.getElementById('urlshortener-ads-container').setAttribute('data-theme', 'dark');
                        document.querySelector('.urlshortener-dark-toggle').textContent = '☀️ Modo Claro';
                    }
                }
                
                // Timer functions
                function updateCountdown() {
                    if (currentStep === 1) {
                        document.getElementById('countdown1').textContent = step1Timer;
                        document.getElementById('progress-bar').style.width = ((5 - step1Timer) / 5 * 50) + '%';
                        
                        if (step1Timer <= 0) {
                            document.getElementById('continue-btn').disabled = false;
                            document.getElementById('continue-btn').style.opacity = '1';
                            document.getElementById('continue-btn').style.pointerEvents = 'auto';
                        } else {
                            step1Timer--;
                        }
                    } else if (currentStep === 2) {
                        document.getElementById('countdown2').textContent = step2Timer;
                        document.getElementById('progress-bar').style.width = (50 + ((<?php echo $timer_duration; ?> - step2Timer) / <?php echo $timer_duration; ?> * 50)) + '%';
                        
                        if (step2Timer <= 0) {
                            enableDownload();
                        } else {
                            step2Timer--;
                        }
                    }
                }
                
                function goToStep2() {
                    document.getElementById('step1').classList.remove('active');
                    document.getElementById('step2').classList.add('active');
                    currentStep = 2;
                }
                
                function enableDownload() {
                    const downloadBtn = document.getElementById('download-btn');
                    downloadBtn.style.opacity = '1';
                    downloadBtn.style.pointerEvents = 'auto';
                    document.getElementById('step2-message').textContent = 'Download liberado! Clique no botão abaixo.';
                }
                
                function trackBannerClick(step, index) {
                    const banner = event.currentTarget;
                    banner.classList.add('clicked');
                    
                    // Visual feedback
                    const label = banner.querySelector('.urlshortener-banner-label');
                    if (label) {
                        label.textContent = label.textContent.replace('Clique aqui', '✅ Clicado!');
                    }
                    
                    bannerClicked = true;
                    
                    // Add click effect
                    banner.style.transform = 'scale(0.98)';
                    setTimeout(() => {
                        banner.style.transform = 'translateY(-2px)';
                    }, 150);
                }
                
                // Start countdown
                const countdownInterval = setInterval(updateCountdown, 1000);
                
                // Initialize theme on load
                initTheme();
                
                // Handle download click
                document.getElementById('download-btn').addEventListener('click', function(e) {
                    if (this.style.pointerEvents === 'none') {
                        e.preventDefault();
                        return false;
                    }
                    
                    // Show loading
                    const loading = document.getElementById('download-loading');
                    loading.style.display = 'inline-block';
                    this.innerHTML = '<span class="urlshortener-loading"></span> Redirecionando...';
                    
                    // Clear interval
                    clearInterval(countdownInterval);
                });
                
                // Listen for system theme changes
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    if (!localStorage.getItem('urlshortener-theme')) {
                        const container = document.getElementById('urlshortener-ads-container');
                        const toggle = document.querySelector('.urlshortener-dark-toggle');
                        
                        if (e.matches) {
                            container.setAttribute('data-theme', 'dark');
                            toggle.textContent = '☀️ Modo Claro';
                        } else {
                            container.removeAttribute('data-theme');
                            toggle.textContent = '🌙 Modo Escuro';
                        }
                    }
                });
            </script>
        </div>
        <?php
        return ob_get_clean();
    }
    
    public function enqueue_frontend_assets() {
        if (is_single() && isset($_COOKIE['urlshortener_session'])) {
            wp_enqueue_script('jquery');
        }
    }
    
    // Create physical post.php file to handle requests
    public function create_post_php_handler() {
        $post_php_path = ABSPATH . 'post.php';
        
        // Always create/update the file to ensure it works
        $post_php_content = "<?php
/**
 * URL Shortener AdSite Handler - Auto-generated v" . URLSHORTENER_VERSION . "
 * This file handles post.php?u=xxx requests for the URL Shortener plugin
 * Generated: " . date('Y-m-d H:i:s') . "
 */

// Prevent direct access without parameters
if (!isset(\$_GET['u']) || empty(\$_GET['u'])) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested resource was not found on this server.</p></body></html>';
    exit;
}

// Load WordPress
if (!defined('ABSPATH')) {
    require_once __DIR__ . '/wp-load.php';
}

// Check if plugin is active
if (!function_exists('is_plugin_active') || !is_plugin_active('url-shortener-adsite/url-shortener-adsite.php')) {
    wp_redirect(home_url());
    exit;
}

// Sanitize and decode the URL
\$encoded_url = sanitize_text_field(\$_GET['u']);
\$short_url = base64_decode(\$encoded_url);

if (!\$short_url) {
    wp_redirect(home_url());
    exit;
}

// Store URL data for later use
\$session_key = 'urlshortener_' . md5(\$short_url . time() . wp_get_session_token());
\$url_data = array(
    'original_url' => \$short_url,
    'encoded_url' => \$encoded_url,
    'timestamp' => time(),
    'ip' => \$_SERVER['REMOTE_ADDR'] ?? 'unknown'
);

set_transient(\$session_key, \$url_data, HOUR_IN_SECONDS);
setcookie('urlshortener_session', \$session_key, time() + HOUR_IN_SECONDS, '/', '', is_ssl(), true);

// Get a random post to redirect to
\$posts = get_posts(array(
    'numberposts' => 10,
    'post_status' => 'publish',
    'orderby' => 'rand',
    'post_type' => 'post'
));

if (!empty(\$posts)) {
    \$random_post = \$posts[0];
    \$redirect_url = get_permalink(\$random_post->ID);
    
    // Add some logging for debugging
    error_log('URLShortener: Redirecting from ' . \$short_url . ' to ' . \$redirect_url);
    
    wp_redirect(\$redirect_url);
    exit;
} else {
    // No posts found, create a simple post or redirect to home
    wp_redirect(home_url());
    exit;
}
?>
";
        
        // Create the file with proper permissions
        $result = file_put_contents($post_php_path, $post_php_content);
        
        if ($result !== false) {
            // Set proper permissions
            chmod($post_php_path, 0644);
            update_option('urlshortener_post_php_version', URLSHORTENER_VERSION);
            error_log('URLShortener: Created post.php handler at ' . $post_php_path);
        } else {
            error_log('URLShortener: Failed to create post.php handler');
        }
    }
    
    // Test function for admin
    public function generate_test_url($target_url = null) {
        // Ensure the post.php file exists
        $this->create_post_php_handler();
        
        if (!$target_url) {
            $target_url = 'https://google.com';
        }
        
        $encoded = base64_encode($target_url);
        return home_url('/post.php?u=' . $encoded);
    }
}