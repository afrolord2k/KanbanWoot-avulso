# 📚 Guia Completo do KanbanWoot

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Instalação e Configuração](#instalação-e-configuração)
- [Funcionalidades](#funcionalidades)
- [Deployment](#deployment)
- [Integração com Chatwoot](#integração-com-chatwoot)
- [Troubleshooting](#troubleshooting)
- [API e Endpoints](#api-e-endpoints)

---

## 🎯 Visão Geral

KanbanWoot é uma interface web Kanban integrada ao **Chatwoot**, que permite visualizar e gerenciar contatos através de um board drag-and-drop usando campos customizados do tipo lista.

### Tecnologias Utilizadas
- **Frontend**: React 18 + Hooks
- **Drag-and-Drop**: @hello-pangea/dnd
- **Estilos**: CSS-in-JS (inline styles)
- **API**: Chatwoot REST API v1
- **Build**: Create React App (Webpack)
- **Servidor Produção**: Nginx
- **Container**: Docker multi-stage
- **Orquestração**: Kubernetes (K3s)

---

## 🏗️ Arquitetura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────┐
│                   KanbanWoot                        │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           App.jsx (Root)                     │  │
│  │                                              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │     KanbanBoardFull.jsx                │ │  │
│  │  │                                        │ │  │
│  │  │  • State Management (useState)         │ │  │
│  │  │  • API Calls (fetch)                   │ │  │
│  │  │  • Drag-and-Drop Logic                 │ │  │
│  │  │  • Responsive Detection                │ │  │
│  │  │                                        │ │  │
│  │  │  ┌──────────────────────────────────┐ │ │  │
│  │  │  │  DragDropContext                 │ │ │  │
│  │  │  │   └─> Droppable (Colunas)        │ │ │  │
│  │  │  │        └─> Draggable (Cards)     │ │ │  │
│  │  │  └──────────────────────────────────┘ │ │  │
│  │  │                                        │ │  │
│  │  │  ┌──────────────────────────────────┐ │ │  │
│  │  │  │  Modal de Detalhes               │ │ │  │
│  │  │  │  • Informações do Contato        │ │ │  │
│  │  │  │  • Atributos Customizados        │ │ │  │
│  │  │  │  • Link para Chatwoot            │ │ │  │
│  │  │  └──────────────────────────────────┘ │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↕ API REST
┌─────────────────────────────────────────────────────┐
│              Chatwoot Backend                       │
│  • GET /api/v1/accounts/1/contacts                  │
│  • GET /api/v1/accounts/1/custom_attribute_def...   │
│  • PUT /api/v1/accounts/1/contacts/:id              │
└─────────────────────────────────────────────────────┘
```

### Fluxo de Dados

```
1. Carregamento Inicial
   ├─> Fetch Custom Attribute Definitions
   │   └─> Filtrar apenas tipo "list" e model "contact_attribute"
   │       └─> Selecionar atributo (URL param ou kbw_* ou primeiro)
   │
   ├─> Fetch Contacts
   │   └─> Distribuir contatos em colunas baseado em custom_attributes
   │
   └─> Renderizar Board

2. Drag-and-Drop
   ├─> onDragEnd event
   │   ├─> Atualizar estado local (otimista)
   │   ├─> PUT /contacts/:id com novo valor
   │   └─> Em caso de erro: reverter estado local
   │
   └─> Atualização refletida no Chatwoot

3. Detalhes do Card
   ├─> Click em botão 👁️
   ├─> Abrir modal com dados completos
   └─> Link para abrir perfil no Chatwoot
```

---

## ⚙️ Instalação e Configuração

### 1. Desenvolvimento Local

```bash
# Clone o repositório
git clone <repo-url>
cd KanbanWoot

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cat > .env << EOF
REACT_APP_CHATWOOT_TOKEN=seu_token_aqui
REACT_APP_CHATWOOT_ACCOUNT_ID=1
REACT_APP_CHATWOOT_URL=http://195.35.19.73:30080
REACT_APP_DEBUG=true
EOF

# Iniciar servidor de desenvolvimento
npm start
```

Acesse: http://localhost:3000

### 2. Produção - Systemd (Porta 3005)

```bash
# Criar serviço systemd
sudo nano /etc/systemd/system/kanbanwoot.service
```

Conteúdo:
```ini
[Unit]
Description=KanbanWoot - Kanban Board for Chatwoot
After=network.target

[Service]
Type=simple
User=agents
WorkingDirectory=/home/agents/KanbanWoot
Environment="HOST=0.0.0.0"
Environment="PORT=3005"
Environment="REACT_APP_CHATWOOT_URL=http://195.35.19.73:30080"
Environment="REACT_APP_CHATWOOT_ACCOUNT_ID=1"
Environment="REACT_APP_CHATWOOT_TOKEN=seu_token_aqui"
Environment="REACT_APP_DEBUG=false"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar
sudo systemctl daemon-reload
sudo systemctl enable kanbanwoot
sudo systemctl start kanbanwoot

# Verificar status
sudo systemctl status kanbanwoot

# Ver logs em tempo real
sudo journalctl -u kanbanwoot -f

# Abrir porta no firewall
sudo ufw allow 3005/tcp
```

Acesse: http://195.35.19.73:3005

### 3. Produção - Docker + Kubernetes (Porta 30305)

#### Build da Imagem
```bash
# Build
docker build -t kanbanwoot:latest -f Dockerfile .

# Importar para K3s
docker save kanbanwoot:latest | sudo k3s ctr images import -
```

#### Deploy no Kubernetes
```bash
# Aplicar recursos
kubectl apply -f k8s-deployment.yaml

# Verificar status
kubectl get all -n kanbanwoot

# Ver logs
kubectl logs -n kanbanwoot -l app=kanbanwoot -f

# Abrir porta no firewall
sudo ufw allow 30305/tcp
```

Acesse: http://195.35.19.73:30305

#### Atualizar Deployment
```bash
# Após fazer mudanças no código:
npm run build
docker build -t kanbanwoot:latest -f Dockerfile .
docker save kanbanwoot:latest | sudo k3s ctr images import -
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot

# Verificar rollout
kubectl rollout status deployment/kanbanwoot -n kanbanwoot
```

---

## 🎨 Funcionalidades

### 1. Board Kanban Dinâmico

**Colunas:**
- Geradas automaticamente a partir dos valores do atributo customizado
- Coluna especial "Não definido" para contatos sem valor
- Contador de contatos em cada coluna

**Atributos Suportados:**
- Apenas atributos customizados do tipo `list` (dropdown)
- Apenas atributos de `contact_attribute` (não conversation)
- Dropdown para alternar entre múltiplos atributos

**Exemplo de URL:**
```
http://195.35.19.73:30305/?kbw=kbw_funil_status
http://195.35.19.73:30305/?kbw=kbw_prioridade
```

### 2. Drag-and-Drop

**Como Funciona:**
1. Usuário arrasta card da coluna A para coluna B
2. Interface atualiza imediatamente (otimista)
3. API PUT para atualizar `custom_attributes` do contato
4. Se falhar, reverte mudança local

**Mover para "Não definido":**
- Remove a chave do atributo (valor `null`)
- Contato fica sem valor definido para aquele atributo

**Código:**
```javascript
// Atualização otimista
setColumns(newColumns);

// API call
await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${id}`, {
  method: 'PUT',
  body: JSON.stringify({
    custom_attributes: {
      [attribute_key]: newValue // ou null para "Não definido"
    }
  })
});
```

### 3. Modal de Detalhes

**Trigger:** Botão 👁️ no canto superior direito do card

**Informações Exibidas:**
- Nome completo
- Email
- Telefone (se disponível)
- ID do contato
- Todos os atributos customizados com badges coloridos
- Botão "Abrir no Chatwoot" (link direto)

**Comportamento:**
- Desktop: Modal centralizado
- Mobile: Bottom sheet (desliza de baixo para cima)
- Fechar: Click fora ou botão X
- Animações suaves

### 4. Responsividade

**Breakpoints:**
```javascript
Mobile:  ≤768px   (Colunas 90% largura, scroll snap, sticky headers)
Tablet:  769-1024px (Colunas 45% largura, 2 por tela)
Desktop: >1024px   (Colunas fixas 280-320px)
```

**Mobile Features:**
- ✅ Scroll horizontal com snap nas colunas
- ✅ Header fixo ao scrollar
- ✅ Títulos das colunas fixos
- ✅ Cards maiores (80px mínimo)
- ✅ Botão detalhes destacado (azul)
- ✅ Modal bottom sheet animado
- ✅ Touch-friendly (touchAction: none)

**Tablet Features:**
- ✅ 2 colunas visíveis por vez
- ✅ Gaps otimizados
- ✅ Layout híbrido

**Desktop Features:**
- ✅ Múltiplas colunas lado a lado
- ✅ Hover effects
- ✅ Scrollbar customizada

### 5. Detecção Dinâmica de Tela

```javascript
const [screenSize, setScreenSize] = useState({
  width: window.innerWidth,
  isMobile: window.innerWidth <= 768,
  isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
  isDesktop: window.innerWidth > 1024
});

// Atualiza ao redimensionar
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

## 🔌 API e Endpoints

### Chatwoot REST API v1

**Base URL:** `http://195.35.19.73:30080/api/v1/accounts/1`

**Headers Obrigatórios:**
```javascript
{
  'Content-Type': 'application/json',
  'api_access_token': 'seu_token_aqui'
}
```

### Endpoints Utilizados

#### 1. Listar Atributos Customizados
```http
GET /custom_attribute_definitions
```

**Resposta:**
```json
[
  {
    "id": 1,
    "attribute_display_name": "Status do Funil",
    "attribute_display_type": "list",
    "attribute_key": "kbw_funil_status",
    "attribute_model": "contact_attribute",
    "attribute_values": ["Novo", "Contato Inicial", "Proposta Enviada"]
  }
]
```

**Filtro aplicado:**
- `attribute_display_type === 'list'`
- `attribute_model === 'contact_attribute'`

#### 2. Listar Contatos
```http
GET /contacts
```

**Resposta:**
```json
{
  "payload": [
    {
      "id": 4,
      "name": "João Silva",
      "email": "joao@example.com",
      "phone_number": "+5511999999001",
      "custom_attributes": {
        "kbw_funil_status": "Novo",
        "kbw_prioridade": "Alta"
      }
    }
  ]
}
```

#### 3. Atualizar Atributo do Contato
```http
PUT /contacts/:id
Content-Type: application/json

{
  "custom_attributes": {
    "kbw_funil_status": "Proposta Enviada"
  }
}
```

**Para remover atributo (mover para "Não definido"):**
```json
{
  "custom_attributes": {
    "kbw_funil_status": null
  }
}
```

---

## 🔧 Configuração do Chatwoot

### CORS (Obrigatório)

O Chatwoot precisa ter CORS habilitado para permitir requisições do KanbanWoot.

**Arquivo:** `/app/config/initializers/cors.rb` (já existe)

**Ativar via variável de ambiente:**
```bash
# ConfigMap do K8s
kubectl patch configmap chatwoot-env -n chatwoot \
  --type merge -p '{"data":{"ENABLE_API_CORS":"true"}}'

# Reiniciar deployment
kubectl rollout restart deployment/chatwoot-web -n chatwoot
```

**Verificar se está funcionando:**
```bash
curl -v -H "Origin: http://localhost:3005" \
  "http://195.35.19.73:30080/api/v1/accounts/1/contacts" 2>&1 | \
  grep -i "access-control"
```

Deve retornar:
```
< access-control-allow-origin: *
< access-control-allow-methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS
```

### Criar Atributos Customizados

**Via API:**
```bash
curl -X POST "http://195.35.19.73:30080/api/v1/accounts/1/custom_attribute_definitions" \
  -H "api_access_token: SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attribute_display_name": "Status do Funil",
    "attribute_display_type": "list",
    "attribute_key": "kbw_funil_status",
    "attribute_description": "Status do contato no funil de vendas",
    "attribute_model": "contact_attribute",
    "attribute_values": ["Novo", "Contato Inicial", "Proposta Enviada", "Fechado"]
  }'
```

**Via Interface Chatwoot:**
1. Configurações > Atributos Customizados
2. Adicionar Novo Atributo
3. Tipo: Lista (Dropdown)
4. Modelo: Atributo de Contato
5. Chave: `kbw_nome_do_atributo`
6. Valores: Adicionar cada valor da lista

---

## 🚀 Deployment

### Ambiente Atual

```
┌─────────────────────────────────────────────────┐
│           VPS (195.35.19.73)                    │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Systemd (Dev)                           │  │
│  │  Port: 3005                              │  │
│  │  URL: http://195.35.19.73:3005           │  │
│  │  Status: sudo systemctl status kanbanwoot│  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Kubernetes (Produção)                   │  │
│  │  Namespace: kanbanwoot                   │  │
│  │  NodePort: 30305                         │  │
│  │  URL: http://195.35.19.73:30305          │  │
│  │  Pod: kanbanwoot-xxxxx-xxxxx             │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Chatwoot (K8s)                          │  │
│  │  Namespace: chatwoot                     │  │
│  │  NodePort: 30080                         │  │
│  │  URL: http://195.35.19.73:30080          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Variáveis de Ambiente

**Desenvolvimento (.env):**
```env
REACT_APP_CHATWOOT_TOKEN=0f357dadc5333700fae0895dbb1b1c2f601ca81f8bf2818653255765506d9cab
REACT_APP_CHATWOOT_ACCOUNT_ID=1
REACT_APP_CHATWOOT_URL=http://195.35.19.73:30080
REACT_APP_DEBUG=true
```

**Produção (K8s ConfigMap + Secret):**
```yaml
# ConfigMap
REACT_APP_CHATWOOT_URL: "http://195.35.19.73:30080"
REACT_APP_CHATWOOT_ACCOUNT_ID: "1"
REACT_APP_DEBUG: "false"

# Secret
REACT_APP_CHATWOOT_TOKEN: "token_em_base64"
```

**Como as variáveis são carregadas:**

1. **Dev Mode (npm start):**
   - React injeta `process.env.REACT_APP_*` automaticamente
   - Lê do arquivo `.env` na raiz

2. **Produção Docker:**
   - `entrypoint.sh` gera `/usr/share/nginx/html/.env.js`
   - JavaScript carrega via `window._env_`
   - Valores vêm das env vars do container

3. **Código Híbrido:**
```javascript
const API_URL = (
  window._env_?.REACT_APP_CHATWOOT_URL ||
  process.env.REACT_APP_CHATWOOT_URL ||
  ''
);
```

---

## 🔗 Integração com Chatwoot

### Método 1: Iframe (Atual)

**Arquivo:** `/home/agents/chatwoot-20x/app/javascript/dashboard/routes/dashboard/kanban/KanbanView.vue`

```vue
<script setup>
const kanbanUrl = computed(() => {
  const protocol = window.location.protocol;

  const baseUrl = protocol === 'https:'
    ? 'https://kanban.agentesintegrados.com'
    : 'http://195.35.19.73:3005';

  const attribute = route.query.attribute || 'status';
  return `${baseUrl}/?kbw=${attribute}`;
});
</script>

<template>
  <iframe
    :src="kanbanUrl"
    class="flex-1 w-full border-0"
    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
  />
</template>
```

**Rotas Vue:**
```javascript
// kanban.routes.js
{
  path: '/accounts/:accountId/kanban',
  name: 'kanban_contacts',
  component: KanbanView
}
```

**Acesso:**
- http://195.35.19.73:30080/app/accounts/1/kanban
- http://195.35.19.73:30080/app/accounts/1/kanban?kbw=kbw_prioridade

### Método 2: Painel de Aplicativos

Alternativamente, pode ser adicionado como app externo:

1. **Chatwoot** > Configurações > Integrações > Painel de Aplicativos
2. **Adicionar Aplicativo:**
   - Nome: KanbanWoot
   - Endpoint: `http://195.35.19.73:3005/?kbw=kbw_funil_status`
3. Aparece no painel lateral durante atendimento

---

## 🎯 Estrutura de Arquivos

```
KanbanWoot/
├── public/
│   ├── index.html              # HTML principal com meta tags e animações CSS
│   ├── .env.js                 # Variáveis para dev (geradas em runtime no Docker)
│   └── test.html               # Página de teste da API
│
├── src/
│   ├── App.jsx                 # Componente raiz (renderiza KanbanBoardFull)
│   ├── index.js                # Entry point React
│   ├── index.css               # Tailwind imports (não usado no runtime)
│   ├── api.js                  # Cliente API Chatwoot
│   ├── debug.js                # Funções de debug
│   │
│   ├── components/
│   │   ├── KanbanBoardFull.jsx     # Board completo (USADO EM PRODUÇÃO)
│   │   ├── KanbanBoardSimple.jsx   # Versão debug (não usado)
│   │   ├── KanbanBoard.jsx         # Versão original com hooks (deprecated)
│   │   ├── KanbanColumn.jsx        # Coluna individual (não usado)
│   │   ├── KanbanCard.jsx          # Card individual (não usado)
│   │   ├── ErrorMessage.jsx        # Mensagem de erro
│   │   ├── Notification.jsx        # Notificações
│   │   └── CustomAttributesList.jsx # Lista atributos (não usado)
│   │
│   ├── hooks/
│   │   └── useKanbanData.js        # Custom hooks (não usado na versão atual)
│   │
│   └── reducers/
│       └── kanbanReducer.js        # Reducer (não usado na versão atual)
│
├── dockerizer/
│   ├── nginx.conf              # Configuração Nginx (porta 3000)
│   └── entrypoint.sh           # Script para injetar env vars em runtime
│
├── k8s-deployment.yaml         # Recursos Kubernetes completos
├── Dockerfile                  # Multi-stage build (node + nginx)
├── start-kanban.sh             # Script para systemd
│
├── package.json                # Dependências Node
├── tailwind.config.js          # Config Tailwind (não usado no build)
├── postcss.config.js           # Config PostCSS
│
├── CLAUDE.md                   # Guia para Claude Code
├── DEPLOYMENT.md               # Guia de deployment
├── GUIA_COMPLETO.md            # Este arquivo
└── README.md                   # Documentação original
```

---

## 🐛 Troubleshooting

### Problema: "Carregando Kanban..." infinito

**Causa:** Sem atributos customizados do tipo lista

**Solução:**
```bash
# Verificar se existem atributos
curl -H "api_access_token: SEU_TOKEN" \
  "http://195.35.19.73:30080/api/v1/accounts/1/custom_attribute_definitions"

# Se retornar [], criar atributo (ver seção "Criar Atributos Customizados")
```

### Problema: Erro CORS

**Sintoma:** Erro no console: `CORS policy: No 'Access-Control-Allow-Origin'`

**Solução:**
```bash
# Verificar se ENABLE_API_CORS está true
kubectl get configmap chatwoot-env -n chatwoot -o yaml | grep ENABLE_API_CORS

# Se não estiver, adicionar:
kubectl patch configmap chatwoot-env -n chatwoot \
  --type merge -p '{"data":{"ENABLE_API_CORS":"true"}}'

kubectl rollout restart deployment/chatwoot-web -n chatwoot
```

### Problema: Card "pula" ao arrastar

**Causa:** Conflito entre estilos do draggable e estilos inline

**Solução aplicada:**
```javascript
const style = {
  ...styles.card,
  ...draggableStyle,
  left: draggableStyle?.left || 0,
  top: draggableStyle?.top || 0,
  position: 'relative',
  transform: 'translate(0, 0)'
};
```

### Problema: Porta 30305 não acessível

**Causa:** Firewall bloqueando porta

**Solução:**
```bash
sudo ufw allow 30305/tcp
sudo ufw status | grep 30305
```

### Problema: Pod em estado ErrImageNeverPull

**Causa:** Imagem não importada para K3s

**Solução:**
```bash
docker save kanbanwoot:latest | sudo k3s ctr images import -
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot
```

### Problema: "Unexpected token '<'" erro JSON

**Causa:** Variáveis de ambiente vazias, API retorna HTML 404

**Solução:**
```bash
# Verificar se .env.js está sendo gerado
kubectl exec -n kanbanwoot deployment/kanbanwoot -- cat /usr/share/nginx/html/.env.js

# Deve mostrar:
window._env_ = {
  REACT_APP_CHATWOOT_URL: "http://195.35.19.73:30080",
  REACT_APP_CHATWOOT_TOKEN: "...",
  REACT_APP_CHATWOOT_ACCOUNT_ID: "1"
};
```

### Debug no Navegador

**Abrir Console (F12) e verificar:**
```javascript
// Verificar se variáveis carregaram
console.log(window._env_);

// Verificar chamadas à API
// Network tab > Filter: XHR

// Ver erros
// Console tab > Errors (vermelho)
```

---

## 📊 Monitoramento

### Logs do Systemd (porta 3005)
```bash
# Tempo real
sudo journalctl -u kanbanwoot -f

# Últimas 100 linhas
sudo journalctl -u kanbanwoot -n 100

# Desde hoje
sudo journalctl -u kanbanwoot --since today

# Ver erros
sudo journalctl -u kanbanwoot -p err
```

### Logs do Kubernetes (porta 30305)
```bash
# Tempo real
kubectl logs -n kanbanwoot -l app=kanbanwoot -f

# Últimas 50 linhas
kubectl logs -n kanbanwoot -l app=kanbanwoot --tail=50

# Pod específico
kubectl logs -n kanbanwoot kanbanwoot-xxxxx-xxxxx

# Pod anterior (se crashou)
kubectl logs -n kanbanwoot -l app=kanbanwoot --previous
```

### Status dos Recursos
```bash
# Systemd
sudo systemctl status kanbanwoot

# Kubernetes
kubectl get all -n kanbanwoot
kubectl describe pod -n kanbanwoot -l app=kanbanwoot
kubectl top pod -n kanbanwoot

# Firewall
sudo ufw status | grep -E "3005|30305"

# Portas em uso
lsof -i :3005
lsof -i :30305
```

---

## 🎨 Customização

### Adicionar Novos Atributos Kanban

1. **Criar no Chatwoot** (via API ou interface)
2. **Usar prefixo `kbw_`** (opcional, mas recomendado)
3. **Tipo deve ser `list`** (dropdown)
4. **KanbanWoot detecta automaticamente**

### Alterar Cores

**Arquivo:** `src/components/KanbanBoardFull.jsx`

```javascript
// Badges
backgroundColor: '#e0e7ff',  // Azul claro
color: '#3730a3',            // Azul escuro

// Cards
backgroundColor: 'white',
borderRadius: '8px',
boxShadow: '0 2px 6px rgba(0,0,0,0.08)',

// Colunas
backgroundColor: '#f8f9fa',

// Container
backgroundColor: '#f0f2f5',
```

### Adicionar Filtros

Para adicionar filtros por inbox, agente, tags, etc:

1. Adicionar estado:
```javascript
const [selectedInbox, setSelectedInbox] = useState(null);
```

2. Modificar `loadData()`:
```javascript
const contactsData = await fetch(
  `${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts?inbox_id=${selectedInbox}`
);
```

3. Adicionar UI de filtro no header

---

## 📱 Responsividade Detalhada

### Mobile (≤768px)

**Layout:**
- Colunas: 90vw (quase tela inteira)
- Gap: 12px
- Padding: 10px no container
- Scroll horizontal com snap

**Sticky Elements:**
```javascript
header: {
  position: 'sticky',
  top: 0,
  zIndex: 100
}

columnHeader: {
  position: 'sticky',
  top: 0,
  zIndex: 10
}
```

**Cards:**
- minHeight: 80px (maior área de toque)
- paddingTop: 35px (espaço para botão)
- touchAction: 'none' (prevenir scroll ao arrastar)

**Modal:**
- Bottom sheet (desliza de baixo)
- maxHeight: 85vh
- borderRadius: 16px 16px 0 0 (cantos arredondados só em cima)
- animation: slideUp

### Tablet (768-1024px)

**Layout:**
- Colunas: 45vw (2 por tela)
- Gap: 16px
- Flex: 2 colunas visíveis

### Desktop (>1024px)

**Layout:**
- Colunas: 280-320px fixo
- Gap: 20px
- Múltiplas colunas visíveis

---

## 🔐 Segurança

### Token de API

**Armazenamento:**
- Dev: `.env` (gitignored)
- K8s: Secret (base64 encoded)
- Systemd: Environment variable no service file

**Não expor:**
- ❌ Nunca commitar `.env`
- ❌ Nunca logar token completo
- ✅ Usar `***${TOKEN.slice(-4)}` em logs

### Firewall

**Portas abertas:**
```bash
3005/tcp   - KanbanWoot Dev
30305/tcp  - KanbanWoot K8s
30080/tcp  - Chatwoot
```

**Verificar:**
```bash
sudo ufw status numbered
```

---

## 🚨 Comandos Rápidos

```bash
# Reiniciar tudo
sudo systemctl restart kanbanwoot
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot

# Ver status geral
sudo systemctl status kanbanwoot
kubectl get pods -n kanbanwoot

# Rebuild completo
cd /home/agents/KanbanWoot
npm run build
docker build -t kanbanwoot:latest -f Dockerfile .
docker save kanbanwoot:latest | sudo k3s ctr images import -
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot

# Parar tudo
sudo systemctl stop kanbanwoot
kubectl delete namespace kanbanwoot

# Logs em tempo real
sudo journalctl -u kanbanwoot -f
kubectl logs -n kanbanwoot -l app=kanbanwoot -f
```

---

## 📈 Melhorias Futuras

### Funcionalidades
- [ ] Filtros por inbox, agente, tags
- [ ] Busca de contatos
- [ ] Bulk operations (mover múltiplos cards)
- [ ] Visualização de conversas inline
- [ ] Estatísticas por coluna
- [ ] Exportar board como CSV/PDF
- [ ] Timeline de mudanças de status
- [ ] Notificações em tempo real (WebSocket)

### Técnicas
- [ ] Autenticação integrada com Chatwoot SSO
- [ ] Migrar para Ingress ao invés de NodePort
- [ ] Configurar HTTPS com Let's Encrypt
- [ ] Cache Redis para performance
- [ ] Paginação de contatos
- [ ] Lazy loading de cards
- [ ] Service Worker para offline
- [ ] PWA (Progressive Web App)

### UI/UX
- [ ] Dark mode
- [ ] Atalhos de teclado
- [ ] Filtros salvos
- [ ] Customização de cores por coluna
- [ ] Avatares dos contatos
- [ ] Preview de última mensagem
- [ ] Indicadores de status online/offline

---

## 📞 Suporte

**Arquivos de Log:**
- Systemd: `sudo journalctl -u kanbanwoot`
- K8s: `kubectl logs -n kanbanwoot -l app=kanbanwoot`
- Nginx K8s: `kubectl exec -n kanbanwoot deployment/kanbanwoot -- tail -f /var/log/nginx/access.log`

**Documentação:**
- CLAUDE.md - Guia para desenvolvimento
- DEPLOYMENT.md - Guia de deployment
- README.md - Documentação original

**Recursos Kubernetes:**
```bash
kubectl get all -n kanbanwoot
kubectl describe deployment kanbanwoot -n kanbanwoot
kubectl get events -n kanbanwoot --sort-by='.lastTimestamp'
```

---

## ✨ Conclusão

O KanbanWoot está rodando em **duas versões**:

1. **Dev (3005)**: Para desenvolvimento e testes rápidos
2. **Produção K8s (30305)**: Para uso em produção

Ambas se comunicam com a mesma API do Chatwoot e funcionam de forma idêntica. A versão K8s é otimizada (build minificado) e mais robusta (auto-restart, health checks).

**URL Recomendada para Produção:** http://195.35.19.73:30305

---

*Última atualização: 2025-10-27*
