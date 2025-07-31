import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Globe, Link, Eye } from 'lucide-react';
import type { Client, AdSite } from '../../types';
import { adminService } from '../../services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  user_id: number;
  name: string;
  url: string;
  assigned_adsite_id?: number;
  integration_code: string;
  magnet_intercept: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  client_name: string;
  client_email: string;
  adsite_name?: string;
}

const ClientSitesPage: React.FC = () => {
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [adsites, setAdSites] = useState<AdSite[]>([]);
  const [filteredSites, setFilteredSites] = useState<ClientSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteSite, setDeleteSite] = useState<ClientSite | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    url: '',
    assignedAdsiteId: '',
    magnetIntercept: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSites();
  }, [sites, searchTerm, selectedClient]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sitesData, clientsData, adsitesData] = await Promise.all([
        adminService.getClientSites(),
        adminService.getClients(),
        adminService.getAdSites()
      ]);
      setSites(sitesData);
      setClients(clientsData);
      setAdSites(adsitesData);
    } catch (error: any) {
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSites = () => {
    let filtered = sites;

    if (selectedClient) {
      filtered = sites.filter(site => site.user_id.toString() === selectedClient);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (site) =>
          site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          site.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
          site.client_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSites(filtered);
  };

  const handleCreateSite = () => {
    setSelectedSite(null);
    setFormData({ 
      userId: '', 
      name: '', 
      url: '', 
      assignedAdsiteId: '', 
      magnetIntercept: true 
    });
    setIsModalOpen(true);
  };

  const handleEditSite = (site: ClientSite) => {
    setSelectedSite(site);
    setFormData({
      userId: site.user_id.toString(),
      name: site.name,
      url: site.url,
      assignedAdsiteId: site.assigned_adsite_id?.toString() || '',
      magnetIntercept: site.magnet_intercept,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedSite) {
        await adminService.updateClientSite(selectedSite.id, {
          ...formData,
          assignedAdsiteId: formData.assignedAdsiteId ? parseInt(formData.assignedAdsiteId) : null
        });
        alert('Site atualizado com sucesso');
      } else {
        await adminService.createClientSite({
          ...formData,
          userId: parseInt(formData.userId),
          assignedAdsiteId: formData.assignedAdsiteId ? parseInt(formData.assignedAdsiteId) : null
        });
        alert('Site criado com sucesso');
      }
      
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar site');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!deleteSite) return;

    try {
      await adminService.deleteClientSite(deleteSite.id);
      alert('Site excluído com sucesso');
      setDeleteSite(null);
      loadData();
    } catch (error: any) {
      alert('Erro ao excluir site: ' + error.message);
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
          <h1 className="text-3xl font-bold tracking-tight">Sites dos Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie os sites dos clientes e suas configurações de AdSites
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
            <CardTitle className="text-sm font-medium">Com AdSites</CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sites.filter(site => site.assigned_adsite_id).length}
            </div>
            <p className="text-xs text-muted-foreground">Sites com AdSites atribuídos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Sites</CardTitle>
            <Button onClick={handleCreateSite}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Site
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, URL ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="flex h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Todos os clientes</option>
              {clients.map(client => (
                <option key={client.id} value={client.id.toString()}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>AdSite</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{site.client_name}</div>
                      <div className="text-sm text-gray-500">{site.client_email}</div>
                    </div>
                  </TableCell>
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
                        Não atribuído
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs bg-gray-100 p-1 rounded max-w-32 truncate" title={site.integration_code}>
                      {site.integration_code}
                    </div>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSite(site)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteSite(site)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredSites.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum site encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }}
        >
          <div 
            className="rounded-lg shadow-2xl max-w-[500px] w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0'
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedSite ? 'Editar Site' : 'Novo Site'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedSite 
                      ? 'Edite as informações do site do cliente' 
                      : 'Adicione um novo site para o cliente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Cliente</label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id.toString()}>
                        {client.name} ({client.email})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nome do Site</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Ex: Meu Site de Downloads"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">URL do Site</label>
                  <Input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    placeholder="https://meusite.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">AdSite Atribuído</label>
                  <select
                    value={formData.assignedAdsiteId}
                    onChange={(e) => setFormData({ ...formData, assignedAdsiteId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Nenhum AdSite (redirecionamento direto)</option>
                    {adsites.map(adsite => (
                      <option key={adsite.id} value={adsite.id.toString()}>
                        {adsite.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    Se não selecionar um AdSite, magnet links serão redirecionados diretamente
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="magnetIntercept"
                    checked={formData.magnetIntercept}
                    onChange={(e) => setFormData({ ...formData, magnetIntercept: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="magnetIntercept" className="text-sm text-gray-700">
                    Interceptar magnet links
                  </label>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir o site "{deleteSite.name}"?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setDeleteSite(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteSite}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSitesPage;