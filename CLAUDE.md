# URL Shortener - Sistema de Encurtamento de URLs com Anúncios

## Descrição do Projeto
Sistema completo de encurtamento de URLs com sistema de monetização através de anúncios intercalados. O projeto permite que usuários criem URLs encurtadas que exibem anúncios antes de redirecionar para o destino final.

## Arquitetura Técnica

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **UI Components**: shadcn/ui (migrado do Chakra UI)
- **Styling**: TailwindCSS v3.4
- **Roteamento**: React Router v7
- **Estado**: React Context API
- **HTTP Client**: Axios
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js + Express.js
- **Database**: SQLite com better-sqlite3
- **Authentication**: JWT + bcryptjs
- **Security**: Helmet, Rate Limiting, CORS
- **Port**: 3001

### WordPress Plugin
- **Localização**: `/wordpress-plugin/`
- **Arquivo Principal**: `url-shortener-adsite.php`
- **Funcionalidades**: Integração com API, sincronização de posts, gerenciamento de configurações

## Estrutura de Diretórios

```
url-shortner/
├── src/                     # Frontend React
│   ├── components/
│   │   ├── ui/             # Componentes shadcn/ui
│   │   ├── admin/          # Componentes administrativos
│   │   └── common/         # Componentes compartilhados
│   ├── contexts/           # React Contexts
│   ├── pages/              # Páginas da aplicação
│   ├── services/           # Serviços de API
│   ├── types/              # Definições TypeScript
│   └── lib/                # Utilitários
├── server/                 # Backend Node.js
│   ├── config/             # Configurações
│   ├── routes/             # Rotas da API
│   └── database.sqlite     # Banco de dados
└── wordpress-plugin/       # Plugin WordPress
    ├── includes/           # Classes PHP
    └── assets/             # CSS/JS do plugin
```

## Credenciais de Acesso

### Administrador Padrão
- **Email**: `admin@urlshortener.com`
- **Senha**: `admin123`
- **Papel**: admin

### URLs do Sistema
- **Frontend**: `http://localhost:5174/`
- **Backend API**: `http://localhost:3001/api`

## Funcionalidades Implementadas

### ✅ Sistema de Autenticação
- Login/logout com JWT
- Registro de novos usuários
- Proteção de rotas por papel (admin/client)
- Context de autenticação global
- Tratamento de erros melhorado

### ✅ Interface Administrativa Completa
- Dashboard com métricas
- **Gerenciamento de Clientes**: CRUD completo, filtros e busca
- **Gerenciamento de AdSites**: Configuração de sites de anúncios, integração WordPress
- **Gerenciamento de Anúncios**: Configuração Step 1 e Step 2, múltiplos tipos (banner, texto, HTML, vídeo)
- **Download Plugin WordPress**: Interface para baixar e configurar plugin
- Modal de criação/edição para todos os recursos

### ✅ Sistema de Banco de Dados
- Tabelas: users, adsites, client_sites, banner_configs, advertisements, short_urls, click_analytics
- Migração completa para better-sqlite3
- Criação automática do admin padrão
- APIs corrigidas e funcionais
- Sistema de banner_configs para configuração específica de banners

### ✅ Sistema de Banner Management
- **Configuração específica por AdSite e Step**: 3x 300x250, 2x 728x90, 1x 300x600
- **Interface administrativa**: Removido banner_code dos AdSites, movido para página Advertisements
- **Gerenciamento granular**: Banner configs por tipo, posição e step
- **Backend atualizado**: APIs para CRUD de banner_configs

### ✅ Sistema de Magnet Link Interception  
- **Client Sites Management**: Admin pode criar sites para clientes
- **Código de Integração**: JavaScript gerado automaticamente para cada site
- **Interceptação**: Script intercepta magnet links e redireciona via GET
- **Endpoint /magnet**: Descriptografa Base64 e redireciona através de AdSites
- **Sem banco**: Magnet links não são salvos, apenas redirecionados

### ✅ Plugin WordPress Atualizado
- Classe de administração melhorada
- Integração com nova API de banner_configs
- Status de conexão em tempo real
- Sincronização de posts atualizada
- Interface responsiva e moderna
- Teste de conectividade com feedback visual

