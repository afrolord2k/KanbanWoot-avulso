#!/bin/sh
# Define o caminho do arquivo .env.js na raiz do projeto servido
ENV_FILE="/usr/share/nginx/html/.env.js"
echo "Gerando arquivo de variáveis de ambiente: $ENV_FILE"
cat <<'EOF' > "$ENV_FILE"
(function() {
  var hostname = window.location.hostname;
  var match = hostname.match(/^(\d+)\.agentesintegrados\.com$/);
  var accountId = match ? match[1] : '1';
  console.log('[MULTI-TENANT] Hostname:', hostname);
  console.log('[MULTI-TENANT] Account ID detectado:', accountId);
  window._env_ = {
    REACT_APP_CHATWOOT_URL: "CHATWOOT_URL_PLACEHOLDER",
    REACT_APP_CHATWOOT_TOKEN: "CHATWOOT_TOKEN_PLACEHOLDER",
    REACT_APP_CHATWOOT_ACCOUNT_ID: accountId,
    REACT_APP_DEBUG: "DEBUG_PLACEHOLDER"
  };
  document.title = 'KanbanWoot - Account ' + accountId;
  window._env_.IS_IFRAME = (window.self !== window.top);
  var urlParams = new URLSearchParams(window.location.search);
  var isEmbed = urlParams.get('embed') === 'true';
  console.log('[EMBED] Modo embed:', isEmbed);
  if (!isEmbed && !window._env_.IS_IFRAME) {
    setTimeout(function() {
      var hasChatwootSession = document.cookie.indexOf('_chatwoot_session') !== -1;
      console.log('[AUTH] Cookie Chatwoot encontrado:', hasChatwootSession);
      if (!hasChatwootSession) {
        console.warn('[AUTH] Sem sessão do Chatwoot, redirecionando...');
        window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        return;
      }
      var testUrl = window._env_.REACT_APP_CHATWOOT_URL + '/api/v1/profile';
      fetch(testUrl, { credentials: 'include' }).then(function(response) {
        if (response.status === 401 || response.status === 403) {
          console.warn('[AUTH] Sessão inválida (HTTP ' + response.status + '), redirecionando...');
          window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        } else {
          console.log('[AUTH] Autenticado com sucesso (HTTP ' + response.status + ')');
        }
      }).catch(function(error) {
        console.error('[AUTH] Erro ao verificar autenticação:', error);
        window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
      });
    }, 1000);
  } else {
    console.log('[AUTH] Modo embed ativado - pulando verificação de autenticação');
  }
})();
EOF

sed -i "s|CHATWOOT_URL_PLACEHOLDER|${REACT_APP_CHATWOOT_URL}|g" "$ENV_FILE"
sed -i "s|CHATWOOT_TOKEN_PLACEHOLDER|${REACT_APP_CHATWOOT_TOKEN}|g" "$ENV_FILE"
sed -i "s|DEBUG_PLACEHOLDER|${REACT_APP_DEBUG:-false}|g" "$ENV_FILE"

echo "Arquivo .env.js gerado com sucesso."

# ── Iniciar Kanban API (Node.js) ──────────────────────────────────────────────
echo "Iniciando Kanban API na porta 3001..."
cd /app/kanban-api
DATABASE_URL="${DATABASE_URL:-postgresql://chatwoot:ChatwootNaturLab2024@chatwoot-postgres:5432/chatwoot}" \
  node server.js >> /tmp/kanban-api.log 2>&1 &
echo "Kanban API iniciada. PID: $!"

# ── Iniciar Nginx ─────────────────────────────────────────────────────────────
echo "Iniciando Nginx..."
exec nginx -g "daemon off;"
