# Como Integrar o Disparador no Sidebar do Chatwoot

## 🎯 Objetivo

Adicionar o Disparador como um **Dashboard App** no Chatwoot para aparecer no sidebar.

## 📋 Opções de Integração

### Opção 1: Via Interface Web do Chatwoot (Mais Fácil)

1. **Faça login no Chatwoot** como admin
2. Acesse: **Settings → Integrations → Dashboard Apps**
3. Clique em **Add New Dashboard App**
4. Preencha:
   ```
   Title: Disparador
   URL: https://disparador.agentesintegrados.com
   ```
5. Clique em **Create**

### Opção 2: Via Rails Console (Programático)

```bash
# Conectar ao pod do Chatwoot
kubectl exec -it -n chatwoot deployment/chatwoot-web -- bundle exec rails console

# No console Rails:
account = Account.find(1)  # Account 1

# Criar Dashboard App para o Disparador
DashboardApp.create!(
  account: account,
  user: account.users.admins.first,
  title: 'Disparador',
  content: [
    {
      type: 'frame',
      url: 'https://disparador.agentesintegrados.com'
    }
  ]
)
```

### Opção 3: Via API REST

```bash
# Obter token de admin do Chatwoot
CHATWOOT_TOKEN="seu_token_aqui"
ACCOUNT_ID=1

curl -X POST "https://agentesintegrados.com/api/v1/accounts/${ACCOUNT_ID}/dashboard_apps" \
  -H "api_access_token: ${CHATWOOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard_app": {
      "title": "Disparador",
      "content": [
        {
          "type": "frame",
          "url": "https://disparador.agentesintegrados.com"
        }
      ]
    }
  }'
```

## 🔧 Preparar o Disparador para Iframe

### 1. Remover Header/Navigation quando em iframe

No código do Disparador, adicione detecção de iframe (similar ao que fizemos no Kanbanwoot):

```javascript
// No componente principal do Disparador
const isIframe = window.self !== window.top;

// Esconder elementos desnecessários
{!isIframe && (
  <header>...</header>
)}
```

### 2. Ajustar CSP Headers

O Next.js do Disparador pode ter proteção contra iframe. Verifique se tem `X-Frame-Options` ou CSP.

Se necessário, adicione no `next.config.mjs`:

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'ALLOW-FROM https://agentesintegrados.com'
        }
      ]
    }
  ];
}
```

### 3. Configurar CORS

Certifique-se de que o Disparador aceita ser carregado em iframe do Chatwoot.

## 📊 Multi-Tenant para Disparador (Opcional)

Se quiser que cada conta tenha seu próprio Disparador:

### Account 1:
```json
{
  "title": "Disparador",
  "content": [{
    "type": "frame",
    "url": "https://disparador.agentesintegrados.com"
  }]
}
```

### Account 2:
```json
{
  "title": "Disparador",
  "content": [{
    "type": "frame",
    "url": "https://2.disparador.agentesintegrados.com"
  }]
}
```

Ou usar query parameter para identificar a conta:
```
https://disparador.agentesintegrados.com?account_id=2
```

## 🧪 Testar Integração

Após criar o Dashboard App:

1. **Recarregue o Chatwoot**
2. **No sidebar esquerdo** deve aparecer:
   - 📧 Conversas
   - 👥 Contatos
   - 📊 Relatórios
   - 🚀 **Disparador** ← NOVO!
3. **Clique em Disparador**
4. Abre em iframe no painel principal

## ⚠️ Problemas Comuns

### Disparador não carrega no iframe
- **Causa**: X-Frame-Options bloqueando
- **Solução**: Configurar headers no Next.js

### Aparece em branco
- **Causa**: CSP do Chatwoot
- **Solução**: Configurar Content-Security-Policy

### Autenticação falha
- **Causa**: Cookies não compartilhados entre domínios
- **Solução**: Usar mesmo domínio raiz ou configurar SameSite=None

## 🎯 Recomendação

**Use a Opção 1 (Interface Web)** - É a mais simples e não requer código!

Depois de adicionar, o Disparador vai aparecer no sidebar do Chatwoot e pode ser acessado por:

```
https://agentesintegrados.com/app/accounts/1/disparador
```

(O Chatwoot cria a rota automaticamente!)

---

**Quer que eu execute via Rails console para você agora?**
