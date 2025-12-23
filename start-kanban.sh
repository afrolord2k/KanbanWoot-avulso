#!/bin/bash
# Script para iniciar KanbanWoot em modo permanente

cd /home/agents/KanbanWoot

# Exportar variáveis de ambiente
export HOST=0.0.0.0
export PORT=3005
export REACT_APP_CHATWOOT_URL=http://195.35.19.73:30080
export REACT_APP_CHATWOOT_ACCOUNT_ID=1
export REACT_APP_CHATWOOT_TOKEN=0f357dadc5333700fae0895dbb1b1c2f601ca81f8bf2818653255765506d9cab
export REACT_APP_DEBUG=false

# Iniciar servidor
npm start
