import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const backend = 'sqlite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(root, { recursive: true });

const db = new DatabaseSync(join(root, 'umbral.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    headers TEXT NOT NULL,
    credits INTEGER NOT NULL,
    loaded INTEGER NOT NULL,
    low_at INTEGER NOT NULL,
    reseller_id TEXT,
    cli TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    header TEXT NOT NULL,
    body TEXT NOT NULL,
    dlt_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    at TEXT NOT NULL,
    channel TEXT NOT NULL,
    header TEXT NOT NULL,
    destination TEXT NOT NULL,
    state TEXT NOT NULL,
    clicks INTEGER NOT NULL,
    note TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    on_date TEXT NOT NULL,
    credits INTEGER NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);

function accountRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    city: row.city,
    entityId: row.entity_id,
    headers: row.headers.split(','),
    credits: row.credits,
    loaded: row.loaded,
    lowAt: row.low_at,
    resellerId: row.reseller_id || undefined,
    cli: row.cli,
  };
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  if (count > 0) {
    return;
  }
  const insertAccount = db.prepare(
    `INSERT INTO accounts (id, email, password, role, name, city, entity_id, headers, credits, loaded, low_at, reseller_id, cli)
     VALUES (?, ?, 'umbral', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const accounts = [
    ['sagar', 'meera@sagar.demo', 'admin', 'Sagar Telemedia', 'Mumbai', '1201100000000001', 'SAGART', 50000, 50000, 1000, null, '+91 22 4890 1100'],
    ['deccan', 'arjun@deccan.demo', 'reseller', 'Deccan Relay', 'Pune', '1201100000000002', 'DECCAN', 6000, 6000, 500, null, '+91 20 6761 1000'],
    ['asha', 'ananya@asha.demo', 'client', 'Asha Clinic', 'Pune', '1201159876543210', 'ASHA01', 1840, 5000, 500, 'deccan', '+91 20 6761 1400'],
    ['vega', 'karthik@vega.demo', 'client', 'Vega Motors', 'Kochi', '1201161234567890', 'VEGA01', 420, 2000, 500, 'deccan', '+91 484 401 2200'],
  ];
  for (const row of accounts) {
    insertAccount.run(...row);
  }
  const insertTemplate = db.prepare(
    `INSERT INTO templates (id, account_id, name, channel, header, body, dlt_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const templates = [
    ['T-14', 'asha', 'Appointment', 'sms', 'ASHA01', 'Your appointment at {#var#} is on {#var#}. Reply YES to confirm.', '1401159876000014'],
    ['T-15', 'asha', 'Report ready', 'whatsapp', 'ASHA01', 'Hello {#var#}, your report is ready at {#var#}.', '1401159876000015'],
    ['T-18', 'asha', 'Visit confirmed', 'rcs', 'ASHA01', 'Asha Clinic. {#var#}, your visit on {#var#} is confirmed.', '1401159876000018'],
    ['T-21', 'vega', 'Collection', 'sms', 'VEGA01', 'Your job {#var#} can be collected on {#var#}.', '1401161234000021'],
    ['T-22', 'vega', 'Vehicle ready', 'voice', 'VEGA01', 'Vega Motors. Your vehicle {#var#} is ready on {#var#}.', '1401161234000022'],
  ];
  for (const row of templates) {
    insertTemplate.run(...row);
  }
  const insertNotice = db.prepare(
    `INSERT INTO notices (id, account_id, at, channel, header, destination, state, clicks, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
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
    insertNotice.run(...row);
  }
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)`,
  );
  insertInvoice.run('INV-19', 'deccan', '2 Oct 2026', 6000, 'Sagar Telemedia');
  insertInvoice.run('INV-21', 'asha', '4 Oct 2026', 5000, 'Deccan Relay');
  insertInvoice.run('INV-22', 'vega', '6 Oct 2026', 2000, 'Deccan Relay');
  db.prepare('INSERT INTO counters (name, value) VALUES (?, ?)').run('notice', 110);
  db.prepare('INSERT INTO counters (name, value) VALUES (?, ?)').run('invoice', 23);
}

seed();

function notice(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    at: row.at,
    channel: row.channel,
    header: row.header,
    destination: row.destination,
    state: row.state,
    clicks: row.clicks,
    note: row.note,
  };
}

