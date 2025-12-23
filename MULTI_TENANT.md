# KanbanWoot - Multi-Tenancy via Subdomínios

## Visão Geral

O KanbanWoot agora suporta **multi-tenancy automático** através de subdomínios numéricos, permitindo que cada conta do Chatwoot tenha seu próprio Kanban isolado.

## Arquitetura Multi-Tenant

### Padrão de Subdomínios

```
{account_id}.agentesintegrados.com/kanbanwoot
```

### Exemplos:

| Account ID | URL | Descrição |
|------------|-----|-----------|
| 1 | https://1.agentesintegrados.com/kanbanwoot | Conta 1 do Chatwoot |
| 2 | https://2.agentesintegrados.com/kanbanwoot | Conta 2 do Chatwoot |
| 3 | https://3.agentesintegrados.com/kanbanwoot | Conta 3 do Chatwoot |
| N | https://N.agentesintegrados.com/kanbanwoot | Conta N do Chatwoot |

## Como Funciona

### 1. Detecção Automática de Account ID

O arquivo `src/utils/accountDetector.js` detecta automaticamente o Account ID:

```javascript
// Exemplo: 2.agentesintegrados.com
const hostname = window.location.hostname;
const match = hostname.match(/^(\d+)\.agentesintegrados\.com$/);
const accountId = match ? match[1] : ENV_FALLBACK;
```

### 2. API Calls Dinâmicos

Todas as chamadas à API do Chatwoot usam o Account ID detectado:

```javascript
// ANTES (hardcoded)
const url = `${CHATWOOT_URL}/api/v1/accounts/1/contacts`;

// DEPOIS (dinâmico)
const ACCOUNT_ID = getAccountIdFromSubdomain();
const url = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts`;
```

### 3. Fallback para Ambiente Único

Se o hostname não seguir o padrão numérico, usa o valor de `REACT_APP_CHATWOOT_ACCOUNT_ID`:

- `kanban.agentesintegrados.com` → Usa ENV (Account 1)
- `localhost:3000` → Usa ENV (development)

## Configuração do Caddy (Proxy Reverso)

### Wildcard DNS

Configure no seu provedor de DNS:

```
*.agentesintegrados.com  A  195.35.19.73
```

Ou CNAMEs específicos:
```
1.agentesintegrados.com  CNAME  agentesintegrados.com
2.agentesintegrados.com  CNAME  agentesintegrados.com
3.agentesintegrados.com  CNAME  agentesintegrados.com
```

### Caddyfile - Configuração Multi-Tenant

```caddy
# Certificado SSL Wildcard
*.agentesintegrados.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
}

