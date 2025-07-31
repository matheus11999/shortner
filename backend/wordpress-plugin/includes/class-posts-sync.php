<?php

if (!defined('ABSPATH')) {
    exit;
}

class URLShortener_Posts_Sync {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('urlshortener_auto_sync', array($this, 'auto_sync_posts'));
        add_action('save_post', array($this, 'sync_single_post'), 10, 3);
        add_action('delete_post', array($this, 'delete_post_from_cache'));
    }
    
    public function sync_posts() {
        $settings = get_option('urlshortener_settings');
        
        if ($settings['connection_status'] !== 'connected') {
            return array(
                'success' => false,
                'message' => 'Plugin não conectado à API'
            );
        }
        
        try {
            $posts = $this->get_posts_for_sync();
            
            if (empty($posts)) {
                return array(
                    'success' => true,
                    'message' => 'Nenhum post para sincronizar'
                );
            }
            
            $api = URLShortener_API::get_instance();
            $result = $api->sync_posts($posts);
            
            if ($result['success']) {
                $settings['last_sync'] = current_time('mysql');
                update_option('urlshortener_settings', $settings);
                
                $this->log_sync('bulk_sync', 0, 'success', 'Sincronizados ' . count($posts) . ' posts');
            } else {
                $this->log_sync('bulk_sync', 0, 'error', $result['message']);
            }
            
            return $result;
            
        } catch (Exception $e) {
            $this->log_sync('bulk_sync', 0, 'error', $e->getMessage());
            return array(
                'success' => false,
                'message' => 'Erro interno: ' . $e->getMessage()
            );
        }
    }
    
    public function auto_sync_posts() {
        $settings = get_option('urlshortener_settings');
        
        if (!$settings['auto_sync'] || $settings['connection_status'] !== 'connected') {
            return;
        }
        
        $this->sync_posts();
    }
    
    public function sync_single_post($post_id, $post, $update) {
        // Só sincronizar posts publicados
        if ($post->post_status !== 'publish' || $post->post_type !== 'post') {
            return;
        }
        
        $settings = get_option('urlshortener_settings');
        if ($settings['connection_status'] !== 'connected') {
            return;
        }
        
        try {
            $post_data = $this->prepare_post_data($post);
            $api = URLShortener_API::get_instance();
            $result = $api->sync_posts(array($post_data));
            
            if ($result['success']) {
                $this->log_sync('single_sync', $post_id, 'success', 'Post sincronizado');
            } else {
                $this->log_sync('single_sync', $post_id, 'error', $result['message']);
            }
            
        } catch (Exception $e) {
            $this->log_sync('single_sync', $post_id, 'error', $e->getMessage());
        }
    }
    
    public function delete_post_from_cache($post_id) {
        $settings = get_option('urlshortener_settings');
        if ($settings['connection_status'] !== 'connected') {
            return;
        }
        
        $api = URLShortener_API::get_instance();
        // Implementar chamada para deletar post do cache
        // $api->delete_post_cache($post_id);
    }
    
    private function get_posts_for_sync() {
        $posts = get_posts(array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'numberposts' => 50, // Limitar para evitar timeout
            'orderby' => 'modified',
            'order' => 'DESC'
        ));
        
        $posts_data = array();
        foreach ($posts as $post) {
            $posts_data[] = $this->prepare_post_data($post);
        }
        
        return $posts_data;
    }
    
    private function prepare_post_data($post) {
        $content = $post->post_content;
        
        // Remover shortcodes para o cache
        $content = strip_shortcodes($content);
        
        // Aplicar filtros do WordPress
        $content = apply_filters('the_content', $content);
        
        // Limpar HTML desnecessário
        $content = wp_strip_all_tags($content, true);
        
        return array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $content,
            'excerpt' => $post->post_excerpt ?: wp_trim_words($content, 50),
            'url' => get_permalink($post->ID),
            'date' => $post->post_date,
            'modified' => $post->post_modified,
            'author' => get_the_author_meta('display_name', $post->post_author),
            'categories' => $this->get_post_categories($post->ID),
            'tags' => $this->get_post_tags($post->ID),
            'featured_image' => get_the_post_thumbnail_url($post->ID, 'medium')
        );
    }
    
    private function get_post_categories($post_id) {
        $categories = get_the_category($post_id);
        return array_map(function($cat) {
            return $cat->name;
        }, $categories);
    }
    
    private function get_post_tags($post_id) {
        $tags = get_the_tags($post_id);
        if (!$tags) {
            return array();
        }
        
        return array_map(function($tag) {
            return $tag->name;
        }, $tags);
    }
    
    private function log_sync($action, $post_id, $status, $message) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'urlshortener_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'post_id' => $post_id,
                'action' => $action,
                'status' => $status,
                'message' => $message,
                'created_at' => current_time('mysql')
            ),
            array('%d', '%s', '%s', '%s', '%s')
        );
        
        // Limpar logs antigos (manter apenas últimos 100)
        $wpdb->query(
            "DELETE FROM $table_name WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id FROM $table_name ORDER BY id DESC LIMIT 100
                ) tmp
            )"
        );
    }
}