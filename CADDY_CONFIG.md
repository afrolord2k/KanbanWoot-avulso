# Configuração Caddy para KanbanWoot Multi-Tenant

## 📋 O Que o Caddy Precisa Fazer

O Caddy precisa rotear os subdomínios numéricos (`2.agentesintegrados.com`, `3.agentesintegrados.com`, etc.) para o KanbanWoot no Kubernetes.

## ✅ Configuração do Caddyfile

### Opção 1: Wildcardcom Matcher Dinâmico (Recomendado)

```caddy
# Captura qualquer subdomínio numérico
@kanban_accounts {
    host_regexp account ^(\d+)\.agentesintegrados\.com$
}

handle @kanban_accounts {
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305 {
        header_up Host {http.request.host}
        header_up X-Real-IP {http.request.remote.host}
        header_up X-Forwarded-For {http.request.remote.host}
        header_up X-Forwarded-Proto {http.request.scheme}
    }
}
```

### Opção 2: Lista Explícita de Accounts

```caddy
# Account 2
2.agentesintegrados.com {
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}

# Account 3
3.agentesintegrados.com {
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
```

### Opção 3: Usando o Script create-kanbanwoot-multi-tenant.sh

Se você já tem o script automatizado, apenas execute:

```bash
# Para criar Account 2
/etc/caddy/scripts/create-kanbanwoot-multi-tenant.sh 2

# Para criar Account 3
/etc/caddy/scripts/create-kanbanwoot-multi-tenant.sh 3
```

O script já deve adicionar a configuração correta automaticamente!

---

## 🔐 SSL/HTTPS

O Caddy automaticamente vai:
1. ✅ Emitir certificado SSL Let's Encrypt para cada subdomínio
2. ✅ Renovar automaticamente
3. ✅ Redirecionar HTTP → HTTPS

**Certifique-se de que o Caddyfile tenha**:

```caddy
# Configuração global de email para Let's Encrypt
{
    email seu-email@dominio.com
}
```

---

## 🧪 Testar Configuração

Depois de configurar, teste:

```bash
# Recarregar Caddy
caddy reload --config /etc/caddy/Caddyfile

# Testar Account 2
curl -I https://2.agentesintegrados.com/kanbanwoot

# Verificar logs do Caddy
journalctl -u caddy -f
```

---

## ✅ Checklist de Configuração

- [ ] DNS Wildcard configurado (`* CNAME agentesintegrados.com`)
- [ ] Caddyfile atualizado com subdomínios
- [ ] Caddy recarregado (`caddy reload`)
- [ ] Certificados SSL emitidos (automático, aguardar 1-2 min)
- [ ] Teste em https://2.agentesintegrados.com/kanbanwoot
- [ ] Console do browser mostra Account 2
- [ ] Contatos da Account 2 aparecem

---

## 🔄 Fluxo Completo

```
Browser
    ↓
https://2.agentesintegrados.com/kanbanwoot
    ↓
Caddy (proxy reverso)
    ↓
K8s Service kanbanwoot:30305
    ↓
Pod KanbanWoot
    ↓
entrypoint.sh executa
    ↓
.env.js criado com JavaScript que detecta hostname
    ↓
JavaScript puro executa: window.location.hostname
    ↓
Detecta Account ID: "2"
    ↓
Injeta: window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID = "2"
    ↓
React carrega e usa Account ID = "2"
    ↓
API calls: /api/v1/accounts/2/contacts
```

---

## 📝 Exemplo de Configuração Completa no Caddyfile

```caddy
# Email global para Let's Encrypt
{
    email admin@agentesintegrados.com
}

# Domínio principal (Account 1)
agentesintegrados.com {
    # Chatwoot na raiz
    reverse_proxy / http://195.35.19.73:30080

    # Kanbanwoot da Account 1
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305
}

# Subdomínios numéricos (Accounts 2+)
@kanban_multi {
    host_regexp account ^(\d+)\.agentesintegrados\.com$
}

handle @kanban_multi {
    reverse_proxy /kanbanwoot* http://195.35.19.73:30305 {
        header_up Host {http.request.host}
        header_up X-Real-IP {http.request.remote.host}
    }
}

# Disparador
disparador.agentesintegrados.com {
    reverse_proxy http://195.35.19.73:30020
}

# Evolution API
zp.agentesintegrados.com {
    reverse_proxy http://195.35.19.73:8085
}
```

---

## ⚠️ Importante

**Não precisa fazer nenhuma configuração especial no Caddy!**

O KanbanWoot agora detecta o Account ID **automaticamente** do hostname via JavaScript no `.env.js`.

O Caddy só precisa:
1. Rotear o subdomínio para a porta 30305
2. Passar o hostname correto (header `Host`)

**Se você já criou com o script `create-kanbanwoot-multi-tenant.sh`, está pronto!** ✅

---

## 🧪 Teste Final

**Acesse agora**:
- https://2.agentesintegrados.com/kanbanwoot
- Abra Console (F12)
- Deve ver: `[MULTI-TENANT] Account ID detectado: 2`
- Título: `KanbanWoot - Account 2`

**Me confirme se funcionou!** 🎯
