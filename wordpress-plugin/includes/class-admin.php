<?php

if (!defined('ABSPATH')) {
    exit;
}

class URLShortener_Admin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'init_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_ajax_urlshortener_test_connection', array($this, 'test_connection'));
        add_action('wp_ajax_urlshortener_sync_posts', array($this, 'manual_sync'));
    }
    
    public function add_admin_menu() {
        add_options_page(
            'URL Shortener AdSite',
            'URL Shortener',
            'manage_options',
            'urlshortener-settings',
            array($this, 'settings_page')
        );
    }
    
    public function init_settings() {
        register_setting('urlshortener_settings', 'urlshortener_settings', array($this, 'validate_settings'));
        
        add_settings_section(
            'urlshortener_api_section',
            'Configurações da API',
            array($this, 'api_section_callback'),
            'urlshortener_settings'
        );
        
        add_settings_field(
            'api_url',
            'URL da API',
            array($this, 'api_url_callback'),
            'urlshortener_settings',
            'urlshortener_api_section'
        );
        
        add_settings_field(
            'api_token',
            'Token da API',
            array($this, 'api_token_callback'),
            'urlshortener_settings',
            'urlshortener_api_section'
        );
        
        add_settings_section(
            'urlshortener_sync_section',
            'Configurações de Sincronização',
            array($this, 'sync_section_callback'),
            'urlshortener_settings'
        );
        
        add_settings_field(
            'auto_sync',
            'Sincronização Automática',
            array($this, 'auto_sync_callback'),
            'urlshortener_settings',
            'urlshortener_sync_section'
        );
        
        add_settings_field(
            'sync_interval',
            'Intervalo de Sincronização (minutos)',
            array($this, 'sync_interval_callback'),
            'urlshortener_settings',
            'urlshortener_sync_section'
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if ('settings_page_urlshortener-settings' !== $hook) {
            return;
        }
        
        wp_enqueue_script(
            'urlshortener-admin',
            URLSHORTENER_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            URLSHORTENER_VERSION,
            true
        );
        
        wp_enqueue_style(
            'urlshortener-admin',
            URLSHORTENER_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            URLSHORTENER_VERSION
        );
        
        wp_localize_script('urlshortener-admin', 'urlshortener_admin_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('urlshortener_admin_nonce')
        ));
    }
    
    public function settings_page() {
        $settings = get_option('urlshortener_settings');
        ?>
        <div class="wrap">
            <h1>URL Shortener AdSite - Configurações</h1>
            
            <div class="urlshortener-status-card">
                <h3>Status da Conexão</h3>
                <div id="connection-status" class="connection-status <?php echo $settings['connection_status']; ?>">
                    <?php if ($settings['connection_status'] === 'connected'): ?>
                        <span class="dashicons dashicons-yes-alt"></span> 
                        <strong>Conectado</strong>
                        <?php if (isset($settings['connected_user'])): ?>
                            <br><small>Usuário: <?php echo esc_html($settings['connected_user']['name']); ?> (<?php echo esc_html($settings['connected_user']['email']); ?>)</small>
                        <?php endif; ?>
                    <?php else: ?>
                        <span class="dashicons dashicons-dismiss"></span> 
                        <strong>Desconectado</strong>
                        <br><small>Configure a URL da API e Token para conectar</small>
                    <?php endif; ?>
                </div>
                
                <div style="margin: 15px 0;">
                    <button type="button" id="test-connection" class="button button-secondary">
                        <span class="dashicons dashicons-update"></span> Testar Conexão
                    </button>
                    
                    <button type="button" id="refresh-status" class="button button-secondary">
                        <span class="dashicons dashicons-admin-generic"></span> Atualizar Status
                    </button>
                </div>
                
                <?php if (isset($settings['last_connection_test'])): ?>
                    <p><small><strong>Último teste:</strong> <?php echo $settings['last_connection_test']; ?></small></p>
                <?php endif; ?>
                
                <?php if ($settings['connection_status'] === 'connected'): ?>
                    <hr style="margin: 20px 0;">
                    <h4>Sincronização de Posts</h4>
                    
                    <?php if ($settings['last_sync']): ?>
                        <p><strong>Última sincronização:</strong> <?php echo $settings['last_sync']; ?></p>
                    <?php endif; ?>
                    
                    <button type="button" id="manual-sync" class="button button-secondary">
                        <span class="dashicons dashicons-update"></span> Sincronizar Posts Agora
                    </button>
                    
                    <div id="sync-status" style="margin-top: 10px;"></div>
                <?php else: ?>
                    <div class="notice notice-warning inline">
                        <p><strong>Atenção:</strong> Conecte-se à API para habilitar a sincronização de posts.</p>
                    </div>
                <?php endif; ?>
            </div>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('urlshortener_settings');
                do_settings_sections('urlshortener_settings');
                submit_button();
                ?>
            </form>
            
            <div class="urlshortener-info-card">
                <h3>Logs de Sincronização</h3>
                <div id="sync-logs">
                    <?php $this->display_sync_logs(); ?>
                </div>
            </div>
        </div>
        <?php
    }
    
    public function api_section_callback() {
        echo '<p>Configure a URL da API e o token para conectar com o sistema URL Shortener.</p>';
    }
    
    public function sync_section_callback() {
        echo '<p>Configure como os posts serão sincronizados com o sistema URL Shortener.</p>';
    }
    
    public function api_url_callback() {
        $settings = get_option('urlshortener_settings');
        echo '<input type="url" id="api_url" name="urlshortener_settings[api_url]" value="' . esc_attr($settings['api_url']) . '" class="regular-text" placeholder="https://api.exemplo.com" />';
        echo '<p class="description">URL base da API do sistema URL Shortener</p>';
    }
    
    public function api_token_callback() {
        $settings = get_option('urlshortener_settings');
        echo '<input type="password" id="api_token" name="urlshortener_settings[api_token]" value="' . esc_attr($settings['api_token']) . '" class="regular-text" />';
        echo '<p class="description">Token de autenticação fornecido pelo sistema URL Shortener</p>';
    }
    
    public function auto_sync_callback() {
        $settings = get_option('urlshortener_settings');
        $checked = $settings['auto_sync'] ? 'checked' : '';
        echo '<input type="checkbox" id="auto_sync" name="urlshortener_settings[auto_sync]" value="1" ' . $checked . ' />';
        echo '<label for="auto_sync">Ativar sincronização automática de posts</label>';
    }
    
    public function sync_interval_callback() {
        $settings = get_option('urlshortener_settings');
        echo '<input type="number" id="sync_interval" name="urlshortener_settings[sync_interval]" value="' . esc_attr($settings['sync_interval']) . '" min="5" max="1440" />';
        echo '<p class="description">Intervalo em minutos para sincronização automática (5-1440 minutos)</p>';
    }
    
    public function validate_settings($input) {
        $validated = array();
        
        $validated['api_url'] = esc_url_raw($input['api_url']);
        $validated['api_token'] = sanitize_text_field($input['api_token']);
        $validated['auto_sync'] = isset($input['auto_sync']) ? 1 : 0;
        $validated['sync_interval'] = intval($input['sync_interval']);
        
        if ($validated['sync_interval'] < 5) {
            $validated['sync_interval'] = 5;
        }
        if ($validated['sync_interval'] > 1440) {
            $validated['sync_interval'] = 1440;
        }
        
        // Manter outros valores
        $current_settings = get_option('urlshortener_settings');
        $validated['connection_status'] = $current_settings['connection_status'];
        $validated['last_sync'] = $current_settings['last_sync'];
        
        return $validated;
    }
    
    public function test_connection() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die();
        }
        
        $api_url = sanitize_text_field($_POST['api_url']);
        $api_token = sanitize_text_field($_POST['api_token']);
        
        $api = URLShortener_API::get_instance();
        $result = $api->test_connection($api_url, $api_token);
        
        // Atualizar configurações com base no resultado
        $settings = get_option('urlshortener_settings');
        $settings['connection_status'] = $result['success'] ? 'connected' : 'disconnected';
        $settings['last_connection_test'] = current_time('mysql');
        
        if ($result['success']) {
            // Se conectou com sucesso, salvar a URL e token se fornecidos
            if (!empty($api_url) && !empty($api_token)) {
                $settings['api_url'] = $api_url;
                $settings['api_token'] = $api_token;
            }
            
            // Salvar dados do usuário se disponíveis
            if (isset($result['user_data'])) {
                $settings['connected_user'] = $result['user_data'];
            }
        }
        
        update_option('urlshortener_settings', $settings);
        
        wp_send_json($result);
    }
    
    public function manual_sync() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die();
        }
        
        $posts_sync = URLShortener_Posts_Sync::get_instance();
        $result = $posts_sync->sync_posts();
        
        wp_send_json($result);
    }
    
    private function display_sync_logs() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'urlshortener_logs';
        $logs = $wpdb->get_results(
            "SELECT * FROM $table_name ORDER BY created_at DESC LIMIT 10"
        );
        
        if (empty($logs)) {
            echo '<p>Nenhum log encontrado.</p>';
            return;
        }
        
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Data</th><th>Post ID</th><th>Ação</th><th>Status</th><th>Mensagem</th></tr></thead>';
        echo '<tbody>';
        
        foreach ($logs as $log) {
            $status_class = $log->status === 'success' ? 'success' : 'error';
            echo '<tr>';
            echo '<td>' . esc_html($log->created_at) . '</td>';
            echo '<td>' . esc_html($log->post_id) . '</td>';
            echo '<td>' . esc_html($log->action) . '</td>';
            echo '<td><span class="status-' . $status_class . '">' . esc_html($log->status) . '</span></td>';
            echo '<td>' . esc_html($log->message) . '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table>';
    }
}