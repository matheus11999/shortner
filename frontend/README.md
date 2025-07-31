# URL Shortener com Sistema de Anúncios

Um sistema completo de encurtamento de URLs com integração de anúncios, dashboard administrativo e plugin WordPress.

## 🚀 Funcionalidades

### Para Administradores
- **Dashboard Administrativo Completo**
- **Gestão de Clientes** - Cadastro, edição e configuração de CPM personalizado
- **Gestão de AdSites** - Sites onde os anúncios serão exibidos
- **Gestão de Anúncios** - Configuração de anúncios para cada step do redirecionamento
- **Analytics Avançados** - Relatórios detalhados de performance
- **Sistema de Roles** - Controle de acesso admin/cliente

### Para Clientes
- **Dashboard do Cliente** - Visualização de estatísticas dos sites
- **Gestão de Sites** - Adicionar e configurar sites próprios
- **Código de Integração** - JavaScript para encurtamento automático de magnet links
- **Analytics Personalizados** - Métricas específicas por site

### Sistema de Redirecionamento
- **2 Steps de Anúncios** - Monetização com anúncios configuráveis
- **Integração WordPress** - Exibição automática de posts do WordPress
- **Analytics Detalhados** - Rastreamento completo de cliques e conversões
- **Responsive Design** - Interface otimizada para todos os dispositivos

### Plugin WordPress
- **Configuração Simples** - Interface administrativa intuitiva
- **Sincronização Automática** - Posts sincronizados automaticamente
- **API Integration** - Conexão segura com o sistema principal
- **Logs Detalhados** - Rastreamento de todas as operações

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - Biblioteca principal
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Chakra UI** - Componentes de interface
- **Tailwind CSS** - Utilitários de estilo
- **React Router** - Roteamento
- **Axios** - Cliente HTTP

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **SQLite3** - Banco de dados
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **CORS** - Cross-origin resource sharing
- **Helmet** - Segurança HTTP
- **Rate Limiting** - Proteção contra ataques

### Plugin WordPress
- **PHP** - Linguagem principal
- **WordPress API** - Integração nativa
- **JavaScript/jQuery** - Interface administrativa
- **CSS** - Estilos personalizados

## 📦 Instalação e Execução

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- PHP 7.4+ (para plugin WordPress)

### 1. Clone e Configure
```bash
git clone <url-do-repositorio>
cd url-shortener
```

### 2. Instale Dependências
```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 3. Configure Ambiente
```bash
# Frontend
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Backend (já configurado no server/.env)
```

### 4. Execute o Projeto
```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
npm run dev
```

### 5. Acesse a Aplicação
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Admin**: admin@urlshortener.com / admin123

## 🔌 Plugin WordPress

### Instalação
1. Copie pasta `wordpress-plugin` para `wp-content/plugins/`
2. Renomeie para `url-shortener-adsite`
3. Ative no painel administrativo

### Configuração
1. Acesse **Configurações > URL Shortener**
2. Configure **URL da API**: `http://seu-dominio.com:3001/api`
3. Configure **Token da API** (obtido no dashboard admin)
4. Teste conexão e configure sincronização

## 📊 Como Usar

### Configuração Admin
1. **Login**: admin@urlshortener.com / admin123
2. **Criar AdSites**: Sites onde anúncios serão exibidos
3. **Criar Anúncios**: Step 1 e Step 2 (Banner, Texto, HTML, Vídeo)
4. **Cadastrar Clientes**: Com CPM personalizado

### Configuração Cliente
1. **Adicionar Sites**: No dashboard do cliente
2. **Código Integração**: JavaScript para magnet links
3. **Vincular AdSites**: Admin define quais anúncios usar

### Fluxo de Funcionamento
1. **Magnet link** → **JavaScript intercepta**
2. **Encurta URL** → **Redireciona para anúncios**
3. **Step 1**: Anúncios + botão "Continuar" (5s)
4. **Step 2**: Anúncios + botão "Download" (5s)
5. **Download**: Redirecionamento final

## 🔧 API Principais

### Autenticação
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados usuário
- `POST /api/auth/register` - Registro

### Admin
- `GET/POST/PUT/DELETE /api/admin/clients` - Gestão clientes
- `GET/POST/PUT/DELETE /api/admin/adsites` - Gestão adsites  
- `GET/POST/PUT/DELETE /api/admin/advertisements` - Gestão anúncios

### Cliente
- `GET/POST/PUT/DELETE /api/client/sites` - Gestão sites
- `GET /api/client/sites/:id/integration-code` - Código integração

### URLs & Analytics
- `POST /api/urls/shorten` - Encurtar URL
- `GET /:code` - Redirecionamento com anúncios
- `GET /api/analytics/dashboard` - Analytics geral

## 📁 Estrutura

```
url-shortener/
├── src/                    # Frontend React
│   ├── components/        # Componentes
│   ├── pages/            # Páginas
│   ├── services/         # APIs
│   └── types/           # TypeScript
├── server/               # Backend Node.js
│   ├── routes/          # Rotas API
│   ├── config/          # Configurações
│   └── middleware/      # Middlewares
├── wordpress-plugin/     # Plugin WordPress
└── README.md
```

## ✅ Funcionalidades Implementadas

- ✅ Sistema completo de autenticação JWT
- ✅ Dashboard administrativo com gestão de clientes
- ✅ Dashboard do cliente com analytics
- ✅ Sistema de encurtamento de URLs
- ✅ Redirecionamento com 2 steps de anúncios
- ✅ Plugin WordPress completo
- ✅ Integração automática com posts WordPress
- ✅ Sistema de analytics detalhado
- ✅ Código JavaScript de integração
- ✅ Interface responsiva com Chakra UI + Tailwind
- ✅ Banco de dados SQLite3 com schemas completos
- ✅ APIs RESTful com segurança
- ✅ Sistema de roles (admin/cliente)

## 🔒 Segurança

- JWT Authentication
- bcrypt para senhas
- Rate limiting
- CORS configurado
- Headers de segurança (Helmet)
- Validação de inputs
- SQL injection protection

## 🚀 Performance

- Lazy loading de componentes
- Code splitting
- Cache de dados
- Otimização de imagens
- Minificação CSS/JS
- Responsive design

## 📝 Licença

MIT License - Desenvolvido para otimizar monetização de magnet links

---

**Sistema completo e otimizado para performance e segurança** 🚀
