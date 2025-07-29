<?php
/**
 * Plugin Name: URL Shortener AdSite
 * Plugin URI: https://your-domain.com/
 * Description: Plugin para integração com sistema de URL shortener com anúncios
 * Version: 1.7.0
 * Author: Your Name
 * License: GPL2
 */

// Evitar acesso direto
if (!defined('ABSPATH')) {
    exit;
}

// Definir constantes
define('URLSHORTENER_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('URLSHORTENER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('URLSHORTENER_VERSION', '1.7.0');

// Incluir arquivos necessários
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-admin.php';
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-api.php';
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-updater.php';
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-frontend.php';
// Post sync removido - sistema agora usa posts simulados

class URLShortenerAdSite {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Initialize updater
        if (is_admin()) {
            new URLShortener_Updater(__FILE__, URLSHORTENER_VERSION);
        }
    }
    
    public function init() {
        // Inicializar admin
        if (is_admin()) {
            URLShortener_Admin::get_instance();
        }
        
        // Inicializar API
        URLShortener_API::get_instance();
        
        // Inicializar Frontend
        URLShortener_Frontend::get_instance();
        
        // Post sync removido - sistema agora usa posts simulados automaticamente
        
        // Adicionar actions e filters
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_head', array($this, 'add_meta_tags'));
    }
    
    public function activate() {
        // Criar tabelas necessárias
        $this->create_tables();
        
        // Definir configurações padrão
        $default_options = array(
            'api_url' => '',
            'api_token' => '',
            'connection_status' => 'disconnected',
            'adsite_name' => get_bloginfo('name'),
            'description' => get_bloginfo('description')
        );
        
        add_option('urlshortener_settings', $default_options);
        
        // Force create post.php file immediately
        if (class_exists('URLShortener_Frontend')) {
            $frontend = URLShortener_Frontend::get_instance();
            $frontend->create_post_php_handler();
        } else {
            // Create it manually if class not loaded yet
            $this->create_post_php_file_manual();
        }
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        // Plugin desativado - configurações mantidas
    }
    
    private function create_tables() {
        global $wpdb;
        
        // Tabelas removidas - sistema agora usa posts simulados
        // Não há necessidade de armazenar logs de sincronização
    }
    
    private function create_post_php_file_manual() {
        $post_php_path = ABSPATH . 'post.php';
        
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

// Sanitize and decode the URL
\$encoded_url = sanitize_text_field(\$_GET['u']);
\$short_url = base64_decode(\$encoded_url);

if (!\$short_url) {
    wp_redirect(home_url());
    exit;
}

error_log('URLShortener: Processing URL: ' . \$short_url);

// Store URL data for ads display
\$session_key = 'urlshortener_' . md5(\$short_url . time());
\$url_data = array(
    'original_url' => \$short_url,
    'encoded_url' => \$encoded_url,
    'timestamp' => time(),
    'show_ads' => true
);

set_transient(\$session_key, \$url_data, HOUR_IN_SECONDS);
setcookie('urlshortener_session', \$session_key, time() + HOUR_IN_SECONDS, '/', '', is_ssl(), true);

// Generate ads page directly instead of redirecting
\$frontend_class = 'URLShortener_Frontend';
if (class_exists(\$frontend_class)) {
    \$frontend = call_user_func(array(\$frontend_class, 'get_instance'));
    \$ads_html = \$frontend->generate_ads_page_direct(\$url_data);
    
    // Output the ads page
    echo \$ads_html;
    exit;
} else {
    // Fallback: redirect to home if class not available
    error_log('URLShortener: Frontend class not available');
    wp_redirect(home_url());
    exit;
}
?>
";
        
        file_put_contents($post_php_path, $post_php_content);
        chmod($post_php_path, 0644);
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script(
            'urlshortener-frontend',
            URLSHORTENER_PLUGIN_URL . 'assets/js/frontend.js',
            array('jquery'),
            URLSHORTENER_VERSION,
            true
        );
        
        wp_localize_script('urlshortener-frontend', 'urlshortener_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('urlshortener_nonce')
        ));
    }
    
    public function add_meta_tags() {
        $settings = get_option('urlshortener_settings');
        if ($settings['connection_status'] === 'connected') {
            echo '<meta name="urlshortener-adsite" content="active">';
        }
    }
}

// Inicializar plugin
URLShortenerAdSite::get_instance();