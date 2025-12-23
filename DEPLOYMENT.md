# 🚀 KanbanWoot - Deployment Guide

## ✅ Status Atual

✨ **KanbanWoot está rodando em produção no Kubernetes!**

### 📍 URLs de Acesso:
- **Standalone**: http://195.35.19.73:30305
- **Via Chatwoot**: http://195.35.19.73:30080/app/accounts/1/kanban

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│         Chatwoot-20x (K8s)              │
│  http://195.35.19.73:30080              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  KanbanView.vue (iframe)        │   │
│  │  └─> http://195.35.19.73:30305  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      KanbanWoot (K8s Namespace)         │
│                                         │
│  ┌─────────────────────┐                │
│  │  Deployment         │                │
│  │  - 1 replica        │                │
│  │  - React build      │                │
│  │  - Nginx server     │                │
│  └─────────────────────┘                │
│           ↓                              │
│  ┌─────────────────────┐                │
│  │  Service NodePort   │                │
│  │  Port: 80 → 30305   │                │
│  └─────────────────────┘                │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     Chatwoot API (K8s)                  │
│  http://195.35.19.73:30080/api/v1       │
│  - Custom Attribute Definitions         │
│  - Contacts                             │
└─────────────────────────────────────────┘
```

---

## 📦 Recursos Kubernetes

### Namespace
```bash
kubectl get ns kanbanwoot
```

### Deployment
```yaml
Name: kanbanwoot
Namespace: kanbanwoot
Replicas: 1
Image: kanbanwoot:latest
Container Port: 3000
Resources:
  Requests: 128Mi RAM, 100m CPU
  Limits: 256Mi RAM, 200m CPU
```

### Service
```yaml
Type: NodePort
Port: 80
TargetPort: 3000
NodePort: 30305
```

### ConfigMap
```yaml
REACT_APP_CHATWOOT_URL: http://195.35.19.73:30080
REACT_APP_CHATWOOT_ACCOUNT_ID: 1
REACT_APP_DEBUG: false
```

### Secret
```yaml
REACT_APP_CHATWOOT_TOKEN: ***cab (stored in k8s secret)
```

---

## 🔄 Comandos Úteis

### Ver Status
```bash
# Status geral
kubectl get all -n kanbanwoot

# Logs do pod
kubectl logs -n kanbanwoot -l app=kanbanwoot -f

# Descrever pod
kubectl describe pod -n kanbanwoot -l app=kanbanwoot

# Ver service
kubectl get svc -n kanbanwoot
```

### Atualizar Deployment

#### 1. Rebuild da imagem
```bash
cd /home/agents/KanbanWoot
docker build -t kanbanwoot:latest -f Dockerfile .
```

#### 2. Importar para K3s
```bash
docker save kanbanwoot:latest | sudo k3s ctr images import -
```

#### 3. Reiniciar deployment
```bash
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot
kubectl rollout status deployment/kanbanwoot -n kanbanwoot
```

### Atualizar Variáveis de Ambiente
```bash
# Editar ConfigMap
kubectl edit configmap kanbanwoot-config -n kanbanwoot

# Editar Secret
kubectl edit secret kanbanwoot-secret -n kanbanwoot

# Reiniciar para aplicar
kubectl rollout restart deployment/kanbanwoot -n kanbanwoot
```

### Troubleshooting
```bash
# Ver eventos
kubectl get events -n kanbanwoot --sort-by='.lastTimestamp'

# Executar comando no pod
kubectl exec -it -n kanbanwoot deployment/kanbanwoot -- sh

# Ver logs com erro
kubectl logs -n kanbanwoot -l app=kanbanwoot --previous

# Deletar e recriar
kubectl delete -f k8s-deployment.yaml
kubectl apply -f k8s-deployment.yaml
```

---

## 🔥 Firewall

Portas abertas no UFW:
```bash
sudo ufw status | grep -E "3005|30305"
```

Resultado:
```
3005/tcp     ALLOW       Anywhere  (dev server - pode remover)
30305/tcp    ALLOW       Anywhere  (NodePort K8s - produção)
```

---

## 🎯 Funcionalidades

### Board Kanban
- ✅ Drag and drop de contatos entre colunas
- ✅ Múltiplos atributos customizados (dropdown)
- ✅ Coluna "Não definido" para contatos sem valor
- ✅ Contador de contatos por coluna
- ✅ Atualização automática no Chatwoot

### Modal de Detalhes
- ✅ Botão 👁️ em cada card
- ✅ Nome, email, telefone, ID
- ✅ Todos os atributos customizados
- ✅ Link direto para o Chatwoot

### Responsividade
- ✅ Layout mobile-friendly
- ✅ Scroll horizontal suave
- ✅ Touch-friendly drag and drop
- ✅ Colunas 85% largura no mobile

---

## 🗃️ Dados de Teste

### Atributos Customizados
1. **Status do Funil** (kbw_funil_status)
   - Novo, Contato Inicial, Proposta Enviada, Negociação, Fechado, Perdido

2. **Prioridade** (kbw_prioridade)
   - Baixa, Média, Alta, Urgente

### Contatos de Teste
- João Silva (Novo / Alta)
- Maria Santos (Contato Inicial / Média)
- Pedro Costa (Proposta Enviada)
- Ana Lima (Fechado / Urgente)
- Carlos Oliveira (Não definido)

---

## 📝 Arquivos Importantes

```
KanbanWoot/
├── Dockerfile                  # Dockerfile de produção
├── k8s-deployment.yaml         # Recursos K8s
├── src/
│   ├── App.jsx                 # Componente raiz
│   ├── components/
│   │   ├── KanbanBoardFull.jsx # Board completo
│   │   └── KanbanBoardSimple.jsx # Versão debug
│   └── api.js                  # Cliente API Chatwoot
├── dockerizer/
│   ├── nginx.conf              # Config Nginx
│   └── entrypoint.sh           # Script injeção env vars
└── public/
    ├── index.html              # HTML com meta viewport
    └── .env.js                 # Env vars (gerado em runtime)
```

---

## 🔗 Integração com Chatwoot

O KanbanWoot está integrado no Chatwoot via iframe em:
```
/home/agents/chatwoot-20x/app/javascript/dashboard/routes/dashboard/kanban/KanbanView.vue
```

Rota Vue: `/app/accounts/:accountId/kanban`

---

## 🚨 Próximos Passos (Opcional)

1. **HTTPS**: Configurar certificado SSL/TLS
2. **Ingress**: Usar Ingress Controller ao invés de NodePort
3. **Autenticação**: Integrar auth do Chatwoot
4. **Websockets**: Atualização em tempo real
5. **Filtros**: Por tags, agentes, inbox
6. **Multi-tenant**: Suporte a múltiplas contas

---

## 📊 Monitoramento

```bash
# CPU e memória do pod
kubectl top pod -n kanbanwoot

# Recursos do namespace
kubectl top nodes

# Ver métricas
kubectl describe pod -n kanbanwoot -l app=kanbanwoot | grep -A 5 "Conditions"
```

---

## ✨ Sucesso!

O KanbanWoot está em **produção no Kubernetes** e totalmente integrado com o Chatwoot! 🎉
