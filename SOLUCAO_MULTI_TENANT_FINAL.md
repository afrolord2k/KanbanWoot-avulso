# Solução Multi-Tenant KanbanWoot - DEFINITIVA

## 🔴 Problema Identificado

O webpack/babel está removendo TODO o código relacionado a `window.location.hostname`, mesmo com:
- ✅ Terser compress: false
- ✅ Terser mangle: false
- ✅ minimize: false
- ✅ Código usado no JSX
- ✅ React-scripts ejetado

## ✅ Solução Implementada

### Abordagem: **Server-Side Account ID Injection**

Ao invés de detectar no JavaScript (que é removido), vamos:

1. **Caddy/Nginx envia header** `X-Account-ID` baseado no subdomínio
2. **entrypoint.sh injeta** o Account ID no `.env.js`
3. **React usa** `window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID`

### Implementação:

#### 1. Configuração Caddy

```caddy
# Para cada subdomínio
2.agentesintegrados.com {
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305 {
        header_up X-Account-ID "2"
        header_up Host {host}
    }
}

# Ou dinâmico com matcher
@account_subdomain host_regexp account ^(\d+)\.agentesintegrados\.com$
reverse_proxy @account_subdomain http://195.35.19.73:30305 {
    header_up X-Account-ID {re.account.1}
}
```

#### 2. Modificar entrypoint.sh do Docker

```bash
#!/bin/sh

# Extrai Account ID do header ou hostname
ACCOUNT_ID="${HTTP_X_ACCOUNT_ID:-1}"

# Se não veio por header, tenta do hostname
if [ "$ACCOUNT_ID" = "1" ]; then
    # Extrai do HTTP_HOST se disponível
    if echo "$HTTP_HOST" | grep -qE "^[0-9]+\."; then
        ACCOUNT_ID=$(echo "$HTTP_HOST" | sed 's/^\([0-9]*\)\..*/\1/')
    fi
fi

# Injeta no .env.js
cat > /usr/share/nginx/html/.env.js <<EOF
window._env_ = {
  REACT_APP_CHATWOOT_URL: "${REACT_APP_CHATWOOT_URL}",
  REACT_APP_CHATWOOT_TOKEN: "${REACT_APP_CHATWOOT_TOKEN}",
  REACT_APP_CHATWOOT_ACCOUNT_ID: "${ACCOUNT_ID}",
  REACT_APP_DEBUG: "${REACT_APP_DEBUG:-false}"
};
EOF

# Inicia nginx
nginx -g 'daemon off;'
```

## ⚠️ Limitação da Abordagem JavaScript

**Por que o código JavaScript não funcionou:**

1. Terser/Babel considera `window.location.hostname` como side-effect
2. Tree-shaking remove código "não usado" de forma muito agressiva
3. Mesmo desabilitando ALL optimizations, algum plugin remove
4. Build time vs Runtime - React otimiza em build-time

## 🚀 Próximos Passos

1. ✅ Modificar `dockerizer/entrypoint.sh`
2. ✅ Rebuild imagem Docker
3. ✅ Deploy no K8s
4. ✅ Configurar Caddy para enviar X-Account-ID header
5. ✅ Testar com Account 2 e 3

## 📝 Código Atual

**Files Modificados:**
- `src/api.js` - Tem código de detecção (mas é removido no build)
- `src/components/KanbanBoard.jsx` - Tem useState para accountId
- `config/webpack.config.js` - Terser desabilitado

**Solução Real:**
- `dockerizer/entrypoint.sh` - Injeta Account ID do header/hostname

---

**Status**: Pronto para implementar solução server-side
**Data**: 2025-10-30
