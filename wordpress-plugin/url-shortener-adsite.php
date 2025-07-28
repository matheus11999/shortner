<?php
/**
 * Plugin Name: URL Shortener AdSite
 * Plugin URI: https://your-domain.com/
 * Description: Plugin para integração com sistema de URL shortener com anúncios
 * Version: 1.0.0
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
define('URLSHORTENER_VERSION', '1.0.0');

// Incluir arquivos necessários
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-admin.php';
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-api.php';
require_once URLSHORTENER_PLUGIN_PATH . 'includes/class-posts-sync.php';

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
    }
    
    public function init() {
        // Inicializar admin
        if (is_admin()) {
            URLShortener_Admin::get_instance();
        }
        
        // Inicializar API
        URLShortener_API::get_instance();
        
        // Inicializar sincronização de posts
        URLShortener_Posts_Sync::get_instance();
        
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
            'last_sync' => '',
            'auto_sync' => true,
            'sync_interval' => 60 // minutos
        );
        
        add_option('urlshortener_settings', $default_options);
        
        // Agendar sincronização automática
        if (!wp_next_scheduled('urlshortener_auto_sync')) {
            wp_schedule_event(time(), 'hourly', 'urlshortener_auto_sync');
        }
    }
    
    public function deactivate() {
        // Remover agendamentos
        wp_clear_scheduled_hook('urlshortener_auto_sync');
    }
    
    private function create_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'urlshortener_logs';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            post_id bigint(20) NOT NULL,
            action varchar(50) NOT NULL,
            status varchar(20) NOT NULL,
            message text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
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