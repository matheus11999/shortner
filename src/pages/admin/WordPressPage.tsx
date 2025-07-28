import React, { useState } from 'react';
import { Download, FileText, Settings, Globe, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const WordPressPage: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPlugin = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/admin/wordpress-plugin', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar plugin');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'url-shortener-adsite.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert('Erro ao baixar plugin: ' + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plugin WordPress</h1>
          <p className="text-muted-foreground">
            Configure e baixe o plugin para integração com WordPress
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Download do Plugin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>Download do Plugin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Baixe o plugin oficial para integrar seus sites WordPress com o sistema de URL shortener.
            </p>
            
            <div className="space-y-2">
              <h4 className="font-medium">Recursos inclusos:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Sincronização automática de posts</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Integração via API REST</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Configuração simples no admin</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Compatível com WordPress 5.0+</span>
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleDownloadPlugin} 
              disabled={isDownloading}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Baixando...' : 'Baixar Plugin'}
            </Button>
          </CardContent>
        </Card>

        {/* Instruções de Instalação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Instruções de Instalação</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">1</span>
                <div>
                  <h4 className="font-medium">Baixar o Plugin</h4>
                  <p className="text-sm text-muted-foreground">
                    Clique no botão de download para obter o arquivo ZIP do plugin.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">2</span>
                <div>
                  <h4 className="font-medium">Upload no WordPress</h4>
                  <p className="text-sm text-muted-foreground">
                    Acesse Plugins → Adicionar Novo → Enviar Plugin no seu WordPress.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">3</span>
                <div>
                  <h4 className="font-medium">Ativar Plugin</h4>
                  <p className="text-sm text-muted-foreground">
                    Instale e ative o plugin na página de plugins do WordPress.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">4</span>
                <div>
                  <h4 className="font-medium">Configurar API</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure a URL da API e o token nos AdSites correspondentes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuração da API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>Configuração da API</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para conectar o plugin WordPress com este sistema, você precisará das seguintes informações:
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL da API</label>
              <div className="p-3 bg-gray-100 rounded-md font-mono text-sm">
                {window.location.origin}/api
              </div>
              <p className="text-xs text-muted-foreground">
                Use esta URL no campo "API URL" do plugin WordPress.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Endpoint WordPress</label>
              <div className="p-3 bg-gray-100 rounded-md font-mono text-sm">
                https://seusite.com/wp-json/wp/v2
              </div>
              <p className="text-xs text-muted-foreground">
                Configure este endpoint no AdSite para sincronização de posts.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">💡 Dica Important</h4>
            <p className="text-sm text-blue-800">
              Certifique-se de que o WordPress tenha a API REST habilitada e que o token de autenticação 
              seja válido. Teste a conexão na página de AdSites após a configuração.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documentação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Documentação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Configuração Básica</h4>
              <p className="text-sm text-muted-foreground">
                Como configurar o plugin no WordPress e conectar com a API.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Sincronização de Posts</h4>
              <p className="text-sm text-muted-foreground">
                Como funciona a sincronização automática de posts do WordPress.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Troubleshooting</h4>
              <p className="text-sm text-muted-foreground">
                Soluções para problemas comuns de conexão e configuração.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Estrutura do Plugin</h4>
            <div className="p-3 bg-gray-100 rounded-md font-mono text-sm">
              <div>url-shortener-adsite/</div>
              <div>├── url-shortener-adsite.php</div>
              <div>├── includes/</div>
              <div>│   ├── class-admin.php</div>
              <div>│   ├── class-api.php</div>
              <div>│   └── class-posts-sync.php</div>
              <div>└── assets/</div>
              <div>    ├── css/admin.css</div>
              <div>    └── js/admin.js</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WordPressPage;