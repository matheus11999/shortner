# URL Shortener - Sistema Completo de Encurtamento de URLs com Anúncios

## 📋 Descrição do Projeto

Sistema completo de encurtamento de URLs com sistema de monetização através de anúncios intercalados. O projeto permite criar URLs encurtadas e magnet links que exibem anúncios step-by-step antes de redirecionar para o destino final.

## 🏗️ Arquitetura Técnica

### Backend (Node.js + Express.js + PostgreSQL)
- **Runtime**: Node.js + Express.js
- **Database**: PostgreSQL (migrado de SQLite para produção)
- **Authentication**: JWT + bcryptjs
- **Security**: Helmet, Rate Limiting, CORS configurado para produção
- **Port**: 3001 (produção via EasyPanel)
- **Deploy**: Automatizado via webhook EasyPanel

### Frontend (React + TypeScript + Vite)
- **Framework**: React 19 + TypeScript + Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: TailwindCSS v3.4
- **Roteamento**: React Router v7
- **Estado**: React Context API
- **HTTP Client**: Axios
- **Icons**: Lucide React

### WordPress Plugin (PHP)
- **Localização**: `/backend/wordpress-plugin/`
- **Arquivo Principal**: `url-shortener-adsite.php`
- **Funcionalidades**: Integração com API, configuração de AdSites, sistema de auto-update
- **Versão Atual**: 1.8.2

## 📁 Estrutura de Diretórios

```
url-shortner/
├── backend/                    # Backend Node.js + Express
│   ├── server.js              # Servidor principal
│   ├── package.json           # Dependências backend
│   ├── config/
│   │   └── database.js        # Configuração PostgreSQL
│   ├── routes/                # Rotas da API
│   │   ├── auth.js           # Autenticação
│   │   ├── admin.js          # Rotas administrativas
│   │   ├── client.js         # Rotas de cliente
│   │   ├── redirect.js       # Sistema de redirecionamento
│   │   ├── urls.js           # Gerenciamento de URLs
│   │   └── analytics.js      # Sistema de analytics
│   ├── middleware/            # Middlewares Express
│   │   └── auth.js           # Autenticação JWT e tokens
│   ├── utils/                 # Utilitários
│   │   └── analytics.js      # Utils de analytics
│   └── wordpress-plugin/      # Plugin WordPress
│       ├── url-shortener-adsite.php
│       ├── includes/          # Classes PHP
│       │   ├── class-admin.php
│       │   ├── class-api.php
│       │   ├── class-updater.php
│       │   └── class-frontend.php
│       └── assets/            # CSS/JS do plugin
├── frontend/                  # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Componentes shadcn/ui
│   │   │   ├── admin/        # Componentes administrativos
│   │   │   └── common/       # Componentes compartilhados
│   │   ├── contexts/         # React Contexts
│   │   ├── pages/            # Páginas da aplicação
│   │   │   ├── admin/        # Páginas administrativas
│   │   │   └── client/       # Páginas de cliente
│   │   ├── services/         # Serviços de API
│   │   ├── types/            # Definições TypeScript
│   │   └── lib/              # Utilitários
│   ├── package.json          # Dependências frontend
│   └── vite.config.ts        # Configuração Vite
└── CLAUDE.md                 # Esta documentação
```

## 🔐 Credenciais de Acesso

### Administrador Padrão
- **Email**: `admin@urlshortener.com`
- **Senha**: `admin123`
- **Papel**: admin

### URLs do Sistema

#### Produção (EasyPanel)
- **Backend API**: `https://evoapi-backend-url.ttvjwi.easypanel.host/api`
- **Frontend**: `https://evoapi-frontend-url.ttvjwi.easypanel.host`
- **Deploy**: Automatizado via webhook EasyPanel

#### Desenvolvimento
- **Backend**: `http://localhost:3001`
- **Frontend**: `http://localhost:5174`

## 🚀 Funcionalidades Implementadas

### ✅ Sistema de Autenticação
- Login/logout com JWT
- Registro de novos usuários
- Proteção de rotas por papel (admin/client)
- Context de autenticação global
- Tratamento de erros aprimorado

