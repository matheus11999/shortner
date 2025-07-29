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
        add_action('wp_ajax_urlshortener_test_adsite', array($this, 'test_adsite'));
        add_action('wp_ajax_urlshortener_test_wordpress', array($this, 'test_wordpress_ads'));
        add_action('wp_ajax_urlshortener_check_updates', array($this, 'check_updates'));
        add_action('wp_ajax_urlshortener_download_update', array($this, 'download_and_install_update'));
        
        // Force update check on admin page load
        add_action('admin_init', array($this, 'force_update_check'));
        // Removed register_adsite functionality - using existing AdSite token"
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
            'Token do AdSite',
            array($this, 'api_token_callback'),
            'urlshortener_settings',
            'urlshortener_api_section'
        );
        
        add_settings_section(
            'urlshortener_adsite_section',
            'Configurações do AdSite',
            array($this, 'adsite_section_callback'),
            'urlshortener_settings'
        );
        
        // Removed manual name and description fields - using WordPress info automatically
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
                        <?php if (isset($settings['connected_adsite'])): ?>
                            <br><small>AdSite: <?php echo esc_html($settings['connected_adsite']['name']); ?> (<?php echo esc_html($settings['connected_adsite']['url']); ?>)</small>
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
                    
                    <button type="button" id="test-adsite" class="button button-primary" style="<?php echo ($settings['connection_status'] !== 'connected') ? 'display: none;' : ''; ?>">
                        <span class="dashicons dashicons-visibility"></span> Testar AdSite
                    </button>
                    
                    <button type="button" id="test-wordpress" class="button button-secondary" style="background: #28a745; border-color: #28a745; color: white; <?php echo ($settings['connection_status'] !== 'connected') ? 'display: none;' : ''; ?>">
                        <span class="dashicons dashicons-wordpress"></span> Testar WordPress
                    </button>
                </div>
                
                <?php if (isset($settings['last_connection_test'])): ?>
                    <p><small><strong>Último teste:</strong> <?php echo $settings['last_connection_test']; ?></small></p>
                <?php endif; ?>
                
                <?php if ($settings['connection_status'] === 'connected'): ?>
                    <div class="notice notice-success inline" style="margin-top: 15px;">
                        <p><strong>✅ Plugin conectado com sucesso!</strong></p>
                        <p>O AdSite já está configurado no sistema. Você pode agora:</p>
                        <ul>
                            <li>📊 Visualizar banner configs no painel administrativo</li>
                            <li>🎯 Configurar anúncios específicos para este AdSite</li>
                            <li>📈 Acompanhar métricas de conversão</li>
                            <li>🧪 Testar o sistema de anúncios</li>
                        </ul>
                        
                        <div id="test-result" style="margin-top: 15px; display: none;"></div>
                    </div>
                <?php else: ?>
                    <div class="notice notice-warning inline">
                        <p><strong>Atenção:</strong> Configure a URL da API e Token do AdSite para conectar.</p>
                        <p><strong>Como obter o Token:</strong></p>
                        <ol>
                            <li>Acesse o painel administrativo do URL Shortener</li>
                            <li>Vá para "AdSites" → "Gerenciar AdSites"</li>
                            <li>Copie o token do AdSite desejado</li>
                            <li>Cole aqui no campo "Token do AdSite"</li>
                        </ol>
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
                <h3>Sistema de Atualizações Automáticas</h3>
                <p>O plugin é atualizado automaticamente quando novas versões estão disponíveis.</p>
                <p><strong>Versão atual:</strong> <?php echo URLSHORTENER_VERSION; ?></p>
                <p><strong>Recursos:</strong></p>
                <ul>
                    <li>✅ Atualizações automáticas via WordPress</li>
                    <li>✅ Posts simulados otimizados</li>
                    <li>✅ Sistema de teste integrado</li>
                    <li>✅ Status de conexão em tempo real</li>
                </ul>
                
                <div style="margin-top: 15px;">
                    <button type="button" id="check-updates" class="button button-secondary">
                        <span class="dashicons dashicons-update"></span> Verificar Atualizações
                    </button>
                </div>
            </div>
        </div>
        <?php
    }
    
    public function api_section_callback() {
        echo '<p>Configure a URL da API e o token para conectar com o sistema URL Shortener.</p>';
    }
    
    public function adsite_section_callback() {
        echo '<p><strong>Informações automáticas do WordPress:</strong></p>';
        echo '<p><strong>Nome:</strong> ' . esc_html(get_bloginfo('name')) . '</p>';
        echo '<p><strong>URL:</strong> ' . esc_html(home_url()) . '</p>';
        echo '<p><strong>Descrição:</strong> ' . esc_html(get_bloginfo('description')) . '</p>';
        echo '<p><em>Essas informações serão usadas automaticamente para registrar o AdSite.</em></p>';
    }
    
    public function api_url_callback() {
        $settings = get_option('urlshortener_settings');
        echo '<input type="url" id="api_url" name="urlshortener_settings[api_url]" value="' . esc_attr($settings['api_url']) . '" class="regular-text" placeholder="https://api.exemplo.com" />';
        echo '<p class="description">URL base da API do sistema URL Shortener</p>';
    }
    
    public function api_token_callback() {
        $settings = get_option('urlshortener_settings');
        echo '<input type="password" id="api_token" name="urlshortener_settings[api_token]" value="' . esc_attr($settings['api_token']) . '" class="regular-text" />';
        echo '<p class="description">Token do AdSite (não é o token de usuário admin). Copie o token do AdSite criado no painel administrativo.</p>';
    }
    
    // Removed manual input fields - using WordPress info automatically
    
    public function validate_settings($input) {
        $validated = array();
        
        $validated['api_url'] = esc_url_raw($input['api_url']);
        $validated['api_token'] = sanitize_text_field($input['api_token']);
        // Using WordPress info automatically
        $validated['adsite_name'] = get_bloginfo('name');
        $validated['description'] = get_bloginfo('description');
        
        // Manter outros valores
        $current_settings = get_option('urlshortener_settings');
        $validated['connection_status'] = $current_settings['connection_status'];
        
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
            
            // Salvar dados do AdSite se disponíveis
            if (isset($result['adsite_data'])) {
                $settings['connected_adsite'] = $result['adsite_data'];
            }
            
            // Force create post.php file when connected
            if (class_exists('URLShortener_Frontend')) {
                $frontend = URLShortener_Frontend::get_instance();
                $frontend->create_post_php_handler();
            }
        } else {
            // Clear connected adsite if connection failed
            unset($settings['connected_adsite']);
        }
        
        update_option('urlshortener_settings', $settings);
        
        wp_send_json($result);
    }
    
    public function test_adsite() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die();
        }
        
        $settings = get_option('urlshortener_settings');
        
        // Re-check connection if needed
        if ($settings['connection_status'] !== 'connected' || !isset($settings['connected_adsite'])) {
            // Try to reconnect
            if (!empty($settings['api_url']) && !empty($settings['api_token'])) {
                $api = URLShortener_API::get_instance();
                $result = $api->test_connection($settings['api_url'], $settings['api_token']);
                
                if ($result['success'] && isset($result['adsite_data'])) {
                    $settings['connection_status'] = 'connected';
                    $settings['connected_adsite'] = $result['adsite_data'];
                    update_option('urlshortener_settings', $settings);
                } else {
                    wp_send_json_error('AdSite não conectado. Verifique suas credenciais.');
                    return;
                }
            } else {
                wp_send_json_error('AdSite não conectado. Configure API URL e Token primeiro.');
                return;
            }
        }
        
        $adsite = $settings['connected_adsite'];
        $test_url = 'https://google.com';
        
        // Criar URL de teste
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $encoded_target = base64_encode($test_url);
        $test_adsite_url = $api_url . '/test-adsite/' . $adsite['id'] . '?target=' . $encoded_target;
        
        wp_send_json_success(array(
            'test_url' => $test_adsite_url,
            'adsite_name' => $adsite['name'],
            'adsite_id' => $adsite['id']
        ));
    }
    
    public function test_wordpress_ads() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die();
        }
        
        // Force create post.php file
        if (class_exists('URLShortener_Frontend')) {
            $frontend = URLShortener_Frontend::get_instance();
            $frontend->create_post_php_handler();
            
            // Generate test URL with Google as target
            $test_url = $frontend->generate_test_url('https://google.com');
            
            wp_send_json_success(array(
                'test_url' => $test_url,
                'message' => 'URL de teste do WordPress gerada'
            ));
        } else {
            wp_send_json_error('Sistema frontend não disponível');
        }
    }
    
    public function force_update_check() {
        // Only on our settings page
        if (isset($_GET['page']) && $_GET['page'] === 'urlshortener-settings') {
            // Force a plugin update check
            delete_transient('urlshortener_update_check');
            wp_update_plugins();
            
            // Also ensure post.php file is created
            if (class_exists('URLShortener_Frontend')) {
                $frontend = URLShortener_Frontend::get_instance();
                $frontend->create_post_php_handler();
            }
        }
    }
    
    public function check_updates() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die();
        }
        
        // Force clear update cache and check for new version
        delete_transient('urlshortener_update_check');
        delete_transient('update_plugins');
        
        // Get current and remote versions
        $current_version = URLSHORTENER_VERSION;
        $settings = get_option('urlshortener_settings');
        
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            wp_send_json_error('Configurações da API não encontradas');
            return;
        }
        
        // Check remote version
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $response = wp_remote_get($api_url . '/api/admin/wordpress-plugin-version', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('Erro ao verificar versão: ' . $response->get_error_message());
            return;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!isset($data['version'])) {
            wp_send_json_error('Resposta inválida do servidor');
            return;
        }
        
        $remote_version = $data['version'];
        $update_available = version_compare($current_version, $remote_version, '<');
        
        if ($update_available) {
            wp_send_json_success(array(
                'update_available' => true,
                'current_version' => $current_version,
                'new_version' => $remote_version,
                'download_url' => $api_url . '/api/admin/wordpress-plugin-download',
                'message' => 'Nova versão ' . $remote_version . ' disponível! (atual: ' . $current_version . ')'
            ));
        } else {
            wp_send_json_success(array(
                'update_available' => false,
                'current_version' => $current_version,
                'message' => 'Plugin já está na versão mais recente (' . $current_version . ')'
            ));
        }
    }
    
    public function download_and_install_update() {
        check_ajax_referer('urlshortener_admin_nonce', 'nonce');
        
        if (!current_user_can('update_plugins')) {
            wp_send_json_error('Permissões insuficientes');
            return;
        }
        
        $settings = get_option('urlshortener_settings');
        
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            wp_send_json_error('Configurações da API não encontradas');
            return;
        }
        
        // Get download URL
        $api_url = rtrim($settings['api_url'], '/');
        if (substr($api_url, -4) === '/api') {
            $api_url = substr($api_url, 0, -4);
        }
        
        $download_url = $api_url . '/api/admin/wordpress-plugin-download';
        
        // Download the plugin
        $response = wp_remote_get($download_url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 60
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('Erro ao baixar atualização: ' . $response->get_error_message());
            return;
        }
        
        $plugin_data = wp_remote_retrieve_body($response);
        
        if (empty($plugin_data)) {
            wp_send_json_error('Arquivo de atualização vazio');
            return;
        }
        
        // Save to temp file
        $temp_file = wp_tempnam('urlshortener-update');
        file_put_contents($temp_file, $plugin_data);
        
        // Install the update
        include_once(ABSPATH . 'wp-admin/includes/class-wp-upgrader.php');
        include_once(ABSPATH . 'wp-admin/includes/plugin-install.php');
        
        $upgrader = new Plugin_Upgrader();
        $result = $upgrader->install($temp_file, array(
            'overwrite_package' => true
        ));
        
        // Clean up temp file
        unlink($temp_file);
        
        if (is_wp_error($result)) {
            wp_send_json_error('Erro na instalação: ' . $result->get_error_message());
            return;
        }
        
        if ($result === true) {
            wp_send_json_success(array(
                'message' => 'Plugin atualizado com sucesso!',
                'new_version' => 'Atualizado'
            ));
        } else {
            wp_send_json_error('Falha na instalação da atualização');
        }
    }
    
}