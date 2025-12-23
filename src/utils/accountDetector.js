/**
 * Detecta o Account ID baseado no subdomínio
 *
 * Exemplos:
 * - 1.agentesintegrados.com → Account ID: 1
 * - 2.agentesintegrados.com → Account ID: 2
 * - kanban.agentesintegrados.com → Account ID do ENV (fallback)
 * - agentesintegrados.com/kanbanwoot → Account ID do ENV (fallback)
 */

export function getAccountIdFromSubdomain() {
  const hostname = window.location.hostname;

  console.log('[AccountDetector] Hostname:', hostname);

  // Padrão: {account_id}.agentesintegrados.com
  const subdomainMatch = hostname.match(/^(\d+)\.agentesintegrados\.com$/);

  if (subdomainMatch) {
    const accountId = subdomainMatch[1];
    console.log('[AccountDetector] Account ID detectado do subdomínio:', accountId);
    return accountId;
  }

  // Fallback: usar variável de ambiente
  const envAccountId = (window._env_ && window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID)
    || process.env.REACT_APP_CHATWOOT_ACCOUNT_ID
    || '1'; // Default para account 1

  console.log('[AccountDetector] Account ID do ENV (fallback):', envAccountId);
  return envAccountId;
}

/**
 * Retorna informações completas sobre a conta atual
 */
export function getAccountInfo() {
  const accountId = getAccountIdFromSubdomain();
  const hostname = window.location.hostname;
  const isSubdomainBased = /^\d+\.agentesintegrados\.com$/.test(hostname);

  return {
    accountId,
    hostname,
    isSubdomainBased,
    source: isSubdomainBased ? 'subdomain' : 'environment'
  };
}
