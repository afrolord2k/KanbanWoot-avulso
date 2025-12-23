// KanbanBoardFull.jsx - Board Kanban completo com drag-and-drop
import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function KanbanBoardFull() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [columns, setColumns] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [labelsMap, setLabelsMap] = useState({}); // Mapa de labels por cor
  const [contactLabels, setContactLabels] = useState({}); // Labels por contato ID
  const [hiddenCards, setHiddenCards] = useState(new Set()); // IDs dos cards ocultos
  const [showHidden, setShowHidden] = useState(false); // Toggle para mostrar ocultos

  // Detecta se está em iframe (dentro do Chatwoot)
  // Dupla verificação: window API + parâmetro URL
  const urlParams = new URLSearchParams(window.location.search);
  const isEmbedParam = urlParams.get('embed') === 'true';
  const isIframe = (window.self !== window.top) || isEmbedParam;

  // Usar window._env_ (Docker) ou process.env (dev)
  const API_URL = (window._env_?.REACT_APP_CHATWOOT_URL || process.env.REACT_APP_CHATWOOT_URL || '');
  const ACCOUNT_ID = (window._env_?.REACT_APP_CHATWOOT_ACCOUNT_ID || process.env.REACT_APP_CHATWOOT_ACCOUNT_ID || '');
  const TOKEN = (window._env_?.REACT_APP_CHATWOOT_TOKEN || process.env.REACT_APP_CHATWOOT_TOKEN || '');

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
  }, []);

  // Organizar contatos em colunas quando mudar atributo, contatos ou filtro de ocultos
  useEffect(() => {
    if (selectedAttribute && contacts.length > 0) {
      organizeColumns();
    }
  }, [selectedAttribute, contacts, hiddenCards, showHidden]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      console.log('[KanbanBoard] Carregando dados...');

      // 1. Buscar labels do Chatwoot
      const labelsResponse = await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/labels`, {
        headers: { 'api_access_token': TOKEN }
      });
      const labelsData = await labelsResponse.json();
      const labels = labelsData.payload || labelsData || [];

      // Criar mapa de labels por título
      const labelMap = {};
      labels.forEach(label => {
        labelMap[label.title] = label;
      });
      setLabelsMap(labelMap);
      console.log('[KanbanBoard] Labels carregadas:', labels.length);

      // 2. Buscar atributos
      const attrsResponse = await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/custom_attribute_definitions`, {
        headers: { 'api_access_token': TOKEN }
      });
      const attrsData = await attrsResponse.json();

      const listAttrs = attrsData.filter(attr =>
        attr.attribute_model === 'contact_attribute' &&
        attr.attribute_display_type === 'list'
      );

      setAttributes(listAttrs);

      // Selecionar primeiro atributo ou o que começa com kbw_
      const defaultAttr = listAttrs.find(a => a.attribute_key.startsWith('kbw_')) || listAttrs[0];
      setSelectedAttribute(defaultAttr);

      // 3. Buscar contatos
      const contactsResponse = await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts`, {
        headers: { 'api_access_token': TOKEN }
      });
      const contactsData = await contactsResponse.json();
      const contactsList = contactsData.payload || contactsData || [];
      setContacts(contactsList);
      console.log('[KanbanBoard] Contatos carregados:', contactsList.length);

      // 4. Buscar conversas e labels de cada contato (em background)
      loadContactLabels(contactsList);

      setLoading(false);
    } catch (err) {
      console.error('[KanbanBoard] Erro ao carregar dados:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  // Função para carregar labels das conversas de cada contato
  async function loadContactLabels(contactsList) {
    const labelsPerContact = {};

    // Buscar em paralelo (mas limitado para não sobrecarregar)
    const batchSize = 5;
    for (let i = 0; i < contactsList.length; i += batchSize) {
      const batch = contactsList.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (contact) => {
          try {
            const convResponse = await fetch(
              `${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}/conversations`,
              { headers: { 'api_access_token': TOKEN } }
            );
            const convData = await convResponse.json();
            const conversations = convData.payload || convData || [];

            // Coletar todas as labels únicas de todas as conversas do contato
            const allLabels = new Set();
            conversations.forEach(conv => {
              if (conv.labels && Array.isArray(conv.labels)) {
                conv.labels.forEach(label => allLabels.add(label));
              }
            });

            labelsPerContact[contact.id] = Array.from(allLabels);
          } catch (error) {
            console.warn(`[KanbanBoard] Erro ao carregar conversas do contato ${contact.id}:`, error);
            labelsPerContact[contact.id] = [];
          }
        })
      );
    }

    setContactLabels(labelsPerContact);
    console.log('[KanbanBoard] Labels das conversas carregadas');
  }

  function organizeColumns() {
    const organized = {};

    // Criar colunas para cada valor do atributo
    selectedAttribute.attribute_values.forEach(value => {
      organized[value] = [];
    });

    // Distribuir contatos (apenas os que têm valor definido)
    contacts.forEach(contact => {
      const value = contact.custom_attributes?.[selectedAttribute.attribute_key];

      // Só adicionar se tiver valor definido E (mostrar todos OU não estiver oculto)
      if (value && organized[value]) {
        if (showHidden || !hiddenCards.has(contact.id)) {
          organized[value].push(contact);
        }
      }
    });

    setColumns(organized);
  }

  // Função para ocultar/mostrar card
  const toggleHideCard = (contactId) => {
    setHiddenCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  async function handleDragEnd(result) {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Atualizar localmente
    const sourceColumn = [...columns[source.droppableId]];
    const destColumn = source.droppableId === destination.droppableId
      ? sourceColumn
      : [...columns[destination.droppableId]];

    const [movedContact] = sourceColumn.splice(source.index, 1);
    destColumn.splice(destination.index, 0, movedContact);

    const newColumns = {
      ...columns,
      [source.droppableId]: sourceColumn,
      [destination.droppableId]: destColumn
    };

    setColumns(newColumns);

    // Atualizar no backend
    try {
      const newValue = destination.droppableId;

      const body = {
        custom_attributes: {
          [selectedAttribute.attribute_key]: newValue
        }
      };

      await fetch(`${API_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${movedContact.id}`, {
        method: 'PUT',
        headers: {
          'api_access_token': TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error('Erro ao atualizar contato:', err);
      // Reverter mudança local
      loadData();
    }
  }

  // Detectar tamanho da tela com breakpoints
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    isMobile: window.innerWidth <= 768,
    isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
    isDesktop: window.innerWidth > 1024
  });

  // Mapa de cores para etiquetas baseado no tipo de atributo e valor
  const getTagColor = (attributeKey, value) => {
    // Cores para Status do Funil
    if (attributeKey.includes('funil') || attributeKey.includes('status')) {
      const statusColors = {
        'Novo': { bg: '#e3f2fd', color: '#1565c0', icon: '🆕' },
        'Reunião Realizada': { bg: '#f3e5f5', color: '#6a1b9a', icon: '🤝' },
        'Negociação': { bg: '#fce4ec', color: '#c2185b', icon: '💬' },
        'Última Chance': { bg: '#fff9c4', color: '#f57f17', icon: '⏰' },
        'Token $BR': { bg: '#e8f5e9', color: '#2e7d32', icon: '💰' }
      };
      return statusColors[value] || { bg: '#f5f5f5', color: '#666', icon: '📋' };
    }

    // Cores para Prioridade
    if (attributeKey.includes('prioridade') || attributeKey.includes('priority')) {
      const priorityColors = {
        'Baixa/Acervo': { bg: '#e8f5e9', color: '#2e7d32', icon: '📚' },
        'Média/10x': { bg: '#fff3e0', color: '#f57c00', icon: '⚡' },
        'Alta/20x': { bg: '#ffcdd2', color: '#c62828', icon: '🚀' }
      };
      return priorityColors[value] || { bg: '#f5f5f5', color: '#666', icon: '⚡' };
    }

    // Cor padrão para outros atributos
    return { bg: '#e0e7ff', color: '#3730a3', icon: '🏷️' };
  };

  // Atualizar ao redimensionar
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        width,
        isMobile: width <= 768,
        isTablet: width > 768 && width <= 1024,
        isDesktop: width > 1024
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenSize.isMobile;
  const isTablet = screenSize.isTablet;

  // Estilos
  const styles = {
    container: {
      backgroundColor: '#f0f2f5',
      minHeight: '100vh',
      padding: isMobile ? '10px' : '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      backgroundColor: 'white',
      padding: isMobile ? '15px' : '20px',
      borderRadius: isMobile ? '8px' : '12px',
      marginBottom: isMobile ? '10px' : '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '15px',
      // Sticky no mobile
      position: isMobile ? 'sticky' : 'relative',
      top: isMobile ? 0 : 'auto',
      zIndex: isMobile ? 100 : 'auto'
    },
    title: {
      margin: 0,
      fontSize: isMobile ? '18px' : '24px',
      color: '#1a1a1a',
      fontWeight: '600'
    },
    select: {
      padding: isMobile ? '8px 12px' : '10px 15px',
      fontSize: '14px',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: 'white',
      cursor: 'pointer',
      outline: 'none',
      minWidth: isMobile ? '100%' : '200px',
      maxWidth: isMobile ? '100%' : 'none'
    },
    toggleContainer: {
      display: 'flex',
      backgroundColor: 'white',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      overflow: 'hidden',
      width: isMobile ? '100%' : 'auto'
    },
    toggleButton: {
      padding: isMobile ? '10px 16px' : '10px 20px',
      fontSize: '14px',
      border: '2px solid #e0e0e0',
      backgroundColor: 'white',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
      flex: isMobile ? 1 : 'none',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit'
    },
    refreshButton: {
      padding: isMobile ? '10px' : '12px',
      backgroundColor: 'white',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      outline: 'none',
      color: '#666'
    },
    hideButton: {
      position: 'absolute',
      top: '8px',
      right: isMobile ? '36px' : '32px',
      backgroundColor: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '12px',
      cursor: 'pointer',
      zIndex: 10,
      color: '#666',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    toggleHiddenButton: {
      padding: isMobile ? '10px' : '12px',
      backgroundColor: showHidden ? '#1976d2' : 'white',
      color: showHidden ? 'white' : '#666',
      border: '2px solid',
      borderColor: showHidden ? '#1976d2' : '#e0e0e0',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease',
      outline: 'none',
      fontSize: '14px',
      fontWeight: showHidden ? '600' : '400'
    },
    board: {
      display: 'flex',
      gap: isMobile ? '12px' : (isTablet ? '16px' : '20px'),
      overflowX: 'auto',
      paddingBottom: '20px',
      paddingRight: isMobile ? '10px' : '0',
      // Scroll suave e otimizado
      scrollBehavior: 'smooth',
      WebkitOverflowScrolling: 'touch',
      // Snap para colunas no mobile
      scrollSnapType: isMobile ? 'x mandatory' : 'none',
      // Esconder scrollbar mas manter funcionalidade
      scrollbarWidth: 'thin',
      scrollbarColor: '#cbd5e0 #f0f2f5',
      // Webkit scrollbar
      '::-webkit-scrollbar': {
        height: '8px'
      }
    },
    column: {
      backgroundColor: '#f8f9fa',
      borderRadius: isMobile ? '8px' : '12px',
      minWidth: isMobile ? '90vw' : (isTablet ? '45vw' : '280px'),
      maxWidth: isMobile ? '90vw' : (isTablet ? '45vw' : '320px'),
      flex: isMobile ? '0 0 90vw' : (isTablet ? '0 0 45vw' : '0 0 auto'),
      padding: isMobile ? '12px' : '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      // Snap point para cada coluna no mobile
      scrollSnapAlign: isMobile ? 'center' : 'none',
      scrollSnapStop: isMobile ? 'always' : 'normal'
    },
    columnHeader: {
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: isMobile ? '10px' : '15px',
      padding: isMobile ? '10px 12px' : '10px',
      backgroundColor: 'white',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Sticky dentro da coluna no mobile
      position: isMobile ? 'sticky' : 'relative',
      top: isMobile ? 0 : 'auto',
      zIndex: 10,
      boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
    },
    badge: {
      backgroundColor: '#e3f2fd',
      color: '#1976d2',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: '500'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: isMobile ? '8px' : '10px',
      padding: isMobile ? '12px 12px 12px 12px' : '15px',
      paddingTop: isMobile ? '35px' : '15px',
      marginBottom: isMobile ? '10px' : '12px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      cursor: 'grab',
      transition: 'box-shadow 0.2s ease, transform 0.1s ease',
      border: '2px solid transparent',
      minHeight: isMobile ? '80px' : 'auto',
      touchAction: 'none',
      userSelect: 'none',
      // Prevenir movimento indesejado
      position: 'relative',
      transform: 'translate(0, 0)'
    },
    cardDragging: {
      opacity: '0.9',
      transform: 'rotate(2deg) scale(1.02)',
      boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
      cursor: 'grabbing',
      border: '2px solid #1976d2'
    },
    cardName: {
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: '6px',
      wordBreak: 'break-word'
    },
    cardEmail: {
      fontSize: isMobile ? '12px' : '13px',
      color: '#666',
      marginBottom: isMobile ? '8px' : '10px',
      wordBreak: 'break-all'
    },
    cardAttrs: {
      fontSize: isMobile ? '11px' : '12px',
      color: '#888',
      padding: isMobile ? '6px' : '8px',
      backgroundColor: '#f8f9fa',
      borderRadius: '6px',
      marginTop: '8px'
    },
    loading: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      color: '#666',
      fontSize: '16px'
    },
    error: {
      backgroundColor: '#fee',
      color: '#c00',
      padding: '20px',
      borderRadius: '8px',
      margin: '20px 0',
      border: '2px solid #fcc'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: isMobile ? '0' : '20px',
      animation: 'fadeIn 0.2s ease-out'
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: isMobile ? '16px 16px 0 0' : '12px',
      padding: isMobile ? '20px 20px 40px 20px' : '30px',
      maxWidth: isMobile ? '100%' : '600px',
      width: '100%',
      maxHeight: isMobile ? '85vh' : '90vh',
      overflowY: 'auto',
      position: 'relative',
      boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
      animation: isMobile ? 'slideUp 0.3s ease-out' : 'none',
      WebkitOverflowScrolling: 'touch'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '2px solid #f0f0f0'
    },
    closeButton: {
      backgroundColor: 'transparent',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#666',
      padding: '5px',
      lineHeight: 1
    },
    detailRow: {
      marginBottom: '15px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px'
    },
    detailLabel: {
      fontSize: '12px',
      color: '#666',
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: '5px'
    },
    detailValue: {
      fontSize: '15px',
      color: '#1a1a1a',
      wordBreak: 'break-word'
    },
    cardExpandButton: {
      position: 'absolute',
      top: isMobile ? '8px' : '8px',
      right: isMobile ? '8px' : '8px',
      backgroundColor: isMobile ? '#1976d2' : 'white',
      color: isMobile ? 'white' : '#666',
      border: isMobile ? 'none' : '1px solid #e0e0e0',
      borderRadius: isMobile ? '20px' : '4px',
      padding: isMobile ? '6px 12px' : '4px 8px',
      fontSize: isMobile ? '14px' : '12px',
      cursor: 'pointer',
      zIndex: 10,
      boxShadow: isMobile ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
      fontWeight: isMobile ? '500' : 'normal'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1976d2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'spin 1s linear infinite',
              marginBottom: '20px'
            }}
          >
            <circle cx="12" cy="12" r="10" stroke="#e0e0e0" />
            <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
          </svg>
          <div>Carregando lista de espera...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <strong>Erro:</strong> {error}
        </div>
      </div>
    );
  }

  if (!selectedAttribute) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          Nenhum atributo customizado do tipo lista encontrado.
        </div>
      </div>
    );
  }

  const columnOrder = [...selectedAttribute.attribute_values];

  // Renderizar modal de detalhes
  const renderModal = () => {
    if (!expandedCard) return null;

    return (
      <div style={styles.modal} onClick={() => setExpandedCard(null)}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>
              Detalhes do Contato
            </h2>
            <button style={styles.closeButton} onClick={() => setExpandedCard(null)}>
              ×
            </button>
          </div>

          <div style={styles.detailRow}>
            <div style={styles.detailLabel}>Nome</div>
            <div style={styles.detailValue}>{expandedCard.name || 'Sem nome'}</div>
          </div>

          <div style={styles.detailRow}>
            <div style={styles.detailLabel}>Email</div>
            <div style={styles.detailValue}>{expandedCard.email || 'Sem email'}</div>
          </div>

          {expandedCard.phone_number && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Telefone</div>
              <div style={styles.detailValue}>{expandedCard.phone_number}</div>
            </div>
          )}

          <div style={styles.detailRow}>
            <div style={styles.detailLabel}>ID</div>
            <div style={styles.detailValue}>#{expandedCard.id}</div>
          </div>

          {expandedCard.custom_attributes && Object.keys(expandedCard.custom_attributes).length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '16px', color: '#1a1a1a', marginBottom: '15px' }}>
                Atributos Customizados
              </h3>
              {Object.entries(expandedCard.custom_attributes).map(([key, value]) => {
                const attrDef = attributes.find(a => a.attribute_key === key);
                const displayName = attrDef?.attribute_display_name || key;

                return (
                  <div key={key} style={styles.detailRow}>
                    <div style={styles.detailLabel}>{displayName}</div>
                    <div style={styles.detailValue}>
                      <span style={{
                        ...styles.valueBadge,
                        backgroundColor: key === selectedAttribute?.attribute_key ? '#fef3c7' : '#e0e7ff',
                        color: key === selectedAttribute?.attribute_key ? '#92400e' : '#3730a3'
                      }}>
                        {value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #f0f0f0' }}>
            <a
              href={`${API_URL}/app/accounts/${ACCOUNT_ID}/contacts/${expandedCard.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Abrir no Chatwoot →
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderModal()}
      {/* Esconde header se estiver em iframe (dentro do Chatwoot) */}
      {!isIframe && (
      <div style={styles.header}>
        <h1 style={styles.title}>Lista de Espera</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {attributes.length > 1 && (
            attributes.length === 2 ? (
              // Toggle switch para 2 atributos
              <div style={styles.toggleContainer}>
                {attributes.map((attr, index) => {
                  const isActive = selectedAttribute?.attribute_key === attr.attribute_key;
                  return (
                    <button
                      key={attr.id}
                      onClick={() => setSelectedAttribute(attr)}
                      style={{
                        ...styles.toggleButton,
                        backgroundColor: isActive ? '#1976d2' : 'white',
                        color: isActive ? 'white' : '#666',
                        borderColor: isActive ? '#1976d2' : '#e0e0e0',
                        fontWeight: isActive ? '600' : '400',
                        borderRadius: index === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
                        borderRight: index === 0 ? 'none' : '2px solid #e0e0e0'
                      }}
                    >
                      {attr.attribute_display_name}
                    </button>
                  );
                })}
              </div>
            ) : (
            // Select dropdown para 3+ atributos
            <select
              value={selectedAttribute.attribute_key}
              onChange={(e) => {
                const attr = attributes.find(a => a.attribute_key === e.target.value);
                setSelectedAttribute(attr);
              }}
              style={styles.select}
            >
              {attributes.map(attr => (
                <option key={attr.id} value={attr.attribute_key}>
                  {attr.attribute_display_name}
                </option>
              ))}
            </select>
          )
          )}

          {/* Botão toggle mostrar ocultos */}
          {hiddenCards.size > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              style={styles.toggleHiddenButton}
              title={showHidden ? "Ocultar cards escondidos" : `Mostrar ${hiddenCards.size} card(s) oculto(s)`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showHidden ? (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {!isMobile && (showHidden ? 'Ocultar' : `${hiddenCards.size} oculto(s)`)}
            </button>
          )}

          {/* Botão de atualizar */}
          <button
            onClick={() => {
              loadData();
            }}
            style={styles.refreshButton}
            title="Atualizar dados"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={styles.board}>
          {columnOrder.map(columnKey => (
            <div key={columnKey} style={styles.column}>
              <div style={styles.columnHeader}>
                <span>{columnKey}</span>
                <span style={styles.badge}>
                  {columns[columnKey]?.length || 0}
                </span>
              </div>

              <Droppable droppableId={columnKey}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      minHeight: '100px',
                      backgroundColor: snapshot.isDraggingOver ? '#e3f2fd' : 'transparent',
                      borderRadius: '8px',
                      padding: '5px',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {columns[columnKey]?.map((contact, index) => (
                      <Draggable
                        key={contact.id}
                        draggableId={String(contact.id)}
                        index={index}
                      >
                        {(provided, snapshot) => {
                          const draggableStyle = provided.draggableProps.style;
                          const style = {
                            ...styles.card,
                            ...(snapshot.isDragging ? styles.cardDragging : {}),
                            position: 'relative',
                            // Corrigir posicionamento ao arrastar
                            ...draggableStyle,
                            // Prevenir offset indesejado
                            left: draggableStyle?.left || 0,
                            top: draggableStyle?.top || 0
                          };

                          return (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={style}
                          >
                            {/* Botão ocultar card */}
                            <button
                              style={styles.hideButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHideCard(contact.id);
                              }}
                              title={hiddenCards.has(contact.id) ? "Mostrar card" : "Ocultar card"}
                            >
                              <svg
                                width={isMobile ? "14" : "12"}
                                height={isMobile ? "14" : "12"}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            </button>

                            {/* Botão ver detalhes */}
                            <button
                              style={styles.cardExpandButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCard(contact);
                              }}
                              title="Ver detalhes"
                            >
                              <svg
                                width={isMobile ? "16" : "14"}
                                height={isMobile ? "16" : "14"}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: 'block' }}
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <div style={styles.cardName}>{contact.name}</div>
                            <div style={styles.cardEmail}>{contact.email || 'Sem email'}</div>

                            {/* Etiquetas de todos os atributos customizados */}
                            {contact.custom_attributes && Object.keys(contact.custom_attributes).length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                marginTop: '10px'
                              }}>
                                {Object.entries(contact.custom_attributes)
                                  .filter(([key]) => key !== selectedAttribute.attribute_key) // Não mostrar o atributo atual
                                  .map(([key, value]) => {
                                    const attrDef = attributes.find(a => a.attribute_key === key);
                                    const displayName = attrDef?.attribute_display_name || key;
                                    const colors = getTagColor(key, value);

                                    return (
                                      <div
                                        key={key}
                                        style={{
                                          display: 'inline-flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-start',
                                          gap: '3px'
                                        }}
                                      >
                                        <span style={{
                                          fontSize: '10px',
                                          color: '#999',
                                          fontWeight: '500',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px'
                                        }}>
                                          {displayName}
                                        </span>
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          padding: '5px 12px',
                                          backgroundColor: colors.bg,
                                          color: colors.color,
                                          borderRadius: '14px',
                                          fontSize: isMobile ? '11px' : '12px',
                                          fontWeight: '600',
                                          whiteSpace: 'nowrap',
                                          border: `1.5px solid ${colors.color}20`
                                        }}>
                                          <span style={{ fontSize: '12px', lineHeight: 1 }}>{colors.icon}</span>
                                          {value}
                                        </span>
                                      </div>
                                    );
                                  })
                                }

                                {/* Labels das conversas (Tags do Chatwoot) */}
                                {contactLabels[contact.id] && contactLabels[contact.id].length > 0 && (
                                  <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '4px',
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid #f0f0f0'
                                  }}>
                                    {contactLabels[contact.id].map(labelTitle => {
                                      const labelDef = labelsMap[labelTitle];
                                      const labelColor = labelDef?.color || '#666666';

                                      return (
                                        <span
                                          key={labelTitle}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            backgroundColor: `${labelColor}15`,
                                            color: labelColor,
                                            borderRadius: '10px',
                                            fontSize: '10px',
                                            fontWeight: '600',
                                            border: `1px solid ${labelColor}40`,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px'
                                          }}
                                          title={labelDef?.description || labelTitle}
                                        >
                                          <svg
                                            width="10"
                                            height="10"
                                            viewBox="0 0 24 24"
                                            fill={labelColor}
                                            stroke="none"
                                          >
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                            <line x1="7" y1="7" x2="7.01" y2="7" stroke={labelColor} strokeWidth="3" />
                                          </svg>
                                          {labelTitle}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default KanbanBoardFull;
