<?php

if (!defined('ABSPATH')) {
    exit;
}

class URLShortener_Updater {
    
    private $plugin_file;
    private $current_version;
    private $plugin_slug;
    private $api_url;
    
    public function __construct($plugin_file, $current_version) {
        $this->plugin_file = $plugin_file;
        $this->current_version = $current_version;
        $this->plugin_slug = plugin_basename($plugin_file);
        $this->api_url = 'https://evoapi-backend-url.ttvjwi.easypanel.host/api';
        
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_update'));
        add_filter('plugins_api', array($this, 'plugin_info'), 20, 3);
        add_filter('upgrader_pre_download', array($this, 'upgrader_pre_download'), 10, 3);
        add_action('upgrader_process_complete', array($this, 'upgrader_process_complete'), 10, 2);
    }
    
    public function check_for_update($transient) {
        if (empty($transient->checked)) {
            return $transient;
        }
        
        $remote_version = $this->get_remote_version();
        
        if ($remote_version && version_compare($this->current_version, $remote_version, '<')) {
            $transient->response[$this->plugin_slug] = (object) array(
                'slug' => $this->plugin_slug,
                'new_version' => $remote_version,
                'url' => $this->api_url,
                'package' => $this->api_url . '/admin/wordpress-plugin-download'
            );
        }
        
        return $transient;
    }
    
    public function plugin_info($result, $action, $args) {
        if ($action !== 'plugin_information' || $args->slug !== $this->plugin_slug) {
            return $result;
        }
        
        $remote_version = $this->get_remote_version();
        
        return (object) array(
            'name' => 'URL Shortener AdSite',
            'slug' => $this->plugin_slug,
            'version' => $remote_version,
            'author' => 'URL Shortener System',
            'homepage' => $this->api_url,
            'short_description' => 'Plugin para integração com sistema de URL shortener com anúncios',
            'sections' => array(
                'description' => 'Plugin atualizado automaticamente do sistema URL Shortener.',
                'changelog' => $this->get_changelog()
            ),
            'download_link' => $this->api_url . '/admin/wordpress-plugin-download'
        );
    }
    
    public function upgrader_pre_download($result, $package, $upgrader) {
        if (strpos($package, $this->api_url) !== false) {
            // Use o sistema de download existente
            return $this->download_plugin($package);
        }
        
        return $result;
    }
    
    public function upgrader_process_complete($upgrader, $options) {
        if ($options['action'] === 'update' && $options['type'] === 'plugin') {
            if (isset($options['plugins']) && in_array($this->plugin_slug, $options['plugins'])) {
                // Plugin foi atualizado com sucesso
                delete_transient('urlshortener_update_check');
                
                // Limpar cache de configurações
                $settings = get_option('urlshortener_settings');
                if ($settings) {
                    $settings['last_update'] = current_time('mysql');
                    update_option('urlshortener_settings', $settings);
                }
            }
        }
    }
    
    private function get_remote_version() {
        $cached = get_transient('urlshortener_update_check');
        if ($cached !== false) {
            return $cached;
        }
        
        $settings = get_option('urlshortener_settings');
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            return false;
        }
        
        $response = wp_remote_get($settings['api_url'] . '/admin/wordpress-plugin-version', array(
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
        
        if (isset($data['version'])) {
            set_transient('urlshortener_update_check', $data['version'], 12 * HOUR_IN_SECONDS);
            return $data['version'];
        }
        
        return false;
    }
    
    private function get_changelog() {
        $settings = get_option('urlshortener_settings');
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            return 'Atualizações automáticas disponíveis.';
        }
        
        $response = wp_remote_get($settings['api_url'] . '/admin/wordpress-plugin-changelog', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return 'Erro ao obter changelog.';
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return isset($data['changelog']) ? $data['changelog'] : 'Melhorias e correções.';
    }
    
    private function download_plugin($package) {
        $settings = get_option('urlshortener_settings');
        if (empty($settings['api_url']) || empty($settings['api_token'])) {
            return new WP_Error('no_credentials', 'API credentials not configured');
        }
        
        $response = wp_remote_get($package, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['api_token'],
                'X-API-Token' => $settings['api_token']
            ),
            'timeout' => 300
        ));
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $body = wp_remote_retrieve_body($response);
        
        if (empty($body)) {
            return new WP_Error('empty_response', 'Empty response from server');
        }
        
        // Salvar o arquivo temporariamente
        $temp_file = wp_tempnam('urlshortener-update');
        file_put_contents($temp_file, $body);
        
        return $temp_file;
    }
    
    public static function manual_check_update() {
        delete_transient('urlshortener_update_check');
        wp_update_plugins();
        
        return array(
            'success' => true,
            'message' => 'Verificação de atualização realizada'
        );
    }
}