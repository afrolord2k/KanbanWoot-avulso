//api.js - MULTI-TENANT VERSION 2.0 - MODIFIED
import { debugLog } from './debug';
console.log('🚀 API Module Loading - Multi-Tenant Enabled');

// Configurações da API do Chatwoot vindas do window._env_ (Docker) ou process.env (dev)
const CHATWOOT_URL = (window._env_ && window._env_.REACT_APP_CHATWOOT_URL) || process.env.REACT_APP_CHATWOOT_URL || '';
const TOKEN = (window._env_ && window._env_.REACT_APP_CHATWOOT_TOKEN) || process.env.REACT_APP_CHATWOOT_TOKEN || '';

// Função para detectar Account ID do subdomínio (executa em runtime, não em build-time)
function getAccountId() {
  const hostname = window.location.hostname;

  // Padrão: {account_id}.agentesintegrados.com
  const subdomainMatch = hostname.match(/^(\d+)\.agentesintegrados\.com$/);

  if (subdomainMatch) {
    const accountId = subdomainMatch[1];
    // DEBUG: Mostrar no título da página para verificar
    document.title = `KanbanWoot - Account ${accountId}`;
    return accountId;
  }

  // Fallback: usar variável de ambiente
  const envAccountId = (window._env_ && window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID)
    || process.env.REACT_APP_CHATWOOT_ACCOUNT_ID
    || '1';

  document.title = `KanbanWoot - Account ${envAccountId} (ENV)`;
  return envAccountId;
}

const chatwootHeaders = {
  'Content-Type': 'application/json',
  'api_access_token': TOKEN,
  'X-KanbanWoot-Version': 'multi-tenant-v2'
};

async function chatwootFetch(endpoint, options = {}) {
  const ACCOUNT_ID = getAccountId(); // Chama função em runtime para detectar account
  const url = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}${endpoint}`;

  console.log('[API CALL - MULTI-TENANT]', {
    ACCOUNT_ID,
    endpoint,
    url,
    hostname: window.location.hostname
  });

  debugLog('chatwootFetch', url, options);
  try {
    const response = await fetch(url, { ...options, headers: chatwootHeaders });
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    if (!response.ok) {
      // Se não autenticado, redireciona para login do Chatwoot
      if (response.status === 401 || response.status === 403) {
        console.warn('[AUTH] Não autenticado, redirecionando para login...');
        window.location.href = `${CHATWOOT_URL}/app/login`;
        return;
      }

      const errorDetails = {
        message: `Erro na API: ${url} ${response.status}`,
        status: response.status,
        url,
        method: options.method || 'GET',
        requestBody: options.body,
        headers: chatwootHeaders,
        response: responseData,
        stack: (new Error()).stack
      };
      debugLog('Detalhes do erro Chatwoot:', errorDetails);
      const error = new Error(errorDetails.message);
      Object.assign(error, errorDetails);
      throw error;
    }
    return responseData;
  } catch (error) {
    debugLog('Erro na requisição Chatwoot:', error);
    throw error;
  }
}

debugLog('api.js: módulo carregado');

// Retorna todos os contatos
export async function getContacts() {
  debugLog('api.js: getContacts chamado');
  try {
    const data = await chatwootFetch('/contacts');
    return data.payload || [];
  } catch (error) {
    debugLog('Erro ao buscar contatos:', error);
    throw error;
  }
}

// Retorna todos os atributos customizados (lista) apenas do tipo contact_attribute
export async function getCustomAttributes() {
  debugLog('api.js: getCustomAttributes chamado');
  try {
    // Busca todos os atributos customizados
    const data = await chatwootFetch('/custom_attribute_definitions');
    console.log('[getCustomAttributes] Resposta da API:', data);
    // Filtra apenas os de contato
    const all = data.payload || data || [];
    console.log('[getCustomAttributes] Array completo:', all);
    const filtered = Array.isArray(all)
      ? all.filter(attr => attr.attribute_model === 'contact_attribute')
      : [];
    console.log('[getCustomAttributes] Atributos filtrados:', filtered);
    return filtered;
  } catch (error) {
    console.error('[getCustomAttributes] ERRO:', error);
    debugLog('Erro ao buscar atributos customizados:', error);
    throw error;
  }
}

// Retorna um atributo customizado específico pelo ID
export async function getCustomAttributeById(id) {
  debugLog('api.js: getCustomAttributeById chamado', id);
  try {
    const data = await chatwootFetch(`/custom_attribute_definitions/${id}`);
    return data.payload || data; // pode vir como objeto direto
  } catch (error) {
    debugLog('Erro ao buscar atributo customizado por ID:', error);
    throw error;
  }
}

// Atualiza o valor de um atributo customizado do contato
export async function updateContactCustomAttribute(contactId, attributeKey, value) {
  debugLog('api.js: updateContactCustomAttribute chamado', contactId, attributeKey, value);
  try {
    return await chatwootFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ custom_attributes: { [attributeKey]: value } })
    });
  } catch (error) {
    debugLog('Erro ao atualizar atributo customizado:', error);
    throw error;
  }
}

// Retorna todas as labels/tags do Chatwoot
export async function getLabels() {
  debugLog('api.js: getLabels chamado');
  try {
    const data = await chatwootFetch('/labels');
    return data.payload || data || [];
  } catch (error) {
    debugLog('Erro ao buscar labels:', error);
    return [];
  }
}

// Retorna as conversas de um contato específico
export async function getContactConversations(contactId) {
  debugLog('api.js: getContactConversations chamado', contactId);
  try {
    const data = await chatwootFetch(`/contacts/${contactId}/conversations`);
    return data.payload || data || [];
  } catch (error) {
    debugLog('Erro ao buscar conversas do contato:', error);
    return [];
  }
}