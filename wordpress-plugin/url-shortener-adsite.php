<?php
/**
 * Plugin Name: URL Shortener AdSite
 * Plugin URI: https://your-domain.com/
 * Description: Plugin para integração com sistema de URL shortener com anúncios
 * Version: 1.4.0
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
define('URLSHORTENER_VERSION', '1.4.0');

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
    }
    
    public function deactivate() {
        // Plugin desativado - configurações mantidas
    }
    
    private function create_tables() {
        global $wpdb;
        
        // Tabelas removidas - sistema agora usa posts simulados
        // Não há necessidade de armazenar logs de sincronização
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