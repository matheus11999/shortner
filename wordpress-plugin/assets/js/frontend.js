// Frontend JavaScript para URL Shortener AdSite
(function($) {
    'use strict';
    
    // Funcionalidade básica do frontend
    $(document).ready(function() {
        
        // Detectar se o site está conectado ao sistema
        if ($('meta[name="urlshortener-adsite"]').length) {
            console.log('URL Shortener AdSite: Plugin ativo');
        }
        
        // Funcionalidades futuras do frontend serão implementadas aqui
        // como tracking de cliques, exibição de anúncios, etc.
        
    });
    
})(jQuery);