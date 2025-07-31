import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Users, DollarSign, Settings, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Client } from '../../types';
import { adminService } from '../../services/admin';
import ClientModal from '../../components/admin/ClientModal';
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

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [manageSitesClient, setManageSitesClient] = useState<Client | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterAndSortClients();
  }, [clients, searchTerm, sortBy]);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getClients();
      setClients(data);
    } catch (error: any) {
      alert('Erro ao carregar clientes: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortClients = () => {
    let filtered = clients;

    if (searchTerm) {
      filtered = clients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'siteCount':
          return (b.siteCount || 0) - (a.siteCount || 0);
        case 'createdAt':
        default:
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
    });

    setFilteredClients(filtered);
  };

  const handleCreateClient = () => {
    setSelectedClient(null);
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!deleteClient) return;

    try {
      await adminService.deleteClient(deleteClient.id);
      alert('Cliente excluído com sucesso');
      setDeleteClient(null);
      loadClients();
    } catch (error: any) {
      alert('Erro ao excluir cliente: ' + error.message);
    }
  };

  const handleSaveClient = () => {
    setIsModalOpen(false);
    loadClients();
  };

  const handleManageSites = (client: Client) => {
    setManageSitesClient(client);
  };

  const totalClients = clients.length;
  const activeClients = clients.filter(client => client.role === 'client').length;

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
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie os clientes e suas configurações
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClients}</div>
            <p className="text-xs text-muted-foreground">
              Com sites ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPM Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 2,50</div>
            <p className="text-xs text-muted-foreground">
              Por mil cliques
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <Button onClick={handleCreateClient}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="createdAt">Mais recente</option>
              <option value="name">Nome</option>
              <option value="email">Email</option>
              <option value="siteCount">Sites</option>
            </select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>CPM</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {client.siteCount || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {client.customCpm ? `R$ ${client.customCpm.toFixed(2)}` : 'Padrão'}
                  </TableCell>
                  <TableCell>
                    {client.createdAt
                      ? format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManageSites(client)}
                        title="Gerenciar Sites"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClient(client)}
                        title="Editar Cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteClient(client)}
                        title="Excluir Cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={selectedClient}
        onSave={handleSaveClient}
      />

      {deleteClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir o cliente "{deleteClient.name}"?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setDeleteClient(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteClient}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Sites */}
      {manageSitesClient && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }}
        >
          <div 
            className="rounded-lg shadow-2xl max-w-[500px] w-full"
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0'
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Gerenciar Sites - {manageSitesClient.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setManageSitesClient(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="text-center py-8">
                <div className="mb-4">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Funcionalidade em Desenvolvimento
                  </h3>
                  <p className="text-gray-600">
                    O gerenciamento de sites para clientes será implementado em breve.
                  </p>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Esta funcionalidade permitirá:
                  <br />• Criar e editar sites do cliente
                  <br />• Atribuir AdSites aos sites
                  <br />• Configurar códigos de integração
                </p>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setManageSitesClient(null)}>
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

export default ClientsPage;