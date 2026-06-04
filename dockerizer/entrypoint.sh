#!/bin/sh
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
  if (!isEmbed && !window._env_.IS_IFRAME) {
    setTimeout(function() {
      var hasChatwootSession = document.cookie.indexOf('_chatwoot_session') !== -1;
      if (!hasChatwootSession) {
        window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        return;
      }
      fetch(window._env_.REACT_APP_CHATWOOT_URL + '/api/v1/profile', { credentials: 'include' })
        .then(function(r) {
          if (r.status === 401 || r.status === 403) {
            window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
          }
        }).catch(function() {
          window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        });
    }, 1000);
  }
})();
EOF
sed -i "s|CHATWOOT_URL_PLACEHOLDER|${REACT_APP_CHATWOOT_URL}|g" "$ENV_FILE"
sed -i "s|CHATWOOT_TOKEN_PLACEHOLDER|${REACT_APP_CHATWOOT_TOKEN}|g" "$ENV_FILE"
sed -i "s|DEBUG_PLACEHOLDER|${REACT_APP_DEBUG:-false}|g" "$ENV_FILE"
echo "Arquivo .env.js gerado."

# Inicia Kanban API
echo "Iniciando Kanban API na porta 3002..."
cd /app/kanban-api
PORT=3002 DATABASE_URL="${DATABASE_URL:-postgresql://chatwoot:ChatwootNaturLab2024@172.23.0.4:5432/chatwoot}" /usr/bin/node server.js >> /tmp/kanban-api.log 2>&1 &
echo "Kanban API PID: $!"

# Inicia Nginx
exec nginx -g "daemon off;"