### ✅ Interface Administrativa Completa
- Dashboard com métricas
- **Gerenciamento de Clientes**: CRUD completo, filtros e busca
- **Gerenciamento de AdSites**: Configuração de sites de anúncios, integração WordPress
- **Gerenciamento de Anúncios**: Configuração Step 1 e Step 2, múltiplos tipos (banner, texto, HTML, vídeo)
- **Download Plugin WordPress**: Interface para baixar e configurar plugin
- Modal de criação/edição para todos os recursos

### ✅ Sistema de Banco de Dados PostgreSQL
- **Tabelas**: users, adsites, client_sites, banner_configs, advertisements, short_urls, click_analytics, session_analytics, banner_clicks, client_analytics, unique_visitors, wp_posts_cache
- **Migração**: Completa para PostgreSQL com tipos de dados otimizados
- **Criação automática**: Admin padrão e estruturas de tabela
- **APIs corrigidas**: Todas funcionais com PostgreSQL
- **Sistema de banner_configs**: Configuração específica de banners por AdSite

### ✅ Sistema de Banner Management
- **Configuração específica por AdSite e Step**: 3x 300x250, 2x 728x90, 1x 300x600
- **Interface administrativa**: Removido banner_code dos AdSites, movido para página Advertisements
- **Gerenciamento granular**: Banner configs por tipo, posição e step
- **Backend atualizado**: APIs PostgreSQL para CRUD de banner_configs

### ✅ Sistema de Magnet Link Interception  
- **Client Sites Management**: Admin pode criar sites para clientes
- **Código de Integração**: JavaScript gerado automaticamente para cada site
- **Interceptação**: Script intercepta magnet links e redireciona via GET
- **Endpoint /magnet**: Descriptografa Base64 e redireciona através de AdSites
- **Sem banco**: Magnet links não são salvos, apenas redirecionados

### ✅ Plugin WordPress Atualizado (v1.8.2)
- **Sistema de auto-update**: Força download mesmo com mesma versão
- **Validação de token**: Apenas AdSites ativos podem baixar
- **Sistema de zip**: Backend cria ZIP do plugin com validação
- **Classe updater**: Implementa force_update com timestamp
- **Interface administrativa**: Melhorada com conexão em tempo real
- **Status de conexão**: Tempo real com feedback visual
- **Teste de conectividade**: Com validação de AdSite token

### ✅ Sistema de Analytics PostgreSQL
- **Click Analytics**: Rastreamento completo de interações
- **Session Analytics**: Dados de sessão detalhados
- **Banner Clicks**: Tracking específico de clicks em banners
- **Client Analytics**: Métricas diárias por cliente
- **Unique Visitors**: Controle de visitantes únicos
- **Dashboard**: Interface completa para visualização

## 🔧 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Usuário atual
- `POST /api/auth/refresh-token` - Refresh token

### Administração
**Clientes:**
- `GET /api/admin/clients` - Listar clientes
- `POST /api/admin/clients` - Criar cliente
- `PUT /api/admin/clients/:id` - Atualizar cliente
- `DELETE /api/admin/clients/:id` - Deletar cliente

**AdSites:**
- `GET /api/admin/adsites` - Listar AdSites
- `POST /api/admin/adsites` - Criar AdSite
- `PUT /api/admin/adsites/:id` - Atualizar AdSite
- `DELETE /api/admin/adsites/:id` - Deletar AdSite

**Banner Configs:**
- `GET /api/admin/banner-configs/:adsiteId` - Listar configurações de banner por AdSite
- `POST /api/admin/banner-configs` - Salvar configurações de banner
- `PUT /api/admin/banner-configs/:id` - Atualizar configuração específica
- `DELETE /api/admin/banner-configs/:id` - Deletar configuração específica

**Client Sites:**
- `GET /api/admin/client-sites` - Listar sites dos clientes
- `POST /api/admin/client-sites` - Criar site para cliente
- `PUT /api/admin/client-sites/:id` - Atualizar site do cliente
- `DELETE /api/admin/client-sites/:id` - Deletar site do cliente

