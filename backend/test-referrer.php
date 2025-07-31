<?php
/**
 * Arquivo de teste para verificar referrer e informações passadas
 * Use este arquivo como URL de destino para testar o sistema
 */

// Capturar todas as informações
$data = [
    'timestamp' => date('Y-m-d H:i:s'),
    'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
    'referer' => $_SERVER['HTTP_REFERER'] ?? 'No Referer',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
    'query_string' => $_SERVER['QUERY_STRING'] ?? 'No Query String',
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
    'get_params' => $_GET,
    'post_params' => $_POST,
    'cookies' => $_COOKIE,
    'session' => isset($_SESSION) ? $_SESSION : 'No Session',
    'headers' => getallheaders(),
];

// Log para arquivo
$log_entry = json_encode($data, JSON_PRETTY_PRINT) . "\n" . str_repeat('-', 80) . "\n";
file_put_contents(__DIR__ . '/referrer-test.log', $log_entry, FILE_APPEND | LOCK_EX);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teste de Referrer - URL Shortener</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0d1117;
            color: #f0f6fc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #161b22;
            border-radius: 12px;
            padding: 30px;
            border: 1px solid #30363d;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #30363d;
        }
        .title {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #58a6ff, #3fb950);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #8b949e;
            font-size: 1.1rem;
        }
        .section {
            margin: 25px 0;
            background: #21262d;
            border-radius: 8px;
            padding: 20px;
            border: 1px solid #30363d;
        }
        .section-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #58a6ff;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
        }
        .data-item {
            background: #0d1117;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #30363d;
        }
        .data-label {
            font-weight: 600;
            color: #3fb950;
            margin-bottom: 5px;
        }
        .data-value {
            color: #f0f6fc;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        .highlight {
            background: #d29922;
            color: #0d1117;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        .success {
            background: #3fb950;
            color: #0d1117;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        .error {
            background: #f85149;
            color: #f0f6fc;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        .json-code {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 15px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.4;
        }
        @media (max-width: 768px) {
            .container { padding: 20px; }
            .title { font-size: 2rem; }
            .data-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🔍 Teste de Referrer Concluído</h1>
            <p class="subtitle">Verificação completa de informações recebidas</p>
        </div>

        <div class="section">
            <h2 class="section-title">
                🎯 Status do Referrer
            </h2>
            <div class="data-grid">
                <div class="data-item">
                    <div class="data-label">Status do Referrer</div>
                    <div class="data-value">
                        <?php if (!empty($data['referer']) && $data['referer'] !== 'No Referer'): ?>
                            <span class="success">✅ Referrer Detectado</span>
                        <?php else: ?>
                            <span class="error">❌ Sem Referrer</span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="data-item">
                    <div class="data-label">URL de Origem</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['referer']); ?></div>
                </div>
                <div class="data-item">
                    <div class="data-label">Timestamp</div>
                    <div class="data-value"><span class="highlight"><?php echo $data['timestamp']; ?></span></div>
                </div>
                <div class="data-item">
                    <div class="data-label">IP do Cliente</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['ip_address']); ?></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">
                🌐 Informações da Requisição
            </h2>
            <div class="data-grid">
                <div class="data-item">
                    <div class="data-label">Método HTTP</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['request_method']); ?></div>
                </div>
                <div class="data-item">
                    <div class="data-label">URI Solicitada</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['request_uri']); ?></div>
                </div>
                <div class="data-item">
                    <div class="data-label">Query String</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['query_string']); ?></div>
                </div>
                <div class="data-item">
                    <div class="data-label">Servidor</div>
                    <div class="data-value"><?php echo htmlspecialchars($data['server_name']); ?></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">
                📱 User Agent
            </h2>
            <div class="data-item">
                <div class="data-value"><?php echo htmlspecialchars($data['user_agent']); ?></div>
            </div>
        </div>

        <?php if (!empty($data['get_params'])): ?>
        <div class="section">
            <h2 class="section-title">
                📥 Parâmetros GET
            </h2>
            <div class="data-grid">
                <?php foreach ($data['get_params'] as $key => $value): ?>
                <div class="data-item">
                    <div class="data-label"><?php echo htmlspecialchars($key); ?></div>
                    <div class="data-value"><?php echo htmlspecialchars($value); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <?php if (!empty($data['cookies'])): ?>
        <div class="section">
            <h2 class="section-title">
                🍪 Cookies Recebidos
            </h2>
            <div class="data-grid">
                <?php foreach ($data['cookies'] as $key => $value): ?>
                <div class="data-item">
                    <div class="data-label"><?php echo htmlspecialchars($key); ?></div>
                    <div class="data-value"><?php echo htmlspecialchars(substr($value, 0, 100)); ?><?php echo strlen($value) > 100 ? '...' : ''; ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <div class="section">
            <h2 class="section-title">
                📋 Headers HTTP
            </h2>
            <div class="data-grid">
                <?php foreach ($data['headers'] as $key => $value): ?>
                <div class="data-item">
                    <div class="data-label"><?php echo htmlspecialchars($key); ?></div>
                    <div class="data-value"><?php echo htmlspecialchars($value); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">
                💾 JSON Completo (Salvo em referrer-test.log)
            </h2>
            <div class="json-code">
                <?php echo htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT)); ?>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">
                ✅ Teste Concluído
            </h2>
            <p style="color: #8b949e; text-align: center; font-size: 1.1rem;">
                Todas as informações foram registradas com sucesso.<br>
                Verifique o arquivo <strong>referrer-test.log</strong> para ver o histórico completo.
            </p>
        </div>
    </div>

    <script>
        console.log('Teste de Referrer - Dados coletados:', <?php echo json_encode($data); ?>);
    </script>
</body>
</html>