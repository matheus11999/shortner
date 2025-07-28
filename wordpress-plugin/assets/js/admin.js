jQuery(document).ready(function($) {
    
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
                    var userInfo = response.user_data ? 
                        '<br><small>Usuário: ' + response.user_data.name + ' (' + response.user_data.email + ')</small>' : '';
                    
                    statusDiv.removeClass('disconnected').addClass('connected')
                        .html('<span class="dashicons dashicons-yes-alt"></span> <strong>Conectado</strong>' + userInfo);
                    
                    showNotice('✅ ' + response.message, 'success');
                    
                    // Mostrar seção de sincronização se conectado
                    $('.sync-section').show();
                } else {
                    statusDiv.removeClass('connected').addClass('disconnected')
                        .html('<span class="dashicons dashicons-dismiss"></span> <strong>Desconectado</strong><br><small>Configure a URL da API e Token para conectar</small>');
                    
                    showNotice('❌ ' + response.message, 'error');
                    $('.sync-section').hide();
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
        var button = $(this);
        var originalHtml = button.html();
        
        button.html('<span class="urlshortener-loading"></span> Atualizando...').prop('disabled', true);
        
        // Simular refresh do status usando o test connection atual
        $('#test-connection').trigger('click');
        
        setTimeout(function() {
            button.html(originalHtml).prop('disabled', false);
        }, 2000);
    });
    
    // Sincronização manual
    $('#manual-sync').on('click', function() {
        var button = $(this);
        var originalText = button.text();
        
        button.text('Sincronizando...').prop('disabled', true);
        
        var statusDiv = $('#sync-status');
        statusDiv.html('<p>Iniciando sincronização...</p>');
        
        $.ajax({
            url: urlshortener_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'urlshortener_sync_posts',
                nonce: urlshortener_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    statusDiv.html('<p class="success">✓ ' + response.message + '</p>');
                    showNotice('Posts sincronizados com sucesso!', 'success');
                    
                    // Recarregar logs após alguns segundos
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    statusDiv.html('<p class="error">✗ ' + response.message + '</p>');
                    showNotice('Erro na sincronização: ' + response.message, 'error');
                }
            },
            error: function() {
                statusDiv.html('<p class="error">✗ Erro ao sincronizar posts</p>');
                showNotice('Erro ao sincronizar posts. Tente novamente.', 'error');
            },
            complete: function() {
                button.text(originalText).prop('disabled', false);
            }
        });
    });
    
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
        var noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
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
    
});