**WordPress Plugin:**
- `GET /api/admin/wordpress-plugin-version?force_update=true` - Versão do plugin (com force update)
- `GET /api/admin/wordpress-plugin-changelog` - Changelog do plugin
- `GET /api/admin/wordpress-plugin-download` - Download ZIP do plugin (token validado)

**Magnet Links:**
- `GET /magnet?code=<integration_code>&m=<encrypted_magnet>` - Endpoint para magnet links
- `GET /api/client/sites/:id/integration-code` - Obter código de integração JavaScript

### Analytics
- `POST /api/analytics/track` - Registrar evento de analytics
- `POST /api/analytics/wordpress` - Analytics do WordPress
- `GET /api/analytics/dashboard` - Dashboard geral
- `GET /api/analytics/client/:siteId` - Analytics por cliente
- `GET /api/analytics/summary` - Resumo geral (admin)
- `GET /api/analytics/export` - Exportar dados

## 🛠️ Scripts Disponíveis

### Frontend
```bash
cd frontend
npm install         # Instalar dependências
npm run dev         # Servidor de desenvolvimento
npm run build       # Build para produção
npm run preview     # Preview do build
npm run lint        # Linting com ESLint
```

### Backend
```bash
cd backend
npm install         # Instalar dependências
npm start           # Iniciar servidor (produção)
npm run dev         # Iniciar com nodemon (desenvolvimento)
```

## ⚙️ Configuração de Desenvolvimento

### Dependências Principais
**Frontend:**
- React 19.1.0
- TypeScript 5.8.3
- TailwindCSS 3.4.0
- shadcn/ui components
- Vite 7.0.4

**Backend:**
- Express.js 4.18.2
- PostgreSQL (pg 8.11.3)
- JWT + bcryptjs
- Archiver 7.0.1 (para ZIP do plugin)

