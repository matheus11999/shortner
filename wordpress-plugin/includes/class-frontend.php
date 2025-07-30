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
        
        // Hook to intercept posts and show ads
        add_action('template_redirect', array($this, 'intercept_posts_for_ads'), 5);
        add_action('wp_head', array($this, 'add_ads_tracking'), 1);
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
                
                if ($short_url) {
                    // Store in session/transient for later use
                    $this->store_short_url_data($short_url);
                    
                    // Redirect to a random post
                    $this->redirect_to_random_post();
                }
            } catch (Exception $e) {
                error_log('URLShortener decode error: ' . $e->getMessage());
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
        
        error_log('URLShortener: Replacing content with ads for URL: ' . $url_data['original_url']);
        
        // Get ads data from API
        $ads_data = $this->get_ads_data($url_data);
        
        if (!$ads_data) {
            error_log('URLShortener: No ads data found, using fallback');
            // Create fallback ads data
            $ads_data = $this->create_fallback_ads_data($url_data);
        }
        
        // Generate ads HTML
        $ads_html = $this->generate_ads_html($url_data, $ads_data);
        
        // Don't clean up immediately - keep for debugging
        // delete_transient($session_key);
        // setcookie('urlshortener_session', '', time() - 3600, '/');
        
        return $ads_html;
    }
    
    // Generate ads page directly without WordPress theme
    public function generate_ads_page_direct($url_data) {
        // Get a random post for metadata
        $random_post = $this->get_random_post();
        
        // Get ads data
        $ads_data = $this->get_ads_data($url_data);
        
        if (!$ads_data) {
            // Create fallback ads data using post metadata
            $ads_data = $this->create_fallback_ads_data($url_data, $random_post);
        }
        
        // Get settings for timer and behavior
        $settings = get_option('urlshortener_settings');
        $timer_duration = 5; // Default timer
        $forced_click = false; // Default behavior
        
        if (isset($settings['connected_adsite'])) {
            $adsite = $settings['connected_adsite'];
            $timer_duration = $adsite['timer_duration'] ?? 5;
            $forced_click = $adsite['forced_click'] ?? false;
        }
        
        $adsite = $ads_data['adsite'];
        $step1_banners = $ads_data['step1_banners'];
        $step2_banners = $ads_data['step2_banners'];
        $original_url = $ads_data['original_url'];
        
        // Extract post metadata for display
        $post_title = $random_post ? get_the_title($random_post->ID) : get_bloginfo('name');
        $post_excerpt = $random_post ? wp_trim_words(get_the_excerpt($random_post->ID), 20) : get_bloginfo('description');
        $post_thumbnail = $random_post && has_post_thumbnail($random_post->ID) ? get_the_post_thumbnail_url($random_post->ID, 'medium') : '';
        $post_date = $random_post ? get_the_date('d/m/Y', $random_post->ID) : date('d/m/Y');
        $post_author = $random_post ? get_the_author_meta('display_name', $random_post->post_author) : 'Admin';
        
        // Select random banners (max 3 per step)
        $selected_step1 = array_slice($step1_banners, 0, min(3, count($step1_banners)));
        $selected_step2 = array_slice($step2_banners, 0, min(3, count($step2_banners)));
        
        ob_start();
        ?>
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title><?php echo esc_html($post_title); ?> - <?php echo get_bloginfo('name'); ?></title>
            <meta name="description" content="<?php echo esc_attr($post_excerpt); ?>">
            <?php if ($post_thumbnail): ?>
            <meta property="og:image" content="<?php echo esc_url($post_thumbnail); ?>">
            <?php endif; ?>
            <meta property="og:title" content="<?php echo esc_attr($post_title); ?>">
            <meta property="og:description" content="<?php echo esc_attr($post_excerpt); ?>">
            <meta property="og:type" content="article">
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
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
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
                    body {
                        padding: 10px;
                    }
                    
                    .urlshortener-container {
                        padding: 20px;
                        margin: 0;
                    }
                    
                    .urlshortener-post-header {
                        flex-direction: column;
                        text-align: center;
                    }
                    
                    .urlshortener-post-thumbnail {
                        flex: none;
                        align-self: center;
                    }
                    
                    .urlshortener-post-thumbnail img {
                        max-width: 250px;
                    }
                    
                    .urlshortener-post-info {
                        justify-content: center;
                        flex-wrap: wrap;
                    }
                    
                    .urlshortener-post-title {
                        font-size: 1.3rem;
                    }
                    
                    .urlshortener-title {
                        font-size: 1.3rem;
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
                
                /* Post Header Styles */
                .urlshortener-post-header {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 30px;
                    padding: 25px;
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    align-items: flex-start;
                }
                
                .urlshortener-post-thumbnail {
                    flex: 0 0 200px;
                }
                
                .urlshortener-post-thumbnail img {
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .urlshortener-post-meta {
                    flex: 1;
                }
                
                .urlshortener-post-title {
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--text-primary);
                    line-height: 1.3;
                }
                
                .urlshortener-post-excerpt {
                    color: var(--text-secondary);
                    font-size: 1rem;
                    line-height: 1.5;
                    margin-bottom: 15px;
                }
                
                .urlshortener-post-info {
                    display: flex;
                    gap: 20px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                
                .urlshortener-post-date,
                .urlshortener-post-author {
                    padding: 5px 10px;
                    background: var(--bg-primary);
                    border-radius: 15px;
                    border: 1px solid var(--border-color);
                }
            </style>
        </head>
        <body>
            <button class="urlshortener-dark-toggle" onclick="toggleDarkMode()">
                🌙 Modo Escuro
            </button>
            
            <div class="urlshortener-container">
                <!-- Post Header with Random Post Metadata -->
                <div class="urlshortener-post-header">
                    <?php if ($post_thumbnail): ?>
                    <div class="urlshortener-post-thumbnail">
                        <img src="<?php echo esc_url($post_thumbnail); ?>" alt="<?php echo esc_attr($post_title); ?>" loading="lazy">
                    </div>
                    <?php endif; ?>
                    <div class="urlshortener-post-meta">
                        <h1 class="urlshortener-post-title"><?php echo esc_html($post_title); ?></h1>
                        <p class="urlshortener-post-excerpt"><?php echo esc_html($post_excerpt); ?></p>
                        <div class="urlshortener-post-info">
                            <span class="urlshortener-post-date">📅 <?php echo esc_html($post_date); ?></span>
                            <span class="urlshortener-post-author">👤 <?php echo esc_html($post_author); ?></span>
                        </div>
                    </div>
                </div>
                
                <div class="urlshortener-header">
                    <h2 class="urlshortener-title">🎯 Aguarde para continuar a leitura</h2>
                    <p class="urlshortener-subtitle">Visualize nossos parceiros antes de prosseguir</p>
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
                                <?php echo $banner['code']; ?>
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
                                <?php echo $banner['code']; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    
                    <div class="urlshortener-timer">
                        <div class="urlshortener-countdown" id="countdown2"><?php echo $timer_duration; ?></div>
                        <p id="step2-message">segundos para liberar o download</p>
                        <a href="<?php echo esc_url($original_url); ?>" class="urlshortener-button success" id="download-btn" style="pointer-events: none; opacity: 0.6;">
                            <span class="urlshortener-loading" id="download-loading" style="display: none;"></span>
                            📖 Continuar Leitura
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
                    const body = document.body;
                    const toggle = document.querySelector('.urlshortener-dark-toggle');
                    
                    if (body.getAttribute('data-theme') === 'dark') {
                        body.removeAttribute('data-theme');
                        toggle.textContent = '🌙 Modo Escuro';
                        localStorage.setItem('urlshortener-theme', 'light');
                    } else {
                        body.setAttribute('data-theme', 'dark');
                        toggle.textContent = '☀️ Modo Claro';
                        localStorage.setItem('urlshortener-theme', 'dark');
                    }
                }
                
                // Initialize theme
                function initTheme() {
                    const savedTheme = localStorage.getItem('urlshortener-theme');
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    
                    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                        document.body.setAttribute('data-theme', 'dark');
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
                        const body = document.body;
                        const toggle = document.querySelector('.urlshortener-dark-toggle');
                        
                        if (e.matches) {
                            body.setAttribute('data-theme', 'dark');
                            toggle.textContent = '☀️ Modo Claro';
                        } else {
                            body.removeAttribute('data-theme');
                            toggle.textContent = '🌙 Modo Escuro';
                        }
                    }
                });
            </script>
        </body>
        </html>
        <?php
        return ob_get_clean();
    }
    
    // Generate inline ads HTML for WordPress post content replacement
    public function generate_inline_ads_html($url_data, $ads_data) {
        // Get settings for timer and behavior
        $settings = get_option('urlshortener_settings');
        $timer_duration = 5; // Default timer
        $forced_click = false; // Default behavior
        
        if (isset($settings['connected_adsite'])) {
            $adsite = $settings['connected_adsite'];
            $timer_duration = $adsite['timer_duration'] ?? 5;
            $forced_click = $adsite['forced_click'] ?? false;
        }
        
        $adsite = $ads_data['adsite'];
        $step1_banners = $ads_data['step1_banners'];
        $step2_banners = $ads_data['step2_banners'];
        $original_url = $ads_data['original_url'];
        
        // Select random banners (max 3 per step)
        $selected_step1 = array_slice($step1_banners, 0, min(3, count($step1_banners)));
        $selected_step2 = array_slice($step2_banners, 0, min(3, count($step2_banners)));
        
        ob_start();
        ?>
        <div id="urlshortener-ads-container" class="urlshortener-ads-wrapper">
            <style>
                .urlshortener-ads-wrapper {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 15px;
                    margin: 20px 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: relative;
                    overflow: hidden;
                }
                
                .urlshortener-ads-wrapper::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.1);
                    z-index: 1;
                }
                
                .urlshortener-container {
                    position: relative;
                    z-index: 2;
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .urlshortener-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid rgba(255,255,255,0.3);
                }
                
                .urlshortener-title {
                    font-size: 2rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                
                .urlshortener-subtitle {
                    opacity: 0.9;
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
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 2px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                }
                
                .urlshortener-banner:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    border-color: rgba(255,255,255,0.4);
                }
                
                .urlshortener-banner.clicked {
                    background: rgba(40, 167, 69, 0.3);
                    border-color: #28a745;
                }
                
                .urlshortener-banner-label {
                    font-size: 0.9rem;
                    margin-bottom: 10px;
                    opacity: 0.8;
                    font-weight: 500;
                }
                
                .urlshortener-timer {
                    text-align: center;
                    margin: 30px 0;
                    padding: 25px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.2);
                }
                
                .urlshortener-countdown {
                    font-size: 3rem;
                    font-weight: bold;
                    margin-bottom: 15px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                    color: #ffc107;
                }
                
                .urlshortener-button {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 25px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-block;
                    text-decoration: none;
                    min-width: 250px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                
                .urlshortener-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                }
                
                .urlshortener-button:disabled {
                    background: rgba(108, 117, 125, 0.5);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .urlshortener-button.success {
                    background: linear-gradient(135deg, #007bff, #0056b3);
                }
                
                .urlshortener-progress {
                    width: 100%;
                    height: 8px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                    margin: 20px 0;
                    overflow: hidden;
                }
                
                .urlshortener-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #007bff, #28a745);
                    transition: width 0.3s ease;
                    border-radius: 4px;
                }
                
                /* Mobile responsive */
                @media (max-width: 768px) {
                    .urlshortener-ads-wrapper {
                        padding: 20px;
                        margin: 10px 0;
                    }
                    
                    .urlshortener-title {
                        font-size: 1.5rem;
                    }
                    
                    .urlshortener-countdown {
                        font-size: 2rem;
                    }
                    
                    .urlshortener-button {
                        width: 100%;
                        padding: 12px 20px;
                    }
                }
            </style>
            
            <div class="urlshortener-container">
                <div class="urlshortener-header">
                    <h2 class="urlshortener-title">🎯 Seu conteúdo está quase pronto!</h2>
                    <p class="urlshortener-subtitle">Aguarde alguns segundos e visualize nossos parceiros</p>
                    <div class="urlshortener-progress">
                        <div class="urlshortener-progress-bar" id="progress-bar" style="width: 0%"></div>
                    </div>
                </div>
                
                <!-- Step 1 -->
                <div id="step1" class="urlshortener-step active">
                    <h3 style="text-align: center; margin-bottom: 25px;">📋 Etapa 1 de 2</h3>
                    
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
                    <h3 style="text-align: center; margin-bottom: 25px;">🎯 Etapa Final</h3>
                    
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
                        <p id="step2-message">segundos para liberar o conteúdo</p>
                        <a href="<?php echo esc_url($original_url); ?>" class="urlshortener-button success" id="download-btn" style="pointer-events: none; opacity: 0.6;">
                            📖 Continuar Leitura Original
                        </a>
                    </div>
                </div>
            </div>
            
            <script>
                let step1Timer = 5;
                let step2Timer = <?php echo $timer_duration; ?>;
                let currentStep = 1;
                let bannerClicked = false;
                
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
                    document.getElementById('step2-message').textContent = 'Conteúdo liberado! Clique no botão abaixo.';
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
                        banner.style.transform = 'translateY(-3px)';
                    }, 150);
                }
                
                // Start countdown
                const countdownInterval = setInterval(updateCountdown, 1000);
                
                // Handle download click
                document.getElementById('download-btn').addEventListener('click', function(e) {
                    if (this.style.pointerEvents === 'none') {
                        e.preventDefault();
                        return false;
                    }
                    
                    // Show loading
                    this.innerHTML = '🔄 Redirecionando...';
                    
                    // Clear interval
                    clearInterval(countdownInterval);
                });
            </script>
        </div>
        <?php
        return ob_get_clean();
    }
    
    private function get_ads_data($url_data) {
        $settings = get_option('urlshortener_settings');
        
        if (empty($settings['api_url']) || empty($settings['api_token']) || !isset($settings['connected_adsite'])) {
            error_log('URLShortener: Missing settings - API URL: ' . (!empty($settings['api_url']) ? 'OK' : 'MISSING') . ', Token: ' . (!empty($settings['api_token']) ? 'OK' : 'MISSING') . ', AdSite: ' . (isset($settings['connected_adsite']) ? 'OK' : 'MISSING'));
            return false;
        }
        
        $adsite_id = $settings['connected_adsite']['id'];
        
        // Get banner configs from API
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $api_endpoint = $api_url . '/api/admin/wordpress/banner-configs/' . $adsite_id;
        error_log('URLShortener: Calling API endpoint: ' . $api_endpoint);
        
        $response = wp_remote_get($api_endpoint, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            error_log('URLShortener: API call failed: ' . $response->get_error_message());
            return false;
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        error_log('URLShortener: API response code: ' . $response_code);
        
        $body = wp_remote_retrieve_body($response);
        $banner_configs = json_decode($body, true);
        
        // Check if JSON decode was successful and we have valid data
        if (!$banner_configs || !is_array($banner_configs)) {
            error_log('URLShortener: Invalid banner configs from API: ' . $body);
            return false;
        }
        
        // Separate by steps
        $step1_banners = array();
        $step2_banners = array();
        
        foreach ($banner_configs as $banner) {
            if (isset($banner['step']) && $banner['step'] == 1) {
                $step1_banners[] = $banner;
            } elseif (isset($banner['step']) && $banner['step'] == 2) {
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
    
    private function get_random_post() {
        // Get a random published post
        $posts = get_posts(array(
            'numberposts' => 1,
            'post_status' => 'publish',
            'orderby' => 'rand',
            'post_type' => 'post'
        ));
        
        return !empty($posts) ? $posts[0] : null;
    }
    
    private function create_fallback_ads_data($url_data, $random_post = null) {
        // Create fallback banner data when API is not available
        $fallback_banner = array(
            'id' => 1,
            'step' => 1,
            'banner_type' => '300x250',
            'position' => 1,
            'code' => '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white; border-radius: 10px; font-family: Arial, sans-serif;"><h3 style="margin: 0 0 15px 0;">🎯 Anúncio de Teste</h3><p style="margin: 0; opacity: 0.9;">Sistema funcionando corretamente!</p></div>',
            'active' => true
        );
        
        return array(
            'adsite' => array(
                'id' => 1,
                'name' => 'Teste AdSite',
                'url' => home_url()
            ),
            'step1_banners' => array($fallback_banner, $fallback_banner, $fallback_banner),
            'step2_banners' => array($fallback_banner, $fallback_banner),
            'original_url' => $url_data['original_url'] ?? 'https://google.com'
        );
    }
    
    private function generate_ads_html($url_data, $ads_data) {
        $adsite = $ads_data['adsite'];
        $step1_banners = $ads_data['step1_banners'];
        $step2_banners = $ads_data['step2_banners'];
        $original_url = $ads_data['original_url'];
        
        $timer_duration = 5; // Default timer
        $forced_click = false; // Default behavior
        
        // Select random banners (max 3 per step) - fix for empty array error
        $selected_step1 = array();
        $selected_step2 = array();
        
        if (!empty($step1_banners) && is_array($step1_banners)) {
            // Shuffle and take up to 3 banners
            $shuffled_step1 = $step1_banners;
            shuffle($shuffled_step1);
            $selected_step1 = array_slice($shuffled_step1, 0, min(3, count($shuffled_step1)));
        }
        
        if (!empty($step2_banners) && is_array($step2_banners)) {
            // Shuffle and take up to 3 banners  
            $shuffled_step2 = $step2_banners;
            shuffle($shuffled_step2);
            $selected_step2 = array_slice($shuffled_step2, 0, min(3, count($shuffled_step2)));
        }
        
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
                            📖 Continuar Leitura
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
    
    // Intercept posts to show ads when session exists
    public function intercept_posts_for_ads() {
        // Debug mode
        define('URLSHORTENER_DEBUG', true);
        
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: intercept_posts_for_ads called');
            error_log('URLShortener Debug: is_single=' . (is_single() ? 'true' : 'false'));
            error_log('URLShortener Debug: is_admin=' . (is_admin() ? 'true' : 'false'));
        }
        
        // Only intercept single posts
        if (!is_single() || is_admin()) {
            if (URLSHORTENER_DEBUG) {
                error_log('URLShortener Debug: Not intercepting - not single post or is admin');
            }
            return;
        }
        
        // Check if we have an active ads session
        if (!isset($_COOKIE['urlshortener_session'])) {
            if (URLSHORTENER_DEBUG) {
                error_log('URLShortener Debug: No session cookie found');
            }
            return;
        }
        
        $session_key = sanitize_text_field($_COOKIE['urlshortener_session']);
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: Session key: ' . $session_key);
        }
        
        $url_data = get_transient($session_key);
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: URL data: ' . json_encode($url_data));
        }
        
        // Check if session is valid and not expired
        if (!$url_data || !is_array($url_data)) {
            if (URLSHORTENER_DEBUG) {
                error_log('URLShortener Debug: Invalid session data, cleaning up');
            }
            // Clean up invalid cookie
            setcookie('urlshortener_session', '', time() - 3600, '/');
            return;
        }
        
        // Check if session is expired (2 minutes)
        if (isset($url_data['expires']) && time() > $url_data['expires']) {
            if (URLSHORTENER_DEBUG) {
                error_log('URLShortener Debug: Session expired, cleaning up');
            }
            // Clean up expired session
            delete_transient($session_key);
            setcookie('urlshortener_session', '', time() - 3600, '/');
            return;
        }
        
        // We have a valid session - generate and display ads page
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: Valid session found, displaying ads');
        }
        
        // Generate ads page directly
        $this->display_ads_page_direct($url_data);
        exit;
    }
    
    // Add tracking code to posts with ads
    public function add_ads_tracking() {
        if (!is_single() || !isset($_COOKIE['urlshortener_session'])) {
            return;
        }
        
        $session_key = sanitize_text_field($_COOKIE['urlshortener_session']);
        $url_data = get_transient($session_key);
        
        if ($url_data && is_array($url_data)) {
            echo '<meta name="urlshortener-session" content="' . esc_attr($session_key) . '">';
            echo '<meta name="urlshortener-step" content="' . esc_attr($url_data['step'] ?? 1) . '">';
        }
    }
    
    // Display ads page directly (new responsive design)
    public function display_ads_page_direct($url_data) {
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: display_ads_page_direct called');
        }
        
        // Get random post for metadata
        $random_post = $this->get_random_post();
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: Random post: ' . ($random_post ? $random_post->ID : 'none'));
        }
        
        // Extract post metadata for display
        $post_title = $random_post ? get_the_title($random_post->ID) : get_bloginfo('name');
        $post_excerpt = $random_post ? wp_trim_words(get_the_excerpt($random_post->ID), 25) : get_bloginfo('description');
        $post_thumbnail = $random_post && has_post_thumbnail($random_post->ID) ? get_the_post_thumbnail_url($random_post->ID, 'large') : '';
        $post_date = $random_post ? get_the_date('d/m/Y H:i', $random_post->ID) : date('d/m/Y H:i');
        $post_author = $random_post ? get_the_author_meta('display_name', $random_post->post_author) : 'Admin';
        $post_url = $random_post ? get_permalink($random_post->ID) : home_url();
        
        // Current step
        $current_step = $url_data['step'] ?? 1;
        
        if (URLSHORTENER_DEBUG) {
            error_log('URLShortener Debug: Post metadata extracted');
        }
        
        // For now, display a simple debug page
        ?>
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title><?php echo esc_html($post_title); ?> - Anúncios</title>
            <style>
                body { background: #1a1a1a; color: #fff; font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                .debug { background: #333; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .success { color: #28a745; }
                .error { color: #dc3545; }
                .info { color: #007bff; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎯 Sistema de Anúncios Ativo</h1>
                <p>Página interceptada com sucesso! Os anúncios serão exibidos aqui.</p>
                
                <div class="debug">
                    <h3>🐛 Debug Information</h3>
                    <div class="success">✅ WordPress hook funcionando</div>
                    <div class="success">✅ Sessão válida encontrada</div>
                    <div class="info">📝 Post: <?php echo esc_html($post_title); ?></div>
                    <div class="info">📄 URL Original: <?php echo esc_html($url_data['original_url'] ?? 'N/A'); ?></div>
                    <div class="info">⏰ Step: <?php echo $current_step; ?></div>
                    <div class="info">🕒 Sessão expira: <?php echo date('Y-m-d H:i:s', $url_data['expires'] ?? time()); ?></div>
                </div>
                
                <div class="debug">
                    <h3>📊 Próximos Passos</h3>
                    <p>✅ Sistema base funcionando<br>
                    🔄 Implementar página de anúncios completa<br>
                    🔄 Integração com servidor de anúncios<br>
                    🔄 Sistema de analytics</p>
                </div>
                
                <div style="margin-top: 30px;">
                    <a href="<?php echo esc_url($url_data['original_url'] ?? '#'); ?>" 
                       style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                       📖 Ir para URL Original (Teste)
                    </a>
                </div>
            </div>
        </body>
        </html>
        <?php
    }
    
    // Create physical post.php file to handle requests
    public function create_post_php_handler() {
        $post_php_path = ABSPATH . 'post.php';
        
        // Embed the post handler content directly (fix for file path error)
        $post_php_content = '<?php
/**
 * URL Shortener AdSite Handler - Loading Page
 * Loading page with session creation and redirect to random post
 */

// Debug mode
define(\'URLSHORTENER_DEBUG\', true);

// Error reporting for debug
if (URLSHORTENER_DEBUG) {
    error_reporting(E_ALL);
    ini_set(\'display_errors\', 1);
    ini_set(\'log_errors\', 1);
    
    // Custom error handler to display errors in HTML
    function custom_error_handler($errno, $errstr, $errfile, $errline) {
        $error_msg = "<div style=\"background: #dc3545; color: white; padding: 15px; margin: 10px; border-radius: 5px; font-family: monospace;\">";
        $error_msg .= "<strong>PHP Error:</strong> $errstr<br>";
        $error_msg .= "<strong>File:</strong> $errfile<br>";
        $error_msg .= "<strong>Line:</strong> $errline<br>";
        $error_msg .= "<strong>Error Code:</strong> $errno";
        $error_msg .= "</div>";
        echo $error_msg;
        return true;
    }
    set_error_handler(\'custom_error_handler\');
}

// Debug function
function debug_log($message) {
    if (URLSHORTENER_DEBUG) {
        error_log(\'URLShortener Debug: \' . $message);
    }
}

debug_log(\'Starting post.php handler\');

// Prevent direct access without parameters
if (!isset($_GET[\'u\']) || empty($_GET[\'u\'])) {
    debug_log(\'No u parameter found\');
    http_response_code(404);
    echo \'<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested resource was not found on this server.</p></body></html>\';
    exit;
}

// Load WordPress
debug_log(\'Loading WordPress...\');
if (!defined(\'ABSPATH\')) {
    try {
        require_once __DIR__ . \'/wp-load.php\';
        debug_log(\'WordPress loaded successfully\');
    } catch (Exception $e) {
        debug_log(\'Error loading WordPress: \' . $e->getMessage());
        if (URLSHORTENER_DEBUG) {
            echo \'<pre>Error loading WordPress: \' . $e->getMessage() . \'</pre>\';
        }
        exit;
    }
}

// Sanitize and decode the URL
$encoded_url = sanitize_text_field($_GET[\'u\']);
debug_log(\'Encoded URL: \' . $encoded_url);

$original_url = base64_decode($encoded_url);
debug_log(\'Decoded URL: \' . $original_url);

if (!$original_url) {
    // If decoding fails, treat as plain URL
    $original_url = sanitize_url($_GET[\'u\']);
    debug_log(\'Using plain URL: \' . $original_url);
}

if (!$original_url) {
    debug_log(\'No valid URL found, redirecting to home\');
    wp_redirect(home_url());
    exit;
}

// Create session with 2 minute expiration
debug_log(\'Creating session...\');
$session_key = \'urlshortener_\' . md5($original_url . time() . wp_create_nonce(\'urlshortener\'));
debug_log(\'Session key: \' . $session_key);

$url_data = array(
    \'original_url\' => $original_url,
    \'encoded_url\' => $encoded_url,
    \'timestamp\' => time(),
    \'expires\' => time() + (2 * 60), // 2 minutes
    \'show_ads\' => true,
    \'source\' => \'post_php_handler\',
    \'step\' => 1,
    \'session_id\' => $session_key
);
debug_log(\'URL data created: \' . json_encode($url_data));

// Store in transient for 2 minutes
$transient_result = set_transient($session_key, $url_data, 2 * 60);
debug_log(\'Transient set result: \' . ($transient_result ? \'success\' : \'failed\'));

$cookie_result = setcookie(\'urlshortener_session\', $session_key, time() + (2 * 60), \'/\', \'\', is_ssl(), true);
debug_log(\'Cookie set result: \' . ($cookie_result ? \'success\' : \'failed\'));

// Get random post for redirect
debug_log(\'Getting random post...\');
$posts = get_posts(array(
    \'numberposts\' => 1,
    \'post_status\' => \'publish\',
    \'orderby\' => \'rand\',
    \'post_type\' => \'post\'
));
debug_log(\'Found posts: \' . count($posts));

$redirect_url = !empty($posts) ? get_permalink($posts[0]->ID) : home_url();
debug_log(\'Redirect URL: \' . $redirect_url);

error_log(\'URLShortener: Session created, redirecting to: \' . $redirect_url);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carregando...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            background: #1a1a1a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
        }
        
        .loading-container {
            text-align: center;
            animation: fadeIn 0.5s ease;
        }
        
        .spinner {
            width: 80px;
            height: 80px;
            border: 4px solid #333;
            border-top: 4px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 30px;
        }
        
        .loading-text {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #007bff, #28a745);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .loading-subtitle {
            color: #888;
            font-size: 1rem;
            margin-bottom: 20px;
        }
        
        .progress-bar {
            width: 300px;
            height: 6px;
            background: #333;
            border-radius: 3px;
            overflow: hidden;
            margin: 20px auto;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #007bff, #28a745);
            border-radius: 3px;
            width: 0%;
            animation: progressFill 2s ease-out forwards;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes progressFill {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        
        @media (max-width: 768px) {
            .loading-text { font-size: 1.2rem; }
            .loading-subtitle { font-size: 0.9rem; }
            .progress-bar { width: 250px; }
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">Preparando conteúdo...</div>
        <div class="loading-subtitle">Aguarde alguns instantes</div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        
        <?php if (URLSHORTENER_DEBUG): ?>
        <div class="debug-info" style="margin-top: 30px; padding: 20px; background: #333; border-radius: 8px; font-family: monospace; font-size: 12px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
            <h3 style="color: #ffc107; margin-bottom: 10px;">🐛 Debug Info</h3>
            <div style="color: #28a745;">✅ WordPress loaded: <?php echo defined(\'ABSPATH\') ? \'Yes\' : \'No\'; ?></div>
            <div style="color: #007bff;">📝 Session key: <?php echo substr($session_key, 0, 20) . \'...\'; ?></div>
            <div style="color: #007bff;">🔗 Original URL: <?php echo esc_html($original_url); ?></div>
            <div style="color: #007bff;">📦 Encoded URL: <?php echo esc_html($encoded_url); ?></div>
            <div style="color: #28a745;">🍪 Cookie set: <?php echo $cookie_result ? \'Yes\' : \'No\'; ?></div>
            <div style="color: #28a745;">💾 Transient set: <?php echo $transient_result ? \'Yes\' : \'No\'; ?></div>
            <div style="color: #ffc107;">📄 Posts found: <?php echo count($posts); ?></div>
            <div style="color: #ffc107;">🔀 Redirect URL: <?php echo esc_html($redirect_url); ?></div>
            <div style="color: #dc3545;">⏰ Session expires: <?php echo date(\'Y-m-d H:i:s\', time() + (2 * 60)); ?></div>
        </div>
        <?php endif; ?>
    </div>
    
    <script>
        <?php if (URLSHORTENER_DEBUG): ?>
        console.log(\'URLShortener Debug: Loading page initialized\');
        console.log(\'URLShortener Debug: Session key:\', \'<?php echo substr($session_key, 0, 20); ?>...\');
        console.log(\'URLShortener Debug: Original URL:\', \'<?php echo esc_js($original_url); ?>\');
        console.log(\'URLShortener Debug: Redirect URL:\', \'<?php echo esc_js($redirect_url); ?>\');
        console.log(\'URLShortener Debug: Will redirect in 2 seconds...\');
        <?php endif; ?>
        
        // Redirect after 2 seconds
        setTimeout(function() {
            <?php if (URLSHORTENER_DEBUG): ?>
            console.log(\'URLShortener Debug: Redirecting now...\');
            <?php endif; ?>
            window.location.href = \'<?php echo esc_js($redirect_url); ?>\';
        }, 2000);
    </script>
</body>
</html>
<?php exit; ?>';
        
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