# Roteamento por subdomínio para Kanbanwoot
1.agentesintegrados.com, 2.agentesintegrados.com, 3.agentesintegrados.com {
    # Remove o prefixo numérico e roteia para o mesmo backend
    reverse_proxy /kanbanwoot/* http://195.35.19.73:30305 {
        header_up Host {host}
        header_up X-Account-ID {labels.1} # Extrai número do subdomínio
    }
}

# Ou usando matcher dinâmico (mais elegante)
@kanban_accounts {
    host_regexp account ^(\d+)\.agentesintegrados\.com$
}

handle @kanban_accounts {
    reverse_proxy /kanbanwoot/* http://195.35.19.73:30305 {
        header_up Host {http.request.host}
        header_up X-Real-IP {remote_host}
    }
}
```

### Alternativa: Nginx Ingress Controller

Se estiver usando Nginx Ingress no K8s:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kanbanwoot-wildcard
  namespace: kanbanwoot
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  # Wildcard para qualquer número
  - host: "*.agentesintegrados.com"
    http:
      paths:
      - path: /kanbanwoot(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: kanbanwoot
            port:
              number: 80
  tls:
  - hosts:
    - "*.agentesintegrados.com"
    secretName: wildcard-agentesintegrados-tls
```

## Variáveis de Ambiente

### Docker Build (build-time)

Não é mais necessário definir `REACT_APP_CHATWOOT_ACCOUNT_ID` por build!

```bash
# Apenas token e URL
docker build \
  -e REACT_APP_CHATWOOT_TOKEN=xxx \
  -e REACT_APP_CHATWOOT_URL=https://agentesintegrados.com \
  -t kanbanwoot:latest .
```

### Runtime (window._env_)

O `REACT_APP_CHATWOOT_ACCOUNT_ID` agora é apenas fallback:

```javascript
// dockerizer/entrypoint.sh
window._env_ = {
  REACT_APP_CHATWOOT_URL: "${REACT_APP_CHATWOOT_URL}",
  REACT_APP_CHATWOOT_TOKEN: "${REACT_APP_CHATWOOT_TOKEN}",
  REACT_APP_CHATWOOT_ACCOUNT_ID: "1" // Fallback opcional
};
```

## Deployment

### Build da Imagem (Uma Única Vez)

```bash
cd /home/agents/KanbanWoot
docker build -t kanbanwoot:multi-tenant .
docker save kanbanwoot:multi-tenant | sudo k3s ctr images import -
```

### Deploy no Kubernetes (Um Deployment para Todas as Contas)

```bash
kubectl apply -f k8s-deployment.yaml
```

Não precisa criar múltiplos deployments! Um único deployment serve todas as contas.

## Fluxo de Uso

### 1. Admin do Chatwoot

Acessa: `https://agentesintegrados.com/super_admin/accounts/2`

### 2. Gera Link do Kanbanwoot

O admin cria um link apontando para:
```
https://2.agentesintegrados.com/kanbanwoot?kbw=funil_vendas
```

### 3. Usuário Acessa

- Browser carrega KanbanWoot
- JavaScript detecta hostname: `2.agentesintegrados.com`
- Extrai Account ID: `2`
- Faz chamadas para: `/api/v1/accounts/2/...`

### 4. Isolamento de Dados

Cada subdomínio acessa apenas os dados da sua conta:
- Account 1: Só vê contatos/atributos da conta 1
- Account 2: Só vê contatos/atributos da conta 2
- Account N: Só vê contatos/atributos da conta N

## Testes

### Teste Local (Development)

```bash
# Adicionar ao /etc/hosts
127.0.0.1  1.agentesintegrados.local
127.0.0.1  2.agentesintegrados.local

# Iniciar dev server
npm start

# Acessar
http://1.agentesintegrados.local:3000
```

### Teste em Produção

```bash
# Testar Account 1
curl -I https://1.agentesintegrados.com/kanbanwoot

# Testar Account 2
curl -I https://2.agentesintegrados.com/kanbanwoot

# Verificar logs
kubectl logs -n kanbanwoot deployment/kanbanwoot -f
```

## Troubleshooting

### Account ID não está sendo detectado

Abra o console do browser e verifique:
```javascript
console.log('[AccountDetector] Hostname:', window.location.hostname);
```

### API retorna 403/401 para outra conta

- Verifique se o TOKEN tem permissões de super_admin
- Ou use tokens específicos por conta (requer modificação adicional)

### CSS/Assets não carregam

Verifique se o Caddy/proxy não está fazendo strip do path `/kanbanwoot`

## Segurança

### Tokens por Conta (Recomendado)

Para produção, considere usar tokens específicos por conta ao invés de um único token global:

```javascript
// Mapeamento de tokens por conta
const ACCOUNT_TOKENS = {
  '1': 'token_account_1',
  '2': 'token_account_2',
  '3': 'token_account_3'
};

const TOKEN = ACCOUNT_TOKENS[ACCOUNT_ID] || process.env.REACT_APP_CHATWOOT_TOKEN;
```

### CORS

Certifique-se de configurar CORS no Chatwoot para aceitar múltiplos subdomínios:

```ruby
# config/initializers/cors.rb
origins '*.agentesintegrados.com'
```

## Próximos Passos

1. ✅ Código modificado para detectar Account ID
2. ⏳ Configurar Caddy com wildcard DNS
3. ⏳ Testar com Account 1 e Account 2
4. ⏳ Configurar SSL wildcard (Let's Encrypt DNS challenge)
5. ⏳ Documentar links para cada conta no Chatwoot admin

---

**Modificações realizadas em**: 2025-10-30
**Arquivos modificados**:
- `src/utils/accountDetector.js` (novo)
- `src/api.js` (modificado)
