<?php

if (!defined('ABSPATH')) {
    exit;
}

class URLShortener_API {
    
    private static $instance = null;
    private $api_url;
    private $api_token;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $settings = get_option('urlshortener_settings');
        $this->api_url = $settings['api_url'];
        $this->api_token = $settings['api_token'];
    }
    
    /**
     * Normalize API URL to avoid duplicate /api paths
     */
    private function normalize_url($url) {
        $url = rtrim($url, '/');
        
        // Remove /api suffix if present to avoid duplication
        if (substr($url, -4) === '/api') {
            $url = substr($url, 0, -4);
        }
        
        return $url;
    }
    
    public function test_connection($api_url = null, $api_token = null) {
        $url = $api_url ?: $this->api_url;
        $token = $api_token ?: $this->api_token;
        
        if (empty($url) || empty($token)) {
            return array(
                'success' => false,
                'message' => 'URL da API e token são obrigatórios'
            );
        }

        // Limpar URL
        $url = rtrim($url, '/');
        
        // Normalizar URL para evitar duplicação de /api
        $normalized_url = $this->normalize_url($url);
        
        // Testar endpoint de autenticação específico para WordPress Plugin
        $response = wp_remote_get($normalized_url . '/api/auth/me-api', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'X-API-Token' => $token,
                'Content-Type' => 'application/json'
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => 'Erro de conexão: ' . $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 200) {
            $data = json_decode($body, true);
            if ($data && isset($data['role']) && $data['role'] === 'admin') {
                return array(
                    'success' => true,
                    'message' => 'Conexão estabelecida com sucesso! Usuário: ' . $data['name'],
                    'user_data' => $data
                );
            } else {
                return array(
                    'success' => false,
                    'message' => 'Token válido mas usuário não é administrador'
                );
            }
        } else if ($status_code === 401) {
            return array(
                'success' => false,
                'message' => 'Token de autenticação inválido'
            );
        } else {
            return array(
                'success' => false,
                'message' => 'Erro do servidor: HTTP ' . $status_code
            );
        }
    }
    
    public function register_adsite($data) {
        if (empty($this->api_url) || empty($this->api_token)) {
            return array(
                'success' => false,
                'message' => 'API não configurada'
            );
        }
        
        $normalized_url = $this->normalize_url($this->api_url);
        
        $response = wp_remote_post($normalized_url . '/api/admin/wordpress/adsites', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->api_token,
                'X-API-Token' => $this->api_token,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode($data),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => 'Erro de conexão: ' . $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        if ($status_code === 201) {
            return array(
                'success' => true,
                'message' => 'AdSite registrado com sucesso!',
                'data' => $result
            );
        } else {
            return array(
                'success' => false,
                'message' => 'Erro ao registrar AdSite: ' . ($result['error'] ?? 'Erro desconhecido')
            );
        }
    }
    
    public function get_banner_configs($adsite_id) {
        if (empty($this->api_url) || empty($this->api_token)) {
            return array('success' => false, 'message' => 'API não configurada');
        }
        
        $normalized_url = $this->normalize_url($this->api_url);
        
        $response = wp_remote_get($normalized_url . '/api/admin/wordpress/banner-configs/' . $adsite_id, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->api_token,
                'X-API-Token' => $this->api_token,
                'Content-Type' => 'application/json'
            )
        ));
        
        if (is_wp_error($response)) {
            return array('success' => false, 'message' => $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return array('success' => true, 'data' => $data);
    }
    
    
    public function get_connection_status() {
        if (empty($this->api_url) || empty($this->api_token)) {
            return array(
                'connected' => false,
                'status' => 'disconnected',
                'message' => 'Configurações não definidas'
            );
        }
        
        $test_result = $this->test_connection();
        
        return array(
            'connected' => $test_result['success'],
            'status' => $test_result['success'] ? 'connected' : 'disconnected',
            'message' => $test_result['message'],
            'user_data' => isset($test_result['user_data']) ? $test_result['user_data'] : null
        );
    }
    
    public function update_settings() {
        $settings = get_option('urlshortener_settings');
        $this->api_url = $settings['api_url'];
        $this->api_token = $settings['api_token'];
    }
}