import React, { useState, useEffect } from 'react';
import { Copy, Globe, Code, Eye, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ClientSite {
  id: number;
  name: string;
  url: string;
  integration_code: string;
  magnet_intercept: boolean;
  status: string;
  created_at: string;
  adsite_name?: string;
  url_count?: number;
  total_clicks?: number;
}

const MySitesPage: React.FC = () => {
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null);
  const [integrationCode, setIntegrationCode] = useState('');
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/client/sites');
      setSites(response.data);
    } catch (error: any) {
      alert('Erro ao carregar sites: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getIntegrationCode = async (site: ClientSite) => {
    try {
      const response = await api.get(`/client/sites/${site.id}/integration-code`);
      setSelectedSite(site);
      setIntegrationCode(response.data.code);
      setIsCodeModalOpen(true);
    } catch (error: any) {
      alert('Erro ao buscar código de integração: ' + error.message);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Código copiado para a área de transferência!');
    } catch (err) {
      // Fallback para browsers mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Código copiado para a área de transferência!');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Sites</h1>
          <p className="text-muted-foreground">
            Visualize seus sites e copie os códigos de integração
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length}</div>
            <p className="text-xs text-muted-foreground">Sites cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites Ativos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sites.filter(site => site.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Com interceptação ativa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sites.reduce((total, site) => total + (site.total_clicks || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Clicks registrados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Sites</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>AdSite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URLs/Clicks</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell>
                    <a 
                      href={site.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {site.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    {site.adsite_name ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {site.adsite_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                        Direto
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      site.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {site.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{site.url_count || 0} URLs</div>
                      <div className="text-gray-500">{site.total_clicks || 0} clicks</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(site.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => getIntegrationCode(site)}
                    >
                      <Code className="mr-2 h-4 w-4" />
                      Código
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {sites.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum site cadastrado. Entre em contato com o administrador para adicionar sites.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal do Código de Integração */}
      {isCodeModalOpen && selectedSite && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }}
        >
          <div 
            className="rounded-lg shadow-2xl max-w-[700px] w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0'
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Código de Integração - {selectedSite.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Cole este código no header do seu site para interceptar magnet links
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="font-medium text-blue-800 mb-2">📋 Como usar:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>1. Copie o código abaixo</li>
                    <li>2. Cole no <code>&lt;head&gt;</code> do seu site</li>
                    <li>3. Todos os magnet links serão automaticamente interceptados</li>
                    <li>4. Os usuários verão anúncios antes do download</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Código JavaScript</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(integrationCode)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                  <textarea
                    value={integrationCode}
                    readOnly
                    className="w-full h-64 p-3 border border-gray-300 rounded-md text-xs font-mono bg-gray-50"
                  />
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h4 className="font-medium text-yellow-800 mb-2">⚠️ Importante:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• O código deve ser colocado antes dos magnet links aparecerem na página</li>
                    <li>• Funciona com links adicionados dinamicamente via JavaScript</li>
                    <li>• {selectedSite.adsite_name 
                      ? `Links redirecionarão através do AdSite: ${selectedSite.adsite_name}` 
                      : 'Links redirecionarão diretamente (sem AdSite configurado)'}</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t mt-6">
                <Button onClick={() => setIsCodeModalOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySitesPage;