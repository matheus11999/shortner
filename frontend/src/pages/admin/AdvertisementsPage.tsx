import React, { useState, useEffect } from 'react';
import { Image } from 'lucide-react';
import type { AdSite } from '../../types';
import { adminService } from '../../services/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


const AdvertisementsPage: React.FC = () => {
  const [adsites, setAdSites] = useState<AdSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAdSite, setSelectedAdSite] = useState<string>('');
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  // Estado para os códigos de banner
  const [bannerCodes, setBannerCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAdSite) {
      loadBannerConfigs(selectedAdSite);
    }
  }, [selectedAdSite]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const adsitesData = await adminService.getAdSites();
      setAdSites(adsitesData);
    } catch (error: any) {
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBannerConfigs = async (adsiteId: string) => {
    try {
      const configs = await adminService.getBannerConfigs(parseInt(adsiteId));
      
      // Converter configs para o formato do estado
      const newBannerCodes: Record<string, string> = {};
      configs.forEach(config => {
        const key = getBannerKey(adsiteId, config.step, config.banner_type, config.position);
        newBannerCodes[key] = config.code;
      });
      
      setBannerCodes(newBannerCodes);
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const getBannerKey = (adsiteId: string, step: 1 | 2, bannerType: string, position: number) => {
    return `${adsiteId}_${step}_${bannerType}_${position}`;
  };

  const handleBannerCodeChange = (adsiteId: string, step: 1 | 2, bannerType: string, position: number, code: string) => {
    const key = getBannerKey(adsiteId, step, bannerType, position);
    setBannerCodes(prev => ({
      ...prev,
      [key]: code
    }));
  };

  const getBannerCode = (adsiteId: string, step: 1 | 2, bannerType: string, position: number) => {
    const key = getBannerKey(adsiteId, step, bannerType, position);
    return bannerCodes[key] || '';
  };

  const saveBannerConfig = async (adsiteId: string, step: 1 | 2) => {
    try {
      const bannerConfig = {
        adsiteId: parseInt(adsiteId),
        step,
        banners: {
          '300x250': [
            getBannerCode(adsiteId, step, '300x250', 1),
            getBannerCode(adsiteId, step, '300x250', 2),
            getBannerCode(adsiteId, step, '300x250', 3)
          ],
          '728x90': [
            getBannerCode(adsiteId, step, '728x90', 1),
            getBannerCode(adsiteId, step, '728x90', 2)
          ],
          '300x600': [
            getBannerCode(adsiteId, step, '300x600', 1)
          ]
        }
      };

      await adminService.saveBannerConfig(bannerConfig);
      alert('Configuração de banners salva com sucesso!');
      
    } catch (error: any) {
      alert('Erro ao salvar configuração: ' + error.message);
    }
  };

  const renderBannerField = (
    adsiteId: string, 
    step: 1 | 2, 
    bannerType: '300x250' | '728x90' | '300x600', 
    position: number,
    label: string
  ) => (
    <div key={`${bannerType}_${position}`} className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
          {bannerType}
        </span>
        <span>Posição {position}</span>
      </div>
      <textarea
        value={getBannerCode(adsiteId, step, bannerType, position)}
        onChange={(e) => handleBannerCodeChange(adsiteId, step, bannerType, position, e.target.value)}
        placeholder={`Cole aqui o código HTML do banner ${bannerType}

Exemplo:
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
<ins class="adsbygoogle" style="display:block" data-ad-format="auto"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`}
        className="w-full h-32 p-3 border border-gray-300 rounded-md text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );

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
          <h1 className="text-3xl font-bold tracking-tight">Configurar Banners</h1>
          <p className="text-muted-foreground">
            Configure os códigos dos banners para cada AdSite e Step
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banners 300x250</CardTitle>
            <Image className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Por Step (Retângulo Médio)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banners 728x90</CardTitle>
            <Image className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Por Step (Cabeçalho)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banner 300x600</CardTitle>
            <Image className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Por Step (Meia Página)</p>
          </CardContent>
        </Card>
      </div>

      {/* Seleção de AdSite */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar AdSite</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedAdSite}
            onChange={(e) => setSelectedAdSite(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Selecione um AdSite para configurar</option>
            {adsites.map(adsite => (
              <option key={adsite.id} value={adsite.id.toString()}>
                {adsite.name} ({adsite.url})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedAdSite && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab(1)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 1
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Step 1 - Banners
              </button>
              <button
                onClick={() => setActiveTab(2)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 2
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Step 2 - Banners
              </button>
            </nav>
          </div>

          {/* Configuração dos Banners */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Configurar Banners - Step {activeTab}
                </CardTitle>
                <Button onClick={() => saveBannerConfig(selectedAdSite, activeTab)}>
                  Salvar Configuração
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                Configure os códigos HTML para cada tipo e posição de banner
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banners 300x250 (3 unidades) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Banners 300x250 (Retângulo Médio) - 3 unidades
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {renderBannerField(selectedAdSite, activeTab, '300x250', 1, 'Banner 300x250 #1')}
                  {renderBannerField(selectedAdSite, activeTab, '300x250', 2, 'Banner 300x250 #2')}
                  {renderBannerField(selectedAdSite, activeTab, '300x250', 3, 'Banner 300x250 #3')}
                </div>
              </div>

              {/* Banners 728x90 (2 unidades) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Banners 728x90 (Cabeçalho) - 2 unidades
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderBannerField(selectedAdSite, activeTab, '728x90', 1, 'Banner 728x90 #1')}
                  {renderBannerField(selectedAdSite, activeTab, '728x90', 2, 'Banner 728x90 #2')}
                </div>
              </div>

              {/* Banner 300x600 (1 unidade) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Banner 300x600 (Meia Página) - 1 unidade
                </h3>
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                  {renderBannerField(selectedAdSite, activeTab, '300x600', 1, 'Banner 300x600 #1')}
                </div>
              </div>

              {/* Informações importantes */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-800 mb-2">📋 Informações Importantes:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>300x250</strong>: Retângulo médio, ideal para conteúdo</li>
                  <li>• <strong>728x90</strong>: Banner de cabeçalho/leaderboard</li>
                  <li>• <strong>300x600</strong>: Meia página, formato vertical</li>
                  <li>• Cada Step terá <strong>6 banners total</strong> (3 + 2 + 1)</li>
                  <li>• Cole o código HTML completo incluindo scripts do AdSense/Media.net</li>
                  <li>• Os banners serão exibidos aleatoriamente durante a navegação</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdvertisementsPage;