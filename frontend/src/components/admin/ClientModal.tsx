import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Client } from '../../types';
import { adminService } from '../../services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  onSave: () => void;
}

const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  client,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    customCpm: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!client;

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email,
        password: '',
        customCpm: client.customCpm || 0,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        customCpm: 0,
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isEditing && client) {
        await adminService.updateClient(client.id, {
          name: formData.name,
          email: formData.email,
          customCpm: formData.customCpm,
        });
        alert('Cliente atualizado com sucesso');
      } else {
        if (!formData.password) {
          alert('Senha é obrigatória para novos clientes');
          return;
        }
        
        await adminService.createClient({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          customCpm: formData.customCpm,
        });
        alert('Cliente criado com sucesso');
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar cliente');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)'
      }}
    >
      <div 
        className="rounded-lg shadow-2xl max-w-[425px] w-full max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0'
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nome</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full"
              />
            </div>
            
            {!isEditing && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Senha</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">CPM Customizado</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.customCpm}
                onChange={(e) => setFormData({ ...formData, customCpm: parseFloat(e.target.value) || 0 })}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Deixe 0 para usar o CPM padrão do sistema
              </p>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientModal;