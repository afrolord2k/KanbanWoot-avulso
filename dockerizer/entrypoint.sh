#!/bin/sh

# Define o caminho do arquivo .env.js na raiz do projeto servido
ENV_FILE="/usr/share/nginx/html/.env.js"

echo "Gerando arquivo de variáveis de ambiente: $ENV_FILE"

# MULTI-TENANT: Cria arquivo que detecta Account ID do hostname
# Este código JavaScript será executado ANTES do React carregar
cat <<'EOF' > "$ENV_FILE"
(function() {
  // Detecta Account ID do subdomínio
  var hostname = window.location.hostname;
  var match = hostname.match(/^(\d+)\.agentesintegrados\.com$/);
  var accountId = match ? match[1] : '1';

  console.log('[MULTI-TENANT] Hostname:', hostname);
  console.log('[MULTI-TENANT] Account ID detectado:', accountId);

  // Injeta variáveis de ambiente
  window._env_ = {
    REACT_APP_CHATWOOT_URL: "CHATWOOT_URL_PLACEHOLDER",
    REACT_APP_CHATWOOT_TOKEN: "CHATWOOT_TOKEN_PLACEHOLDER",
    REACT_APP_CHATWOOT_ACCOUNT_ID: accountId,
    REACT_APP_DEBUG: "DEBUG_PLACEHOLDER"
  };

  // DEBUG: Mostra no título
  document.title = 'KanbanWoot - Account ' + accountId;

  // Detecta se está em iframe (dentro do Chatwoot)
  window._env_.IS_IFRAME = (window.self !== window.top);

  // Detecta se está em modo embed (parâmetro URL)
  var urlParams = new URLSearchParams(window.location.search);
  var isEmbed = urlParams.get('embed') === 'true';

  console.log('[EMBED] Modo embed:', isEmbed);

  // SEGURANÇA: Verifica autenticação APENAS se NÃO estiver em modo embed
  if (!isEmbed && !window._env_.IS_IFRAME) {
    setTimeout(function() {
      // Verifica se tem cookie de sessão do Chatwoot
      var hasChatwootSession = document.cookie.indexOf('_chatwoot_session') !== -1;

      console.log('[AUTH] Cookie Chatwoot encontrado:', hasChatwootSession);

      if (!hasChatwootSession) {
        console.warn('[AUTH] Sem sessão do Chatwoot, redirecionando para Kanban do Chatwoot...');
        // Redireciona para o Kanban nativo do Chatwoot da conta correspondente
        window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        return;
      }

      // Se tem cookie, faz requisição sem API token para validar sessão
      var testUrl = window._env_.REACT_APP_CHATWOOT_URL + '/api/v1/profile';

      fetch(testUrl, {
        credentials: 'include'  // Envia cookies
      }).then(function(response) {
        if (response.status === 401 || response.status === 403) {
          console.warn('[AUTH] Sessão inválida (HTTP ' + response.status + '), redirecionando para Kanban do Chatwoot...');
          // Redireciona para o Kanban nativo do Chatwoot
          window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
        } else {
          console.log('[AUTH] Autenticado com sucesso (HTTP ' + response.status + ')');
        }
      }).catch(function(error) {
        console.error('[AUTH] Erro ao verificar autenticação:', error);
        // Em caso de erro de rede, redireciona por segurança para o Kanban do Chatwoot
        window.location.href = window._env_.REACT_APP_CHATWOOT_URL + '/app/accounts/' + accountId + '/kanban';
      });
    }, 1000);
  } else {
    console.log('[AUTH] Modo embed ativado - pulando verificação de autenticação');
  }
})();
EOF

# Substitui placeholders com valores reais
sed -i "s|CHATWOOT_URL_PLACEHOLDER|${REACT_APP_CHATWOOT_URL}|g" "$ENV_FILE"
sed -i "s|CHATWOOT_TOKEN_PLACEHOLDER|${REACT_APP_CHATWOOT_TOKEN}|g" "$ENV_FILE"
sed -i "s|DEBUG_PLACEHOLDER|${REACT_APP_DEBUG:-false}|g" "$ENV_FILE"

echo "Arquivo .env.js gerado com sucesso (Multi-Tenant):"
cat "$ENV_FILE"

# Inicia o Nginx
exec nginx -g "daemon off;"