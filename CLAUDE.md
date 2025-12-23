# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

KanbanWoot é uma interface web estilo Kanban integrada ao **Chatwoot**, que utiliza campos personalizados do tipo lista (custom attributes) para visualizar e gerenciar contatos através de um board drag-and-drop.

## Architecture

### Frontend Stack
- **React 18** com Hooks (useState, useEffect, useReducer, useMemo)
- **React Router DOM** para navegação
- **@hello-pangea/dnd** para drag-and-drop
- **Tailwind CSS** para estilização
- **Axios** para requisições HTTP

### Key Architectural Patterns

**State Management:**
- `useReducer` com `kanbanReducer` para gerenciar o board (src/reducers/kanbanReducer.js:10)
- Custom hooks centralizados em `src/hooks/useKanbanData.js` que exportam:
  - `useDynamicKanbanData`: Carrega contatos e atributos do Chatwoot
  - `useUpdateContactAttribute`: Atualiza atributos de contatos
  - `useKanbanData`: Hook combinado que orquestra os dois anteriores

**Component Structure:**
```
App.jsx (Router)
└── KanbanBoard.jsx (Componente principal)
    ├── KanbanColumn.jsx (Coluna do board)
    │   └── KanbanCard.jsx (Card de contato)
    │       └── CustomAttributesList.jsx (Lista atributos do contato)
    ├── Notification.jsx (Notificações de sucesso/erro)
    └── ErrorMessage.jsx (Mensagens de erro)
```

**API Integration:**
- Todas as chamadas ao Chatwoot centralizadas em `src/api.js`
- Função `chatwootFetch` wrapper genérica para tratamento de erros
- Configuração via `window._env_` para suportar Docker (variáveis injetadas em runtime)

### Data Flow

1. **URL Parameters**: Parâmetro `?kbw=<attribute_key>` define qual atributo do tipo lista será usado como board
2. **Dynamic Columns**: As colunas são os valores (`attribute_values`) do atributo customizado selecionado
3. **Contact Distribution**: Contatos são distribuídos nas colunas baseado no valor do `custom_attributes[attribute_key]`
4. **Special Column**: Coluna "Não definido" para contatos sem valor definido no atributo

## Environment Configuration

### Local Development
Arquivo `.env` na raiz com:
```env
REACT_APP_CHATWOOT_TOKEN=<api_token>
REACT_APP_CHATWOOT_ACCOUNT_ID=<account_id>
REACT_APP_CHATWOOT_URL=https://app.chatwoot.com
REACT_APP_DEBUG=true
```

### Docker Production
- Variáveis injetadas em runtime via `dockerizer/entrypoint.sh`
- Configuração do nginx em `dockerizer/nginx.conf`
- Build multi-stage: node:18-alpine → nginx:stable

## Common Commands

### Development
```bash
npm install          # Instalar dependências
npm start            # Dev server (porta 3000)
npm test             # Executar testes
npm run build        # Build de produção
```

### Docker
```bash
docker build -t kanbanwoot .
docker run -p 3000:3000 \
  -e REACT_APP_CHATWOOT_TOKEN=xxx \
  -e REACT_APP_CHATWOOT_ACCOUNT_ID=xxx \
  -e REACT_APP_CHATWOOT_URL=xxx \
  kanbanwoot
```

## Chatwoot API Integration

### Required Endpoints
- `GET /api/v1/accounts/{id}/contacts` - Buscar todos os contatos
- `GET /api/v1/accounts/{id}/custom_attribute_definitions` - Buscar definições de atributos customizados
- `PUT /api/v1/accounts/{id}/contacts/{contact_id}` - Atualizar custom_attributes do contato

### Custom Attributes Structure
```javascript
{
  attribute_key: "kbw_funil_status",           // Chave única
  attribute_display_name: "Funil de Vendas",  // Nome amigável
  attribute_display_type: "list",             // Tipo: list, text, number, etc
  attribute_values: ["Novo", "Contato", "Proposta", "Fechado"], // Valores do dropdown
  attribute_model: "contact_attribute"        // Modelo: contact_attribute, conversation_attribute
}
```

### CORS Configuration
Para ambientes cross-domain, configure o Chatwoot Rails backend (`/app/config/initializers/cors.rb`):
```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'https://kanbanwoot-domain.com'
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
```

## Key Implementation Details

### Drag-and-Drop Logic
- `onDragEnd` handler em KanbanBoard.jsx:63
- Atualização otimista do estado local
- Rollback em caso de erro na API
- Valor `undefined` remove a chave do atributo (para coluna "Não definido")

### URL-based Attribute Selection
1. Prioridade: Parâmetro `?kbw=exact_key` da URL
2. Fallback: Primeiro atributo tipo lista com prefixo `kbw_`
3. Fallback final: Primeiro atributo tipo lista disponível

### Memoization Strategy
- `useMemo` para `columns` (useKanbanData.js:28)
- `useMemo` para `displayNames` map (useKanbanData.js:34)
- Previne re-renders desnecessários em boards grandes

### Debug Mode
- Flag `REACT_APP_DEBUG=true` ativa logs detalhados
- Função `debugLog` em `src/debug.js`
- Console groups para rastreamento de fluxo de dados

## Integration with Chatwoot Dashboard

Para incorporar no painel lateral do Chatwoot:
1. **Configurações** > **Integrações** > **Painel de Aplicativos**
2. **Endpoint**: `https://kanbanwoot-domain.com/?kbw=funil_status`
3. Substitua `funil_status` pelo `attribute_key` desejado

## Future Improvements Considerations
- Filtros por tags, agentes ou inbox
- Autenticação integrada com Chatwoot SSO
- Visualização de histórico de conversas
- Bulk operations (mover múltiplos contatos)
