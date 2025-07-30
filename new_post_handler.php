<?php
/**
 * URL Shortener AdSite Handler - Loading Page
 * Loading page with session creation and redirect to random post
 */

// Prevent direct access without parameters
if (!isset($_GET['u']) || empty($_GET['u'])) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested resource was not found on this server.</p></body></html>';
    exit;
}

// Load WordPress
if (!defined('ABSPATH')) {
    require_once __DIR__ . '/wp-load.php';
}

// Sanitize and decode the URL
$encoded_url = sanitize_text_field($_GET['u']);
$original_url = base64_decode($encoded_url);

if (!$original_url) {
    // If decoding fails, treat as plain URL
    $original_url = sanitize_url($_GET['u']);
}

if (!$original_url) {
    wp_redirect(home_url());
    exit;
}

// Create session with 2 minute expiration
$session_key = 'urlshortener_' . md5($original_url . time() . wp_create_nonce('urlshortener'));
$url_data = array(
    'original_url' => $original_url,
    'encoded_url' => $encoded_url,
    'timestamp' => time(),
    'expires' => time() + (2 * 60), // 2 minutes
    'show_ads' => true,
    'source' => 'post_php_handler',
    'step' => 1,
    'session_id' => $session_key
);

// Store in transient for 2 minutes
set_transient($session_key, $url_data, 2 * 60);
setcookie('urlshortener_session', $session_key, time() + (2 * 60), '/', '', is_ssl(), true);

// Get random post for redirect
$posts = get_posts(array(
    'numberposts' => 1,
    'post_status' => 'publish',
    'orderby' => 'rand',
    'post_type' => 'post'
));

$redirect_url = !empty($posts) ? get_permalink($posts[0]->ID) : home_url();

error_log('URLShortener: Session created, redirecting to: ' . $redirect_url);
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    </div>
    
    <script>
        // Redirect after 2 seconds
        setTimeout(function() {
            window.location.href = '<?php echo esc_js($redirect_url); ?>';
        }, 2000);
    </script>
</body>
</html>
<?php exit; ?>