export function snapshot() {
  const accounts = db.prepare('SELECT * FROM accounts').all();
  return {
    balances: Object.fromEntries(accounts.map((row) => [row.id, row.credits])),
    loaded: Object.fromEntries(accounts.map((row) => [row.id, row.loaded])),
    notices: db.prepare('SELECT * FROM notices ORDER BY at, id').all().map(notice),
    invoices: db.prepare('SELECT * FROM invoices').all().map((row) => ({
      id: row.id,
      accountId: row.account_id,
      on: row.on_date,
      credits: row.credits,
      from: row.source,
    })),
    seq: db.prepare(`SELECT value FROM counters WHERE name = 'notice'`).get().value,
    invoiceSeq: db.prepare(`SELECT value FROM counters WHERE name = 'invoice'`).get().value,
  };
}

export function account(id) {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return row ? accountRow(row) : null;
}

export function accountByEmail(email) {
  const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!row || row.password !== 'umbral') {
    return null;
  }
  return accountRow(row);
}

export function openSession(accountId) {
  const token = randomUUID();
  db.prepare('INSERT INTO sessions (token, account_id) VALUES (?, ?)').run(token, accountId);
  return token;
}

export function accountForToken(token) {
  const row = db.prepare('SELECT account_id FROM sessions WHERE token = ?').get(token);
  return row ? account(row.account_id) : null;
}

export function templates() {
  return db.prepare('SELECT * FROM templates').all().map((row) => ({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    channel: row.channel,
    header: row.header,
    body: row.body,
    dltId: row.dlt_id,
  }));
}

export function noticesFor(accountId) {
  return db.prepare('SELECT * FROM notices WHERE account_id = ?').all(accountId).map(notice);
}

export function take(accountId, cost) {
  db.prepare('UPDATE accounts SET credits = credits - ? WHERE id = ? AND credits >= ?').run(cost, accountId, cost);
}

export function giveBack(accountId, cost) {
  db.prepare('UPDATE accounts SET credits = credits + ? WHERE id = ?').run(cost, accountId);
}

export function nextNoticeId() {
  const row = db.prepare(`SELECT value FROM counters WHERE name = 'notice'`).get();
  db.prepare(`UPDATE counters SET value = ? WHERE name = 'notice'`).run(row.value + 1);
  return `N-${row.value}`;
}

export function insertNotice(row) {
  db.prepare(
    `INSERT INTO notices (id, account_id, at, channel, header, destination, state, clicks, note) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(row.id, row.accountId, row.at, row.channel, row.header, row.destination, row.state, row.note);
}

export function updateNotice(id, state, note) {
  db.prepare('UPDATE notices SET state = ?, note = ? WHERE id = ?').run(state, note, id);
}

export function sell(clientId, amount) {
  const client = account(clientId);
  if (!client || client.role !== 'client') {
    return 'That client is not on this chain.';
  }
  const seq = db.prepare(`SELECT value FROM counters WHERE name = 'invoice'`).get().value;
  db.prepare(`UPDATE counters SET value = ? WHERE name = 'invoice'`).run(seq + 1);
  db.prepare('UPDATE accounts SET credits = credits + ?, loaded = loaded + ? WHERE id = ?').run(amount, amount, clientId);
  db.prepare('INSERT INTO invoices (id, account_id, on_date, credits, source) VALUES (?, ?, ?, ?, ?)').run(
    `INV-${seq}`,
    clientId,
    '28 Oct 2026',
    amount,
    'Deccan Relay',
  );
  return null;
}

export function click(id) {
  db.prepare(`UPDATE notices SET clicks = clicks + 1 WHERE id = ? AND note LIKE '%umbral.in%'`).run(id);
}

export function recordHook(kind, payload) {
  db.prepare('INSERT INTO hooks (kind, payload) VALUES (?, ?)').run(kind, JSON.stringify(payload));
}

export function applyDlr(event) {
  const row = db.prepare('SELECT id, state, note FROM notices WHERE id = ?').get(event.noticeId);
  if (!row) {
    return false;
  }
  const state = event.state === 'failed' || event.state === 'pending' || event.state === 'delivered' ? event.state : row.state;
  const note = event.note ? String(event.note).slice(0, 240) : row.note;
  db.prepare('UPDATE notices SET state = ?, note = ? WHERE id = ?').run(state, note, row.id);
  return true;
}
