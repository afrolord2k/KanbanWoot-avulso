# 🔄 Migração: Systemd → Docker

**Data:** 2025-10-30
**KanbanWoot Dev:** Porta 3005

---

## ✅ **Migração Concluída com Sucesso!**

### **Antes (Systemd):**
```
Service: kanbanwoot.service
Process: npm start
PID: 4130265
Uptime: 2 dias
```

### **Depois (Docker):**
```
Container: kanbanwoot-dev
Image: node:18-alpine
Port: 3005:3000
Volumes: Código montado (hot reload)
```

---

## 🎯 **Por que Migrar?**

### **Vantagens do Docker:**

1. ✅ **Consistência:** Mesmo padrão dos outros staging (Chatwoot, Evolution, Disparador)
2. ✅ **Isolamento:** Node_modules não conflitam com o sistema
3. ✅ **Portabilidade:** Pode mover para outro servidor facilmente
4. ✅ **Hot Reload:** Mantido com volumes montados
5. ✅ **Gerenciamento:** docker-compose up/down/restart
6. ✅ **Logs:** docker logs (igual aos outros)
7. ✅ **Recursos:** Pode limitar CPU/RAM se necessário

### **Systemd vs Docker:**

| Aspecto | Systemd | Docker |
|---------|---------|--------|
| Hot Reload | ✅ | ✅ (com volumes) |
| Isolamento | ❌ | ✅ |
| Consistência | ❌ | ✅ |
| Portabilidade | ❌ | ✅ |
| Gerenciamento | systemctl | docker/docker-compose |

---

## 🚀 **Como Foi Feito:**

### **1. Parar Systemd:**
```bash
sudo systemctl stop kanbanwoot
sudo systemctl disable kanbanwoot
```

### **2. Criar docker-compose.dev.yml:**
```yaml
version: '3.8'
services:
  kanbanwoot-dev:
    image: node:18-alpine
    ports:
      - "3005:3000"
    volumes:
      - ./:/app  # Hot reload
      - kanbanwoot-node-modules:/app/node_modules  # Cache
    command: sh -c "npm install && npm start"
```

### **3. Iniciar Docker:**
```bash
docker run -d --name kanbanwoot-dev \
  -p 3005:3000 \
  -v /home/agents/KanbanWoot:/app \
  node:18-alpine \
  sh -c "npm install && npm start"
```

---

## 🔧 **Comandos Novos:**

### **Gerenciar Container:**

```bash
# Iniciar
docker start kanbanwoot-dev

# Parar
docker stop kanbanwoot-dev

# Reiniciar
docker restart kanbanwoot-dev

# Ver logs
docker logs -f kanbanwoot-dev

# Ver status
docker ps | grep kanbanwoot

# Remover (resetar)
docker stop kanbanwoot-dev && docker rm kanbanwoot-dev
```

### **Usando Docker Compose (alternativa):**

```bash
cd /home/agents/KanbanWoot

# Iniciar
docker-compose -f docker-compose.dev.yml up -d

# Parar
docker-compose -f docker-compose.dev.yml down

# Ver logs
docker-compose -f docker-compose.dev.yml logs -f

# Reiniciar
docker-compose -f docker-compose.dev.yml restart
```

---

## 🔥 **Hot Reload:**

### **Como Funciona:**

1. Código está montado via volume: `/home/agents/KanbanWoot:/app`
2. Webpack detecta mudanças automaticamente
3. Hot reload funciona igual ao systemd

### **Testar:**

```bash
# Editar arquivo
nano /home/agents/KanbanWoot/src/components/KanbanBoardFull.jsx

# Salvar e aguardar
# Webpack recompila automaticamente (5-10 segundos)
# Navegador atualiza automaticamente
```

---

## 📊 **Comparação de Performance:**

| Métrica | Systemd | Docker |
|---------|---------|--------|
| Tempo de Start | ~15s | ~25s (npm install + start) |
| Hot Reload | ~5s | ~5s (igual) |
| Uso de RAM | 405 MB | ~450 MB |
| Uso de CPU | Similar | Similar |

**Diferença:** Praticamente imperceptível!

---

## ✅ **Benefícios Alcançados:**

1. ✅ **Padronização Completa**
   - Todos os staging agora em Docker
   - Workflow unificado

2. ✅ **Isolamento**
   - Node_modules próprio
   - Sem conflitos com sistema

3. ✅ **Portabilidade**
   - Pode mover para outro servidor
   - docker-compose.dev.yml versionado

4. ✅ **Hot Reload Mantido**
   - Mesma experiência de dev
   - Zero perda de produtividade

---

## 🎯 **Infraestrutura Agora (100% Padronizada):**

### **STAGING/DEV - Todos em Docker:**
```
✅ Chatwoot:   Docker (3333)
✅ Evolution:  Docker (8085)
✅ Disparador: Docker (3020)
✅ KanbanWoot: Docker (3005) ← MIGRADO!
```

### **PRODUÇÃO - Todos em Kubernetes:**
```
✅ Chatwoot:   K8s (30080)
✅ Evolution:  K8s (30085)
✅ Disparador: K8s (30020)
✅ KanbanWoot: K8s (30305)
```

**100% padronizado!** 🎉

---

## 🗑️ **Limpeza (Opcional):**

Se quiser remover completamente o systemd service:

```bash
sudo rm /etc/systemd/system/kanbanwoot.service
sudo systemctl daemon-reload
```

---

## 🔄 **Rollback (se necessário):**

Se quiser voltar para systemd:

```bash
# Parar Docker
docker stop kanbanwoot-dev && docker rm kanbanwoot-dev

# Reativar systemd
sudo systemctl enable kanbanwoot
sudo systemctl start kanbanwoot
```

---

**Migração concluída com sucesso!** ✅

**KanbanWoot Dev agora roda em Docker com hot reload mantido!**

---

**Criado em:** 2025-10-30
**Status:** ✅ Funcionando