### Variáveis de Ambiente
**Backend (.env):**
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://mateus:260520jm@evoapi_url-db:5432/url?sslmode=disable
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=https://frontend-url.com
BCRYPT_ROUNDS=12
```

**Frontend (.env):**
```env
VITE_API_URL=https://backend-url.com/api
VITE_APP_TITLE=URL Shortener
VITE_APP_VERSION=1.0.0
```

## 📊 Status do Projeto

### ✅ Concluído
- ✅ Migração completa do Chakra UI para shadcn/ui
- ✅ Sistema de autenticação funcional
- ✅ Interface administrativa completa com CRUD
- ✅ Build funcionando sem erros
- ✅ Plugin WordPress atualizado e funcional (v1.8.2)
- ✅ Sistema de banner management específico (6 banners por step)
- ✅ Sistema de magnet link interception completo
- ✅ Client sites management (admin e client views)
- ✅ JavaScript integration code generation
- ✅ Endpoint /magnet para redirecionamento sem database storage
- ✅ Sistema de analytics PostgreSQL completo
- ✅ Sistema de auto-update do plugin com force_update
- ✅ Sistema de zip do plugin com validação de token
- ✅ Migração completa para PostgreSQL

### 🚧 Melhorias Futuras (Opcional)
1. Dashboard com gráficos avançados
2. Sistema de notificações push
3. API rate limiting mais granular
4. Cache system (Redis) para performance
5. Mobile app integration
6. Webhook system para terceiros
7. Sistema de relatórios PDF
8. Integração com Google Analytics

## 🔄 Principais Funcionalidades do Sistema

### 1. Sistema de Magnet Link Interception
1. **Admin cria sites** para clientes via interface administrativa
2. **Cliente visualiza seus sites** e pode copiar código de integração JavaScript
3. **JavaScript intercepta** todos os magnet links da página automaticamente
4. **Criptografia Base64** dos magnet links no client-side por segurança
5. **Redirecionamento via GET** para `servidor.com/magnet?code=<site_code>&m=<encrypted_magnet>`
6. **Exibição de anúncios** baseado no AdSite atribuído ao cliente (Step 1 → Step 2)
7. **Redirecionamento final** para o magnet link original após anúncios

### 2. Sistema de Banner Management
1. **6 banners específicos por step**: 3x 300x250, 2x 728x90, 1x 300x600
2. **Configuração granular** por AdSite, Step, Tipo e Posição
3. **Interface administrativa** na página Advertisements
4. **Remoção do campo banner_code** da criação de AdSites
5. **API PostgreSQL dedicada** para gerenciamento de banner_configs

### 3. Sistema de Auto-Update do Plugin WordPress
1. **Force Update**: Permite forçar download mesmo com mesma versão
2. **Validação de Token**: Apenas AdSites ativos podem baixar o plugin
3. **Sistema de ZIP**: Backend cria ZIP em tempo real com validação
4. **Cache Inteligente**: Cache reduzido para force_update
5. **Versionamento Dinâmico**: Adiciona timestamp para força atualização

### 4. Sistema de Analytics PostgreSQL
1. **Click Analytics**: Rastreamento detalhado de cada interação
2. **Session Analytics**: Dados completos de sessão do usuário
3. **Banner Clicks**: Tracking específico de clicks em banners
4. **Client Analytics**: Métricas diárias agregadas por cliente
5. **Unique Visitors**: Controle de visitantes únicos por IP/sessão
6. **Dashboard Completo**: Interface rica para visualização de dados

## 🔥 Fluxo Completo do Sistema

### Para Administrador:
1. **Login** no sistema com credenciais admin
2. **Criar cliente** na interface administrativa
3. **Criar AdSite** e configurar URLs/tokens
4. **Configurar banners** para o AdSite (Step 1 e Step 2 - 6 banners cada)
5. **Criar site do cliente** e atribuir AdSite
6. **Fornecer código de integração** JavaScript para o cliente
7. **Monitorar analytics** via dashboard administrativo

### Para Cliente:
1. **Login** no sistema com credenciais de cliente
2. **Visualizar seus sites** na interface de cliente
3. **Copiar código de integração** JavaScript
4. **Integrar código** no seu site/blog
5. **Visualizar analytics** dos seus sites
6. **Acompanhar performance** e estatísticas

### Para Usuário final:
1. **Clica em magnet link** no site do cliente
2. **JavaScript intercepta** automaticamente o link
3. **Redireciona** para sistema de anúncios
4. **Visualiza Step 1** com anúncios (timer + clicks opcionais)
5. **Prossegue para Step 2** com mais anúncios
6. **Download é liberado** após completar os steps
7. **Analytics são registrados** durante todo o processo

## 🐘 Configuração PostgreSQL

### Produção (EasyPanel)
```
Host: evoapi_url-db
Port: 5432
Database: url
User: mateus
Password: 260520jm
SSL: disabled
```

### Desenvolvimento
```
Host: 89.28.236.67
Port: 5555
Database: url
User: mateus
Password: 260520jm
SSL: disabled
```

## 🚀 Deploy e Produção

### Backend (EasyPanel)
- URL: `https://evoapi-backend-url.ttvjwi.easypanel.host`
- Deploy automático via webhook
- PostgreSQL integrado
- SSL/HTTPS configurado

### Frontend (EasyPanel)
- URL: `https://evoapi-frontend-url.ttvjwi.easypanel.host`
- Build automático do React
- Servido via Nginx
- SSL/HTTPS configurado

### WordPress Plugin
- Versão: 1.8.2
- Auto-update habilitado
- Force update implementado
- Token validation ativa
- ZIP generation em tempo real

---

## 📞 Suporte e Manutenção

### Logs importantes:
- Backend: Logs detalhados no console
- PostgreSQL: Logs de queries quando necessário
- WordPress: Logs via error_log do PHP
- Frontend: Console do navegador para debug

### Monitoramento:
- Analytics em tempo real via dashboard
- Status de conexão do WordPress plugin
- Métricas de performance PostgreSQL
- Logs de auto-update do plugin

### Backup:
- PostgreSQL: Backup automático (EasyPanel)
- Plugin: Versionamento via Git
- Frontend: Build artifacts preservados

Este sistema está completamente funcional e pronto para produção! 🎉