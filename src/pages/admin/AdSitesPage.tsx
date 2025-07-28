import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Globe, Play, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AdSite } from '../../types';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';


const AdSitesPage: React.FC = () => {
  const [adsites, setAdSites] = useState<AdSite[]>([]);
  const [filteredAdSites, setFilteredAdSites] = useState<AdSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdSite, setSelectedAdSite] = useState<AdSite | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteAdSite, setDeleteAdSite] = useState<AdSite | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    forcedClick: false,
    timerDuration: 5,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAdSites();
  }, []);

  useEffect(() => {
    filterAdSites();
  }, [adsites, searchTerm]);

  const loadAdSites = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getAdSites();
      setAdSites(data);
    } catch (error: any) {
      alert('Erro ao carregar AdSites: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAdSites = () => {
    let filtered = adsites;

    if (searchTerm) {
      filtered = adsites.filter(
        (adsite) =>
          adsite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          adsite.url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAdSites(filtered);
  };

  const handleCreateAdSite = () => {
    setSelectedAdSite(null);
    setFormData({ name: '', url: '', forcedClick: false, timerDuration: 5 });
    setIsModalOpen(true);
  };

  const handleEditAdSite = (adsite: AdSite) => {
    setSelectedAdSite(adsite);
    setFormData({
      name: adsite.name,
      url: adsite.url,
      forcedClick: adsite.forcedClick || false,
      timerDuration: adsite.timerDuration || 5,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedAdSite) {
        await adminService.updateAdSite(selectedAdSite.id, formData);
        alert('AdSite atualizado com sucesso');
      } else {
        await adminService.createAdSite(formData);
        alert('AdSite criado com sucesso');
      }
      
      setIsModalOpen(false);
      loadAdSites();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar AdSite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdSite = async () => {
    if (!deleteAdSite) return;

    try {
      await adminService.deleteAdSite(deleteAdSite.id);
      alert('AdSite excluído com sucesso');
      setDeleteAdSite(null);
      loadAdSites();
    } catch (error: any) {
      alert('Erro ao excluir AdSite: ' + error.message);
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
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar AdSites</h1>
          <p className="text-muted-foreground">
            Gerencie os sites de anúncios e suas configurações
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AdSites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adsites.length}</div>
            <p className="text-xs text-muted-foreground">
              Sites de anúncios cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites Ativos</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adsites.filter(site => site.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Sites ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anúncios</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adsites.reduce((total, site) => total + (site.adCount || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Anúncios configurados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de AdSites</CardTitle>
            <Button onClick={handleCreateAdSite}>
              <Plus className="mr-2 h-4 w-4" />
              Novo AdSite
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou URL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Token API</TableHead>
                <TableHead>Anúncios</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdSites.map((adsite) => (
                <TableRow key={adsite.id}>
                  <TableCell className="font-medium">{adsite.name}</TableCell>
                  <TableCell>
                    <a 
                      href={adsite.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {adsite.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs bg-gray-100 p-1 rounded max-w-32 truncate" title={adsite.apiToken}>
                      {adsite.apiToken}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {adsite.adCount || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      adsite.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {adsite.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {adsite.createdAt
                      ? format(new Date(adsite.createdAt), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditAdSite(adsite)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAdSite(adsite)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAdSites.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum AdSite encontrado</p>
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
                    {selectedAdSite ? 'Editar AdSite' : 'Novo AdSite'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAdSite 
                      ? 'Edite as informações do site de anúncios' 
                      : 'Crie um novo site de anúncios. Um token API será gerado automaticamente.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nome do Site</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Ex: Meu Blog, Site de Notícias"
                    className="w-full"
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
                    className="w-full"
                  />
                </div>
                
                
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Configurações de Conversão</h4>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="forcedClick"
                      checked={formData.forcedClick}
                      onChange={(e) => setFormData({ ...formData, forcedClick: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="forcedClick" className="text-sm text-gray-700">
                      Forçar clique no banner para liberar download
                    </label>
                  </div>
                  
                  {formData.forcedClick && (
                    <div className="ml-6 space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Duração do timer (segundos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.timerDuration}
                        onChange={(e) => setFormData({ ...formData, timerDuration: parseInt(e.target.value) || 5 })}
                        className="w-20 px-3 py-1 border border-gray-300 rounded-md text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        Tempo que o usuário deve esperar antes de poder clicar no banner
                      </p>
                    </div>
                  )}
                  
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-700">
                      <strong>Como funciona:</strong> Com forced click ativado, após o timer no Step 2, 
                      o usuário deve clicar em qualquer banner para liberar o botão de download.
                    </p>
                  </div>
                </div>
                
                {selectedAdSite && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Token API</label>
                    <div className="p-3 bg-gray-100 rounded-md font-mono text-sm break-all">
                      {selectedAdSite.apiToken}
                    </div>
                    <p className="text-xs text-gray-500">
                      Use este token para conectar com o plugin WordPress
                    </p>
                  </div>
                )}
                
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
      <Dialog open={!!deleteAdSite} onOpenChange={() => setDeleteAdSite(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o AdSite "{deleteAdSite?.name}"?
              Esta ação não pode ser desfeita e todos os anúncios associados serão perdidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAdSite(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAdSite}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdSitesPage;