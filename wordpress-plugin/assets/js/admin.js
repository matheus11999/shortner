jQuery(document).ready(function($) {
    
    // Auto-refresh status every 30 seconds if connected
    setInterval(function() {
        if ($('#connection-status').hasClass('connected')) {
            refreshStatus(true); // Silent refresh
        }
    }, 30000);
    
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
                    $('#test-adsite').show();
                    $('#test-wordpress').show();
                    
                } else {
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Desconectado</strong><br><small>Configure a URL da API e Token para conectar</small>');
                    
                    showNotice('❌ ' + response.message, 'error');
                    $('#test-adsite').hide();
                    $('#test-wordpress').hide();
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
                    $('#test-adsite').show();
                    $('#test-wordpress').show();
                    
                } else {
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Desconectado</strong><br><small>' + response.message + '</small>');
                    
                    if (!silent) {
                        showNotice('Status: ' + response.message, 'warning');
                    }
                    $('#test-adsite').hide();
                    $('#test-wordpress').hide();
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
    
    // Funções auxiliares
    function showNotice(message, type) {
        var noticeClass = type === 'success' ? 'notice-success' : (type === 'warning' ? 'notice-warning' : 'notice-error');
        var notice = $('<div class="notice ' + noticeClass + ' is-dismissible"><p>' + message + '</p></div>');
        
        $('.wrap h1').after(notice);
        
        // Auto-remover após 5 segundos
        setTimeout(function() {
            notice.fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
        
        // Adicionar botão de dismiss
        notice.on('click', '.notice-dismiss', function() {
            notice.fadeOut(function() {
                $(this).remove();
            });
        });
    }
    
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
    
    // Initial status check on page load
    $(document).ready(function() {
        setTimeout(function() {
            refreshStatus(true);
        }, 1000);
    });
    
});