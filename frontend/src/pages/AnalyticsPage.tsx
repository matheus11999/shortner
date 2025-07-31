import React, { useState, useEffect } from 'react';
import { BarChart, PieChart, TrendingUp, Users, MousePointer, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '../services/api';

interface AnalyticsSummary {
  totalViews: number;
  uniqueViews: number;
  conversions: number;
  bannerClicks: number;
  conversionRate: string;
  ctr: string;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  topCountries: Array<{ country: string; count: number }>;
  clicksByDate: Array<{ date: string; views: number; unique_visitors: number; conversions: number }>;
  deviceStats: Array<{ device_type: string; count: number; conversions: number }>;
  adsitePerformance: Array<{ 
    adsite_name: string; 
    views: number; 
    banner_clicks: number; 
    conversions: number; 
    avg_time_spent: number;
  }>;
}

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/analytics/dashboard?period=${period}`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const response = await api.get(`/analytics/export?format=${format}&period=${period}`);
      
      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${period}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${period}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Erro ao carregar dados</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho dos seus links e conversões
          </p>
        </div>
        <div className="flex space-x-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="1y">Último ano</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}>
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData('json')}>
            Exportar JSON
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Visualizações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Links visualizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitantes Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.uniqueViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Usuários únicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.conversions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Taxa: {data.summary.conversionRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicks em Banners</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.bannerClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {data.summary.ctr}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Países */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart className="mr-2 h-4 w-4" />
              Top Países
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topCountries.slice(0, 10).map((country, index) => (
                <div key={country.country} className="flex items-center justify-between">
                  <span className="text-sm">{index + 1}. {country.country}</span>
                  <span className="text-sm font-medium">{country.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dispositivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="mr-2 h-4 w-4" />
              Dispositivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.deviceStats.map((device) => (
                <div key={device.device_type} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{device.device_type || 'Desconhecido'}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{device.count}</div>
                    <div className="text-xs text-gray-500">{device.conversions} conversões</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance dos AdSites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            Performance dos AdSites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.adsitePerformance.map((adsite) => (
              <div key={adsite.adsite_name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{adsite.adsite_name || 'AdSite Desconhecido'}</h4>
                  <div className="text-sm text-gray-500">
                    Tempo médio: {adsite.avg_time_spent || 0}s
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Visualizações</div>
                    <div className="font-medium">{adsite.views}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Clicks Banners</div>
                    <div className="font-medium">{adsite.banner_clicks}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Conversões</div>
                    <div className="font-medium">{adsite.conversions}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Atividade por Data */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade por Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.clicksByDate.slice(0, 10).map((day) => (
              <div key={day.date} className="flex items-center justify-between border-b pb-2">
                <span className="text-sm">{new Date(day.date).toLocaleDateString('pt-BR')}</span>
                <div className="text-right">
                  <div className="text-sm font-medium">{day.views} visualizações</div>
                  <div className="text-xs text-gray-500">
                    {day.unique_visitors} únicos • {day.conversions} conversões
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;