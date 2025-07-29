jQuery(document).ready(function($) {
    
    // Auto-refresh status every 10 seconds if connected
    setInterval(function() {
        if ($('#connection-status').hasClass('connected')) {
            refreshStatus(true); // Silent refresh
        }
    }, 10000);
    
    // Real-time token validation
    let tokenValidationTimeout;
    $('#api_token').on('input', function() {
        clearTimeout(tokenValidationTimeout);
        const token = $(this).val();
        const apiUrl = $('#api_url').val();
        
        if (token.length > 10 && apiUrl) {
            tokenValidationTimeout = setTimeout(function() {
                validateTokenRealTime(apiUrl, token);
            }, 1000);
        }
    });
    
    // Real-time URL validation
    $('#api_url').on('input', function() {
        const url = $(this).val();
        if (url && isValidUrl(url)) {
            $(this).removeClass('invalid').addClass('valid');
        } else if (url) {
            $(this).removeClass('valid').addClass('invalid');
        }
    });
    
    // Enhanced CSS for real-time feedback
    $('<style>').text(`
        #api_token.valid, #api_url.valid {
            border-color: #28a745 !important;
            box-shadow: 0 0 0 1px #28a745 !important;
        }
        #api_token.invalid, #api_url.invalid {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 1px #dc3545 !important;
        }
        .inline-notice {
            position: fixed;
            top: 32px;
            right: 20px;
            z-index: 999999;
            min-width: 300px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .connection-status.connected {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        #test-adsite, #test-wordpress {
            animation: fadeIn 0.5s ease;
            transition: all 0.3s ease;
        }
        #test-adsite.show, #test-wordpress.show {
            display: inline-block !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        #test-adsite.hide, #test-wordpress.hide {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
        }
    `).appendTo('head');
    
    // Force show buttons if connected on page load
    function checkAndShowButtons() {
        if ($('#connection-status').hasClass('connected')) {
            showTestButtons();
        } else {
            hideTestButtons();
        }
    }
    
    function showTestButtons() {
        $('#test-adsite, #test-wordpress').removeClass('hide').addClass('show').show().css({
            'display': 'inline-block',
            'opacity': '1',
            'visibility': 'visible'
        });
    }
    
    function hideTestButtons() {
        $('#test-adsite, #test-wordpress').removeClass('show').addClass('hide').hide().css({
            'display': 'none',
            'opacity': '0',
            'visibility': 'hidden'
        });
    }
    
    // Testar conexão
    $('#test-connection').on('click', function() {
        var button = $(this);
        var originalHtml = button.html();
        
        button.html('<span class="urlshortener-loading"></span> Testando...').prop('disabled', true);
        
        var apiUrl = $('#api_url').val();
        var apiToken = $('#api_token').val();
        
        if (!apiUrl || !apiToken) {
            showNotice('Por favor, preencha a URL da API e o token antes de testar.', 'warning');
            button.html(originalHtml).prop('disabled', false);
            return;
        }
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_test_connection',
                nonce: urlshortener_admin_ajax.nonce,
                api_url: apiUrl,
                api_token: apiToken
            },
            success: function(response) {
                var statusDiv = $('#connection-status');
                
                if (response.success) {
                    var adsiteInfo = response.adsite_data ? 
                        '<br><small>AdSite: ' + response.adsite_data.name + ' (' + response.adsite_data.url + ')</small>' : '';
                    
                    statusDiv.removeClass('disconnected').addClass('connected')
                        .html('<span class="dashicons dashicons-yes-alt"></span> <strong>Conectado</strong>' + adsiteInfo);
                    
                    showNotice('✅ ' + response.message, 'success');
                    
                    // Show test buttons
                    showTestButtons();
                    
                    // Auto-save settings
                    saveSettingsRealTime();
                    
                } else {
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Desconectado</strong><br><small>Configure a URL da API e Token para conectar</small>');
                    
                    showNotice('❌ ' + response.message, 'error');
                    hideTestButtons();
                }
            },
            error: function(xhr, status, error) {
                showNotice('❌ Erro ao testar conexão: ' + error, 'error');
            },
            complete: function() {
                button.html(originalHtml).prop('disabled', false);
            }
        });
    });
    
    // Atualizar status
    $('#refresh-status').on('click', function() {
        refreshStatus(false);
    });
    
    // Test WordPress Ads
    $('#test-wordpress').on('click', function() {
        var button = $(this);
        var originalText = button.html();
        
        button.html('<span class="dashicons dashicons-update-alt spin"></span> Gerando...').prop('disabled', true);
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_test_wordpress',
                nonce: urlshortener_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    var testResult = $('#test-result');
                    
                    testResult.html(
                        '<div class="notice notice-success inline">' +
                        '<p><strong>🎯 Teste do WordPress - Sistema Completo</strong></p>' +
                        '<p>URL de teste gerada! Esta URL simula o fluxo completo:</p>' +
                        '<ul style="margin: 10px 0 10px 20px;">' +
                        '<li>✅ Interceptação de URL encurtada</li>' +
                        '<li>✅ Redirecionamento para post aleatório</li>' +
                        '<li>✅ Substituição do conteúdo por anúncios</li>' +
                        '<li>✅ Steps 1 e 2 com modo escuro</li>' +
                        '<li>✅ Design responsivo</li>' +
                        '</ul>' +
                        '<p>' +
                        '<a href="' + data.test_url + '" target="_blank" class="button button-primary">' +
                        '<span class="dashicons dashicons-external"></span> Testar no WordPress' +
                        '</a>' +
                        '</p>' +
                        '<p><small><strong>URL:</strong> ' + data.test_url + '</small></p>' +
                        '</div>'
                    ).show();
                    
                    showNotice('URL de teste do WordPress gerada com sucesso!', 'success');
                } else {
                    showNotice('Erro ao gerar teste: ' + (response.data || 'Erro desconhecido'), 'error');
                }
            },
            error: function() {
                showNotice('Erro de conexão ao gerar teste', 'error');
            },
            complete: function() {
                button.html(originalText).prop('disabled', false);
            }
        });
    });
    
    // Test AdSite
    $('#test-adsite').on('click', function() {
        var button = $(this);
        var originalText = button.html();
        
        button.html('<span class="dashicons dashicons-update-alt spin"></span> Testando...').prop('disabled', true);
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_test_adsite',
                nonce: urlshortener_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    var testResult = $('#test-result');
                    
                    testResult.html(
                        '<div class="notice notice-info inline">' +
                        '<p><strong>🧪 Teste do AdSite "' + data.adsite_name + '"</strong></p>' +
                        '<p>URL de teste gerada! Clique no botão abaixo para abrir em uma nova aba:</p>' +
                        '<p>' +
                        '<a href="' + data.test_url + '" target="_blank" class="button button-primary">' +
                        '<span class="dashicons dashicons-external"></span> Abrir Teste do AdSite' +
                        '</a>' +
                        '</p>' +
                        '<p><small><strong>URL:</strong> ' + data.test_url + '</small></p>' +
                        '</div>'
                    ).show();
                    
                    showNotice('URL de teste gerada com sucesso!', 'success');
                } else {
                    showNotice('Erro ao gerar teste: ' + (response.data || 'Erro desconhecido'), 'error');
                }
            },
            error: function() {
                showNotice('Erro de conexão ao gerar teste', 'error');
            },
            complete: function() {
                button.html(originalText).prop('disabled', false);
            }
        });
    });
    
    // Check updates
    $('#check-updates').on('click', function() {
        var button = $(this);
        var originalText = button.html();
        
        button.html('<span class="dashicons dashicons-update-alt spin"></span> Verificando...').prop('disabled', true);
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_check_updates',
                nonce: urlshortener_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data.message, 'success');
                    // Trigger WordPress update check
                    setTimeout(function() {
                        if (confirm('Verificação concluída. Recarregar a página para ver atualizações disponíveis?')) {
                            location.reload();
                        }
                    }, 2000);
                } else {
                    showNotice('Erro na verificação: ' + (response.data || 'Erro desconhecido'), 'error');
                }
            },
            error: function() {
                showNotice('Erro de conexão', 'error');
            },
            complete: function() {
                button.html(originalText).prop('disabled', false);
            }
        });
    });
    
    // Function to refresh status
    function refreshStatus(silent) {
        var button = $('#refresh-status');
        var originalHtml = button.html();
        
        if (!silent) {
            button.html('<span class="urlshortener-loading"></span> Atualizando...').prop('disabled', true);
        }
        
        var apiUrl = $('#api_url').val();
        var apiToken = $('#api_token').val();
        
        if (!apiUrl || !apiToken) {
            if (!silent) {
                button.html(originalHtml).prop('disabled', false);
            }
            return;
        }
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_test_connection',
                nonce: urlshortener_admin_ajax.nonce,
                api_url: apiUrl,
                api_token: apiToken
            },
            success: function(response) {
                var statusDiv = $('#connection-status');
                
                if (response.success) {
                    var adsiteInfo = response.adsite_data ? 
                        '<br><small>AdSite: ' + response.adsite_data.name + ' (' + response.adsite_data.url + ')</small>' : '';
                    
                    statusDiv.removeClass('disconnected').addClass('connected')
                        .html('<span class="dashicons dashicons-yes-alt"></span> <strong>Conectado</strong>' + adsiteInfo);
                    
                    if (!silent) {
                        showNotice('Status atualizado: ' + response.message, 'success');
                    }
                    
                    // Show test buttons
                    showTestButtons();
                    
                } else {
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Desconectado</strong><br><small>' + response.message + '</small>');
                    
                    if (!silent) {
                        showNotice('Status: ' + response.message, 'warning');
                    }
                    hideTestButtons();
                }
            },
            error: function(xhr, status, error) {
                if (!silent) {
                    showNotice('Erro ao atualizar status: ' + error, 'error');
                }
            },
            complete: function() {
                if (!silent) {
                    button.html(originalHtml).prop('disabled', false);
                }
            }
        });
    }
    
    // Real-time token validation function
    function validateTokenRealTime(apiUrl, apiToken) {
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_test_connection',
                nonce: urlshortener_admin_ajax.nonce,
                api_url: apiUrl,
                api_token: apiToken
            },
            success: function(response) {
                const statusDiv = $('#connection-status');
                const tokenInput = $('#api_token');
                
                if (response.success) {
                    tokenInput.removeClass('invalid').addClass('valid');
                    statusDiv.removeClass('disconnected').addClass('connected')
                        .html('<span class="dashicons dashicons-yes-alt"></span> <strong>Conectado</strong>');
                    
                    // Show test buttons immediately
                    showTestButtons();
                    
                    // Auto-save settings
                    saveSettingsRealTime();
                    
                } else {
                    tokenInput.removeClass('valid').addClass('invalid');
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Token Inválido</strong>');
                    
                    hideTestButtons();
                }
            },
            error: function() {
                $('#api_token').removeClass('valid').addClass('invalid');
                hideTestButtons();
            }
        });
    }
    
    // Auto-save settings function
    function saveSettingsRealTime() {
        const formData = $('form').serialize() + '&action=update&option_page=urlshortener_settings&_wpnonce=' + $('input[name="_wpnonce"]').val();
        
        $.ajax({
            url: 'options.php',
            type: 'POST',
            data: formData,
            success: function() {
                showNotice('✅ Configurações salvas automaticamente', 'success', 2000);
            }
        });
    }
    
    // Enhanced showNotice with auto-dismiss time
    function showNotice(message, type, duration = 5000) {
        // Remove existing notices of same type
        $('.notice-' + (type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error')).remove();
        
        var noticeClass = type === 'success' ? 'notice-success' : (type === 'warning' ? 'notice-warning' : 'notice-error');
        var notice = $('<div class="notice ' + noticeClass + ' is-dismissible inline-notice"><p>' + message + '</p></div>');
        
        $('.wrap h1').after(notice);
        notice.hide().fadeIn(300);
        
        // Auto-remove
        setTimeout(function() {
            notice.fadeOut(300, function() {
                $(this).remove();
            });
        }, duration);
    }
    
    // Force update check on page load and make it automatic
    function autoCheckUpdates() {
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_check_updates',
                nonce: urlshortener_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    // Trigger WordPress native update check
                    setTimeout(function() {
                        if ($('.plugin-update-tr').length > 0) {
                            showNotice('🚀 Nova versão disponível! Clique em "Atualizar agora" abaixo.', 'warning', 10000);
                        }
                    }, 2000);
                }
            }
        });
    }
    
    // Validação de formulário
    $('form').on('submit', function() {
        var apiUrl = $('#api_url').val();
        var apiToken = $('#api_token').val();
        
        if (apiUrl && !isValidUrl(apiUrl)) {
            alert('Por favor, insira uma URL válida para a API.');
            return false;
        }
        
        if (apiUrl && !apiToken) {
            alert('Token da API é obrigatório quando a URL é fornecida.');
            return false;
        }
        
        return true;
    });
    
    // Mostrar/ocultar senha do token
    var togglePassword = $('<button type="button" class="button button-small" style="margin-left: 5px;">Mostrar</button>');
    $('#api_token').after(togglePassword);
    
    togglePassword.on('click', function() {
        var tokenInput = $('#api_token');
        var type = tokenInput.attr('type');
        
        if (type === 'password') {
            tokenInput.attr('type', 'text');
            $(this).text('Ocultar');
        } else {
            tokenInput.attr('type', 'password');
            $(this).text('Mostrar');
        }
    });
    
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    // Auto-save de configurações
    var autoSaveTimeout;
    $('#api_url, #api_token').on('input', function() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(function() {
            // Indicar que as configurações foram alteradas
            var submitButton = $('input[type="submit"]');
            if (!submitButton.hasClass('unsaved-changes')) {
                submitButton.addClass('unsaved-changes').val('Salvar Alterações *');
            }
        }, 1000);
    });
    
    // Confirmação antes de sair se houver alterações não salvas
    var formChanged = false;
    $('form input, form select, form textarea').on('change', function() {
        formChanged = true;
    });
    
    $('form').on('submit', function() {
        formChanged = false;
    });
    
    $(window).on('beforeunload', function() {
        if (formChanged) {
            return 'Você tem alterações não salvas. Deseja sair mesmo assim?';
        }
    });
    
    // Initial status check on page load - faster
    $(document).ready(function() {
        // Check buttons state immediately
        setTimeout(checkAndShowButtons, 100);
        
        // Immediate check
        setTimeout(function() {
            refreshStatus(true);
        }, 500);
        
        // Auto-check for updates
        setTimeout(autoCheckUpdates, 1000);
        
        // Check for updates every 30 seconds
        setInterval(autoCheckUpdates, 30000);
        
        // Periodically check buttons state
        setInterval(checkAndShowButtons, 5000);
    });
    
});