## API Endpoints

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

**Magnet Links:**
- `GET /magnet?code=<integration_code>&m=<encrypted_magnet>` - Endpoint para magnet links
- `GET /api/client/sites/:id/integration-code` - Obter código de integração JavaScript

**WordPress:**
- `GET /api/admin/wordpress-plugin` - Download do plugin

## Scripts Disponíveis

### Frontend
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build
npm run lint         # Linting com ESLint
```

### Backend
```bash
cd server
node server.js       # Inicia o servidor backend
```

## Configuração de Desenvolvimento

### Dependências Principais
- React 19.1.0
- TypeScript 5.8.3
- TailwindCSS 3.4.0
- shadcn/ui components
- Express.js 5.1.0
- better-sqlite3 5.1.7

### Variáveis de Ambiente
```env
PORT=3001
CLIENT_URL=http://localhost:5174
JWT_SECRET=your-secret-key
```

## Status do Projeto

### ✅ Concluído
- Migração completa do Chakra UI para shadcn/ui
- Sistema de autenticação funcional
- Interface administrativa completa com CRUD
- Build funcionando sem erros
- Plugin WordPress atualizado e funcional
- Sistema de banner management específico (6 banners por step)
- Sistema de magnet link interception completo
- Client sites management (admin e client views)
- JavaScript integration code generation
- Endpoint /magnet para redirecionamento sem database storage

### 🔄 Pendente para Finalização
- **Step1/Step2 Pages**: Design responsivo e modo escuro
- **WordPress Plugin**: Integração completa com magnet links
- **Analytics detalhado**: Métricas avançadas e relatórios
- **Testes**: Sistema de testes automatizados

### 📋 Melhorias Futuras (Opcional)
1. Sistema de URLs encurtadas tradicionais
2. Dashboard com gráficos avançados
3. Sistema de notificações
4. API rate limiting mais granular
5. Cache system para performance
6. Mobile app integration
7. Webhook system para terceiros

## Comandos de Build/Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar desenvolvimento (Frontend)
npm run dev

# Iniciar backend
cd server && node server.js

# Build para produção
npm run build

# Testar build
npm run preview
```

## Observações Técnicas

### Migração UI
- Removido: Chakra UI v3 (incompatibilidades)
- Adicionado: shadcn/ui com Radix UI primitives
- Benefícios: Melhor performance, acessibilidade, customização

### Banco de Dados
- SQLite para simplicidade de desenvolvimento
- better-sqlite3 para performance síncrona
- Criação automática de tabelas e admin

### Plugin WordPress
- Estrutura modular com classes PHP
- Integração via REST API atualizada para banner_configs
- Sincronização automática de posts
- Interface administrativa no WP Admin responsiva
- Status de conexão em tempo real
- Teste de conectividade com feedback visual

## Principais Funcionalidades do Sistema

### Sistema de Magnet Link Interception
1. **Admin cria sites** para clientes via interface administrativa
2. **Cliente visualiza seus sites** e pode copiar código de integração
3. **JavaScript intercepta** todos os magnet links da página
4. **Criptografia Base64** dos magnet links no client-side
5. **Redirecionamento via GET** para `servidor.com/magnet?code=<site_code>&m=<encrypted_magnet>`
6. **Exibição de anúncios** baseado no AdSite atribuído ao cliente
7. **Redirecionamento final** para o magnet link original

### Sistema de Banner Management
1. **6 banners específicos por step**: 3x 300x250, 2x 728x90, 1x 300x600
2. **Configuração granular** por AdSite, Step, Tipo e Posição
3. **Interface administrativa** na página Advertisements
4. **Remoção do campo banner_code** da criação de AdSites
5. **API dedicada** para gerenciamento de banner_configs

### Fluxo Completo do Sistema
1. Admin cria cliente e AdSite
2. Admin configura banners para o AdSite (Step 1 e Step 2)
3. Admin cria site do cliente e atribui AdSite
4. Cliente copia código de integração JavaScript
5. Usuário clica em magnet link no site do cliente
6. Sistema exibe Step 1 → Step 2 → Redireciona para magnet
7. Analytics são coletados durante todo o processo