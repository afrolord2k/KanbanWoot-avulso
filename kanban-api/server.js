const http = require('http');
const { Client } = require('pg');
const PORT = process.env.PORT || 3002;
const PG_URL = process.env.DATABASE_URL || 'postgresql://chatwoot:ChatwootNaturLab2024@172.23.0.4:5432/chatwoot';

function getClient() { return new Client({ connectionString: PG_URL }); }

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,api_access_token,Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/$/, '');
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,api_access_token,Authorization'
    });
    return res.end();
  }

  if (path === '/api/health' && method === 'GET')
    return send(res, 200, { status: 'ok', ts: new Date().toISOString() });

  if (path === '/api/kanban/pipelines' && method === 'GET') {
    const db = getClient();
    try {
      await db.connect();
      const p = await db.query(
        `SELECT p.*, (SELECT COUNT(*) FROM kanban_cards kc
         JOIN kanban_columns kco ON kco.id = kc.kanban_column_id
         WHERE kco.kanban_pipeline_id = p.id) AS total_cards
         FROM kanban_pipelines p WHERE p.active = true ORDER BY p.position, p.id`
      );
      const c = await db.query(
        `SELECT kc.*, (SELECT COUNT(*) FROM kanban_cards WHERE kanban_column_id = kc.id) AS card_count
         FROM kanban_columns kc ORDER BY kc.kanban_pipeline_id, kc.position, kc.id`
      );
      const result = p.rows.map(pip => ({ ...pip, columns: c.rows.filter(col => col.kanban_pipeline_id == pip.id) }));
      return send(res, 200, { pipelines: result });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  if (path === '/api/kanban/pipelines' && method === 'POST') {
    const db = getClient();
    try {
      await db.connect();
      const body = await parseBody(req);
      const { name, description, color = '#6366F1', account_id = 1 } = body;
      if (!name) return send(res, 422, { error: 'name obrigatorio' });
      const r = await db.query(
        `INSERT INTO kanban_pipelines (name, description, color, account_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
        [name, description || null, color, account_id]
      );
      return send(res, 201, { pipeline: r.rows[0] });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  const cardsMatch = path.match(/^\/api\/kanban\/pipelines\/(\d+)\/cards$/);
  if (cardsMatch && method === 'GET') {
    const db = getClient();
    try {
      await db.connect();
      const pid = cardsMatch[1];
      const cid = url.searchParams.get('column_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      let where = 'kco.kanban_pipeline_id = $1';
      const params = [pid];
      if (cid) { where += ' AND kc.kanban_column_id = $2'; params.push(cid); }
      const cards = await db.query(
        `SELECT kc.*, kco.name AS column_name, kco.color AS column_color,
         cont.name AS contact_name, cont.phone_number AS contact_phone, cont.email AS contact_email
         FROM kanban_cards kc
         JOIN kanban_columns kco ON kco.id = kc.kanban_column_id
         LEFT JOIN contacts cont ON cont.id = kc.contact_id
         WHERE ${where} ORDER BY kc.kanban_column_id, kc.position, kc.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      const total = await db.query(
        `SELECT COUNT(*) FROM kanban_cards kc
         JOIN kanban_columns kco ON kco.id = kc.kanban_column_id WHERE ${where}`, params
      );
      return send(res, 200, { cards: cards.rows, meta: { total: parseInt(total.rows[0].count), page, limit } });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  if (path === '/api/kanban/cards' && method === 'POST') {
    const db = getClient();
    try {
      await db.connect();
      const body = await parseBody(req);
      const { title, description, contact_id, conversation_id, assignee_id,
              priority = 'none', value, currency = 'BRL', due_date,
              custom_fields = {}, metadata = {}, kanban_column_id, account_id = 1 } = body;
      if (!kanban_column_id) return send(res, 422, { error: 'kanban_column_id obrigatorio' });
      const posR = await db.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM kanban_cards WHERE kanban_column_id = $1`,
        [kanban_column_id]
      );
      const r = await db.query(
        `INSERT INTO kanban_cards
         (title, description, contact_id, conversation_id, assignee_id, priority, value, currency,
          position, due_date, custom_fields, metadata, account_id, kanban_column_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING *`,
        [title||null, description||null, contact_id||null, conversation_id||null, assignee_id||null,
         priority, value||null, currency, posR.rows[0].pos, due_date||null,
         JSON.stringify(custom_fields), JSON.stringify(metadata), account_id, kanban_column_id]
      );
      return send(res, 201, { card: r.rows[0] });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  const cardMatch = path.match(/^\/api\/kanban\/cards\/(\d+)$/);
  const moveMatch = path.match(/^\/api\/kanban\/cards\/(\d+)\/move$/);

  if (moveMatch && method === 'POST') {
    const db = getClient();
    try {
      await db.connect();
      const body = await parseBody(req);
      const { kanban_column_id, position, user_id, reason, account_id = 1 } = body;
      if (!kanban_column_id) return send(res, 422, { error: 'kanban_column_id obrigatorio' });
      const prev = await db.query(`SELECT kanban_column_id FROM kanban_cards WHERE id = $1`, [moveMatch[1]]);
      if (!prev.rows.length) return send(res, 404, { error: 'Card nao encontrado' });
      const fromCol = prev.rows[0].kanban_column_id;
      let newPos = position;
      if (newPos === undefined || newPos === null) {
        const posR = await db.query(
          `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM kanban_cards WHERE kanban_column_id = $1`,
          [kanban_column_id]
        );
        newPos = posR.rows[0].pos;
      }
      const r = await db.query(
        `UPDATE kanban_cards SET kanban_column_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [kanban_column_id, newPos, moveMatch[1]]
      );
      await db.query(
        `INSERT INTO kanban_card_movements
         (kanban_card_id, kanban_column_id, from_column_id, user_id, reason, account_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [moveMatch[1], kanban_column_id, fromCol, user_id||null, reason||null, account_id]
      );
      return send(res, 200, { card: r.rows[0] });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  if (cardMatch && method === 'PATCH') {
    const db = getClient();
    try {
      await db.connect();
      const body = await parseBody(req);
      const allowed = ['title','description','priority','value','due_date','assignee_id','custom_fields','metadata'];
      const sets = [], vals = []; let i = 1;
      for (const key of allowed) {
        if (body[key] !== undefined) {
          sets.push(`${key} = $${i}`);
          vals.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
          i++;
        }
      }
      if (!sets.length) return send(res, 422, { error: 'Nenhum campo' });
      sets.push('updated_at = NOW()'); vals.push(cardMatch[1]);
      const r = await db.query(
        `UPDATE kanban_cards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals
      );
      if (!r.rows.length) return send(res, 404, { error: 'Card nao encontrado' });
      return send(res, 200, { card: r.rows[0] });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  if (cardMatch && method === 'DELETE') {
    const db = getClient();
    try {
      await db.connect();
      const r = await db.query(`DELETE FROM kanban_cards WHERE id = $1 RETURNING id`, [cardMatch[1]]);
      if (!r.rows.length) return send(res, 404, { error: 'Card nao encontrado' });
      return send(res, 200, { deleted: true, id: r.rows[0].id });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  if (path === '/api/kanban/columns' && method === 'POST') {
    const db = getClient();
    try {
      await db.connect();
      const body = await parseBody(req);
      const { name, color = '#6366F1', kanban_pipeline_id, is_terminal = false, terminal_type } = body;
      if (!name || !kanban_pipeline_id) return send(res, 422, { error: 'name e kanban_pipeline_id obrigatorios' });
      const posR = await db.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM kanban_columns WHERE kanban_pipeline_id = $1`,
        [kanban_pipeline_id]
      );
      const r = await db.query(
        `INSERT INTO kanban_columns (name, color, position, is_terminal, terminal_type, kanban_pipeline_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
        [name, color, posR.rows[0].pos, is_terminal, terminal_type||null, kanban_pipeline_id]
      );
      return send(res, 201, { column: r.rows[0] });
    } catch(e) { return send(res, 500, { error: e.message }); }
    finally { await db.end(); }
  }

  return send(res, 404, { error: `Rota nao encontrada: ${method} ${path}` });
}

const server = http.createServer(async (req, res) => {
  try { await route(req, res); }
  catch(e) { send(res, 500, { error: 'Erro interno' }); }
});

server.listen(PORT, () => console.log(`Kanban API porta ${PORT}`));
