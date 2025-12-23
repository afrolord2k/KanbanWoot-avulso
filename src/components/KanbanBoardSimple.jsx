// KanbanBoardSimple.jsx - Versão simplificada para debug
import React, { useEffect, useState } from 'react';

function KanbanBoardSimple() {
  const [status, setStatus] = useState('Iniciando...');
  const [attributes, setAttributes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[SIMPLE] Componente montado');
    setStatus('Carregando dados...');

    async function loadData() {
      try {
        const API_URL = process.env.REACT_APP_CHATWOOT_URL || '';
        const ACCOUNT_ID = process.env.REACT_APP_CHATWOOT_ACCOUNT_ID || '';
        const TOKEN = process.env.REACT_APP_CHATWOOT_TOKEN || '';

        console.log('[SIMPLE] Config:', { API_URL, ACCOUNT_ID, TOKEN: TOKEN ? '***' + TOKEN.slice(-4) : 'VAZIO' });

        if (!API_URL || !ACCOUNT_ID || !TOKEN) {
          throw new Error('Variáveis de ambiente não configuradas');
        }

        setStatus('Buscando atributos...');

        // Buscar atributos
        const attrsResponse = await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/custom_attribute_definitions`, {
          headers: { 'api_access_token': TOKEN }
        });

        if (!attrsResponse.ok) {
          throw new Error(`Erro HTTP: ${attrsResponse.status}`);
        }

        const attrsData = await attrsResponse.json();
        console.log('[SIMPLE] Atributos recebidos:', attrsData);

        const listAttrs = attrsData.filter(attr =>
          attr.attribute_model === 'contact_attribute' &&
          attr.attribute_display_type === 'list'
        );

        setAttributes(listAttrs);
        setStatus('Buscando contatos...');

        // Buscar contatos
        const contactsResponse = await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts`, {
          headers: { 'api_access_token': TOKEN }
        });

        if (!contactsResponse.ok) {
          throw new Error(`Erro HTTP: ${contactsResponse.status}`);
        }

        const contactsData = await contactsResponse.json();
        console.log('[SIMPLE] Contatos recebidos:', contactsData);

        const contactsList = contactsData.payload || contactsData || [];
        setContacts(contactsList);

        setStatus('Carregamento completo!');

      } catch (err) {
        console.error('[SIMPLE] ERRO:', err);
        setError(err.message);
        setStatus('Erro ao carregar');
      }
    }

    loadData();
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px', background: '#fee', border: '2px solid red' }}>
        <h2>❌ Erro</h2>
        <p>{error}</p>
      </div>
    );
  }

  const styles = {
    container: {
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f9fafb',
      minHeight: '100vh'
    },
    header: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    section: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    attrList: {
      listStyle: 'none',
      padding: 0
    },
    attrItem: {
      padding: '10px',
      marginBottom: '10px',
      backgroundColor: '#f3f4f6',
      borderRadius: '6px',
      borderLeft: '4px solid #3b82f6'
    },
    valueList: {
      listStyle: 'none',
      padding: '5px 0 0 20px',
      margin: 0
    },
    valueBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      margin: '4px',
      backgroundColor: '#e0e7ff',
      color: '#3730a3',
      borderRadius: '12px',
      fontSize: '14px'
    },
    contactItem: {
      padding: '15px',
      marginBottom: '10px',
      backgroundColor: '#f9fafb',
      borderRadius: '6px',
      border: '1px solid #e5e7eb'
    },
    contactName: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: '5px'
    },
    contactEmail: {
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '10px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#1f2937' }}>
          🧪 KanbanWoot - Dashboard
        </h1>
        <p style={{ margin: '10px 0 0 0', color: '#6b7280' }}>
          <strong>Status:</strong> {status}
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={{ fontSize: '20px', color: '#1f2937', marginTop: 0 }}>
          📋 Atributos Customizados ({attributes.length})
        </h2>
        {attributes.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Nenhum atributo do tipo lista encontrado.</p>
        ) : (
          <ul style={styles.attrList}>
            {attributes.map(attr => (
              <li key={attr.id} style={styles.attrItem}>
                <strong style={{ fontSize: '16px', color: '#1f2937' }}>
                  {attr.attribute_display_name}
                </strong>
                {' '}
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  ({attr.attribute_key})
                </span>
                <div style={{ marginTop: '10px' }}>
                  {attr.attribute_values.map(val => (
                    <span key={val} style={styles.valueBadge}>{val}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={styles.section}>
        <h2 style={{ fontSize: '20px', color: '#1f2937', marginTop: 0 }}>
          👥 Contatos ({contacts.length})
        </h2>
        {contacts.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Nenhum contato encontrado.</p>
        ) : (
          <div>
            {contacts.map(contact => (
              <div key={contact.id} style={styles.contactItem}>
                <div style={styles.contactName}>{contact.name}</div>
                <div style={styles.contactEmail}>{contact.email}</div>
                {contact.custom_attributes && Object.keys(contact.custom_attributes).length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <strong style={{ fontSize: '14px', color: '#6b7280' }}>Atributos:</strong>
                    <div style={{ marginTop: '5px' }}>
                      {Object.entries(contact.custom_attributes).map(([key, value]) => (
                        <div key={key} style={{ fontSize: '14px', margin: '4px 0' }}>
                          <span style={{ color: '#6b7280' }}>{key}:</span>{' '}
                          <span style={{ ...styles.valueBadge, backgroundColor: '#fef3c7', color: '#92400e' }}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanBoardSimple;
