import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

export const backend = 'mysql';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'umbral',
  password: process.env.MYSQL_PASSWORD || 'umbral',
  database: process.env.MYSQL_DATABASE || 'umbral',
  waitForConnections: true,
  connectionLimit: 8,
});

function accountRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    city: row.city,
    entityId: row.entity_id,
    headers: String(row.headers).split(','),
    credits: Number(row.credits),
    loaded: Number(row.loaded),
    lowAt: Number(row.low_at),
    resellerId: row.reseller_id || undefined,
    cli: row.cli,
  };
}

function notice(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    at: row.at,
    channel: row.channel,
    header: row.header,
    destination: row.destination,
    state: row.state,
    clicks: Number(row.clicks),
    note: row.note,
  };
}

async function seed() {
  const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM accounts');
  if (Number(countRows[0].n) > 0) {
    return;
  }
  const accounts = [
    ['sagar', 'meera@sagar.demo', 'admin', 'Sagar Telemedia', 'Mumbai', '1201100000000001', 'SAGART', 50000, 50000, 1000, null, '+91 22 4890 1100'],
    ['deccan', 'arjun@deccan.demo', 'reseller', 'Deccan Relay', 'Pune', '1201100000000002', 'DECCAN', 6000, 6000, 500, null, '+91 20 6761 1000'],
    ['asha', 'ananya@asha.demo', 'client', 'Asha Clinic', 'Pune', '1201159876543210', 'ASHA01', 1840, 5000, 500, 'deccan', '+91 20 6761 1400'],
    ['vega', 'karthik@vega.demo', 'client', 'Vega Motors', 'Kochi', '1201161234567890', 'VEGA01', 420, 2000, 500, 'deccan', '+91 484 401 2200'],
  ];
  for (const row of accounts) {
    await pool.query(
      `INSERT INTO accounts (id, email, password, role, name, city, entity_id, headers, credits, loaded, low_at, reseller_id, cli)
       VALUES (?, ?, 'umbral', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row,
    );
  }
  const templates = [
    ['T-14', 'asha', 'Appointment', 'sms', 'ASHA01', 'Your appointment at {#var#} is on {#var#}. Reply YES to confirm.', '1401159876000014'],
    ['T-15', 'asha', 'Report ready', 'whatsapp', 'ASHA01', 'Hello {#var#}, your report is ready at {#var#}.', '1401159876000015'],
    ['T-18', 'asha', 'Visit confirmed', 'rcs', 'ASHA01', 'Asha Clinic. {#var#}, your visit on {#var#} is confirmed.', '1401159876000018'],
    ['T-21', 'vega', 'Collection', 'sms', 'VEGA01', 'Your job {#var#} can be collected on {#var#}.', '1401161234000021'],
    ['T-22', 'vega', 'Vehicle ready', 'voice', 'VEGA01', 'Vega Motors. Your vehicle {#var#} is ready on {#var#}.', '1401161234000022'],
  ];
  for (const row of templates) {
    await pool.query(
      'INSERT INTO templates (id, account_id, name, channel, header, body, dlt_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      row,
    );
  }
  const notices = [
    ['N-101', 'asha', '08:14', 'sms', 'ASHA01', '9812345521', 'delivered', 0, ''],
    ['N-102', 'asha', '08:41', 'sms', 'ASHA01', '9844012244', 'delivered', 2, 'umbral.in/a41'],
    ['N-103', 'asha', '08:55', 'whatsapp', 'ASHA01', '9812345521', 'delivered', 0, 'Session opened'],
    ['N-104', 'asha', '09:02', 'sms', 'PROMO', '9812345521', 'failed', 0, 'Header not approved'],
    ['N-105', 'vega', '09:18', 'sms', 'VEGA01', '9895012290', 'delivered', 0, ''],
    ['N-106', 'asha', '10:05', 'whatsapp', 'ASHA01', '9822011217', 'pending', 0, 'Waiting on the handset'],
    ['N-107', 'asha', '10:22', 'sms', 'ASHA01', '9812345521', 'delivered', 0, ''],
    ['N-108', 'vega', '11:10', 'voice', 'VEGA01', '9847012203', 'failed', 0, 'No answer'],
    ['N-109', 'asha', '11:40', 'rcs', 'ASHA01', '9844012244', 'delivered', 1, 'umbral.in/r40'],
  ];
  for (const row of notices) {
    await pool.query(
      'INSERT INTO notices (id, account_id, at, channel, header, destination, state, clicks, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      row,
    );
  }
  await pool.query('INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)', ['INV-19', 'deccan', '2 Oct 2026', 6000, 'Sagar Telemedia']);
  await pool.query('INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)', ['INV-21', 'asha', '4 Oct 2026', 5000, 'Deccan Relay']);
  await pool.query('INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)', ['INV-22', 'vega', '6 Oct 2026', 2000, 'Deccan Relay']);
  await pool.query('INSERT INTO counters (name, value) VALUES (?, ?)', ['notice', 110]);
  await pool.query('INSERT INTO counters (name, value) VALUES (?, ?)', ['invoice', 23]);
}

export const ready = seed();

export async function snapshot() {
  const [accounts] = await pool.query('SELECT * FROM accounts');
  const [notices] = await pool.query('SELECT * FROM notices ORDER BY at, id');
  const [invoices] = await pool.query('SELECT * FROM invoices');
  const [seq] = await pool.query(`SELECT value FROM counters WHERE name = 'notice'`);
  const [invoiceSeq] = await pool.query(`SELECT value FROM counters WHERE name = 'invoice'`);
  return {
    balances: Object.fromEntries(accounts.map((row) => [row.id, Number(row.credits)])),
    loaded: Object.fromEntries(accounts.map((row) => [row.id, Number(row.loaded)])),
    notices: notices.map(notice),
    invoices: invoices.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      on: row.on_date,
      credits: Number(row.credits),
      from: row.source,
    })),
    seq: Number(seq[0].value),
    invoiceSeq: Number(invoiceSeq[0].value),
  };
}

export async function account(id) {
  const [rows] = await pool.query('SELECT * FROM accounts WHERE id = ?', [id]);
  return rows[0] ? accountRow(rows[0]) : null;
}

export async function accountByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM accounts WHERE email = ?', [email]);
  if (!rows[0] || rows[0].password !== 'umbral') {
    return null;
  }
  return accountRow(rows[0]);
}

export async function openSession(accountId) {
  const token = randomUUID();
  await pool.query('INSERT INTO sessions (token, account_id) VALUES (?, ?)', [token, accountId]);
  return token;
}

export async function accountForToken(token) {
  const [rows] = await pool.query('SELECT account_id FROM sessions WHERE token = ?', [token]);
  return rows[0] ? account(rows[0].account_id) : null;
}

export async function templates() {
  const [rows] = await pool.query('SELECT * FROM templates');
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    channel: row.channel,
    header: row.header,
    body: row.body,
    dltId: row.dlt_id,
  }));
}

export async function noticesFor(accountId) {
  const [rows] = await pool.query('SELECT * FROM notices WHERE account_id = ?', [accountId]);
  return rows.map(notice);
}

export async function take(accountId, cost) {
  await pool.query('UPDATE accounts SET credits = credits - ? WHERE id = ? AND credits >= ?', [cost, accountId, cost]);
}

export async function giveBack(accountId, cost) {
  await pool.query('UPDATE accounts SET credits = credits + ? WHERE id = ?', [cost, accountId]);
}

export async function nextNoticeId() {
  const [rows] = await pool.query(`SELECT value FROM counters WHERE name = 'notice'`);
  const value = Number(rows[0].value);
  await pool.query(`UPDATE counters SET value = ? WHERE name = 'notice'`, [value + 1]);
  return `N-${value}`;
}

export async function insertNotice(row) {
  await pool.query(
    'INSERT INTO notices (id, account_id, at, channel, header, destination, state, clicks, note) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [row.id, row.accountId, row.at, row.channel, row.header, row.destination, row.state, row.note],
  );
}

export async function updateNotice(id, state, note) {
  await pool.query('UPDATE notices SET state = ?, note = ? WHERE id = ?', [state, note, id]);
}

export async function sell(clientId, amount) {
  const client = await account(clientId);
  if (!client || client.role !== 'client') {
    return 'That client is not on this chain.';
  }
  const [rows] = await pool.query(`SELECT value FROM counters WHERE name = 'invoice'`);
  const seq = Number(rows[0].value);
  await pool.query(`UPDATE counters SET value = ? WHERE name = 'invoice'`, [seq + 1]);
  await pool.query('UPDATE accounts SET credits = credits + ?, loaded = loaded + ? WHERE id = ?', [amount, amount, clientId]);
  await pool.query(
    'INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)',
    [`INV-${seq}`, clientId, '28 Oct 2026', amount, 'Deccan Relay'],
  );
  return null;
}

export async function click(id) {
  await pool.query(`UPDATE notices SET clicks = clicks + 1 WHERE id = ? AND note LIKE '%umbral.in%'`, [id]);
}

export async function recordHook(kind, payload) {
  await pool.query('INSERT INTO hooks (kind, payload) VALUES (?, ?)', [kind, JSON.stringify(payload)]);
}

export async function applyDlr(event) {
  const [rows] = await pool.query('SELECT id, state, note FROM notices WHERE id = ?', [event.noticeId]);
  if (!rows[0]) {
    return false;
  }
  const state = event.state === 'failed' || event.state === 'pending' || event.state === 'delivered' ? event.state : rows[0].state;
  const note = event.note ? String(event.note).slice(0, 240) : rows[0].note;
  await pool.query('UPDATE notices SET state = ?, note = ? WHERE id = ?', [state, note, rows[0].id]);
  return true;
}
