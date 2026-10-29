import './env.js';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { startSmsc, submitSm } from './smpp.js';
import { scrub } from './scrub.js';
import * as queue from './queue.js';

const store = process.env.MYSQL_HOST ? await import('./mysql-store.js') : await import('./store.js');

const PORT = Number(process.env.PORT || 8050);
const SMPP_PORT = Number(process.env.SMPP_PORT || 2775);
const SMPP_PASSWORD = process.env.SMPP_PASSWORD || 'umbral';
const TPS = Math.min(20, Math.max(1, Number(process.env.UMBRAL_TPS || 8)));
const TM_ID = '1201100000000001';

let ticking = false;

function clock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function whatsappPayload(job) {
  const to = `91${job.destination}`;
  if (job.text.includes('Reply YES')) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: job.text },
        action: {
          buttons: [{ type: 'reply', reply: { id: 'yes', title: 'YES' } }],
        },
      },
    };
  }
  if (job.templateName === 'Session') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: job.text },
    };
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: job.templateId, language: { code: 'en' } },
  };
}

function rcsPayload(job) {
  return {
    contentMessage: {
      text: job.text,
      suggestions: [{ reply: { text: 'YES', postbackData: 'yes' } }],
    },
    branding: { logo: 'mark.svg' },
  };
}

async function dispatch(job) {
  if (job.channel === 'sms') {
    const receipt = await submitSm(SMPP_PORT, SMPP_PASSWORD, {
      source: job.header,
      destination: job.destination,
      text: job.text,
      entityId: job.entityId,
      templateId: job.templateId,
      tmId: TM_ID,
    });
    await store.recordHook('smpp', receipt);
    return { state: receipt.stat === 'DELIVRD' ? 'delivered' : 'failed', note: receipt.note };
  }

  if (job.channel === 'whatsapp') {
    const payload = whatsappPayload(job);
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    let wamid = `wamid.${randomUUID()}`;
    let where = 'local graph';
    if (token && phoneId) {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        await store.recordHook('whatsapp', { payload, error: body });
        return { state: 'failed', note: 'WhatsApp Cloud rejected the message.' };
      }
      wamid = body.messages?.[0]?.id || wamid;
      where = 'Meta';
    }
    await store.recordHook('whatsapp', { where, wamid, payload });
    const kind = payload.type === 'interactive' ? 'button YES' : payload.type;
    return { state: 'delivered', note: `WhatsApp Cloud via ${where}. ${kind}. ${wamid}.` };
  }

  if (job.channel === 'voice') {
    const steps = ['dial', 'ring'];
    if (job.destination === '9847012203') {
      steps.push('no-answer');
      await store.recordHook('voice', { cli: job.cli, steps, text: job.text });
      return { state: 'failed', note: `IVR from ${job.cli}. No answer.` };
    }
    steps.push('answer', 'play', 'hangup');
    await store.recordHook('voice', { cli: job.cli, steps, text: job.text });
    return { state: 'delivered', note: `IVR from ${job.cli}. Answered, played the text, hung up.` };
  }

  const card = rcsPayload(job);
  await store.recordHook('rcs', card);
  return { state: 'delivered', note: 'RCS card with a YES reply and the Umbral mark.' };
}

async function pump() {
  if (ticking) {
    return;
  }
  ticking = true;
  for (;;) {
    const job = await queue.takeJob();
    if (!job) {
      break;
    }
    try {
      const result = await dispatch(job);
      const note = job.fallback ? `Fell back from RCS to SMS. ${result.note}` : result.note;
      await store.updateNotice(job.noticeId, result.state, note);
      queue.finish(job.noticeId, { ...result, note });
    } catch {
      await store.giveBack(job.accountId, job.cost);
      await store.updateNotice(job.noticeId, 'failed', 'The route did not accept the submit.');
      queue.finish(job.noticeId, { state: 'failed', note: 'The route did not accept the submit.' });
    }
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(1000 / TPS)));
  }
  ticking = false;
}

function enqueue(job) {
  const pending = queue.wait(job.noticeId);
  void queue.push(job).then(() => pump());
  return pending;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 256_000) {
        reject(new Error('The body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('The body is not JSON.'));
      }
    });
  });
}

function send(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const origin = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin || '')
    ? req.headers.origin
    : 'http://127.0.0.1:8040';
  if (req.method === 'OPTIONS') {
    send(res, 204, {}, origin);
    return;
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      send(res, 200, { store: store.backend, queue: queue.backend, depth: await queue.depth(), smpp: `127.0.0.1:${SMPP_PORT}`, tps: TPS }, origin);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      send(res, 200, await store.snapshot(), origin);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/session') {
      const body = await readBody(req);
      const found = await store.accountByEmail(String(body.email || '').trim().toLowerCase());
      if (!found || body.password !== 'umbral') {
        send(res, 401, { error: 'That email or password does not match.' }, origin);
        return;
      }
      send(res, 200, { token: await store.openSession(found.id), accountId: found.id }, origin);
      return;
    }

    const token = String(req.headers.authorization || '').replace('Bearer ', '');
    const actor = await store.accountForToken(token);
    if (!actor) {
      send(res, 401, { error: 'Sign in again.' }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const body = await readBody(req);
      const draft = {
        accountId: String(body.accountId || ''),
        channel: body.channel,
        header: String(body.header || ''),
        body: String(body.body || ''),
        destination: String(body.destination || ''),
        handset: Boolean(body.handset),
      };
      const target = await store.account(draft.accountId);
      if (!target) {
        send(res, 404, { error: 'That account is not on this desk.' }, origin);
        return;
      }
      const allowed =
        actor.role === 'admin'
          ? target.role === 'client'
          : actor.role === 'reseller'
            ? target.resellerId === actor.id
            : target.id === actor.id;
      if (!allowed) {
        send(res, 403, { error: 'This desk cannot send for that account.' }, origin);
        return;
      }
      const review = scrub({
        draft,
        account: target,
        templates: await store.templates(),
        notices: await store.noticesFor(target.id),
        balance: target.credits,
      });
      if (!review.clear) {
        const seal = review.steps.find((step) => step.seal);
        send(res, 422, { notice: null, error: seal?.text || 'Held.', state: await store.snapshot() }, origin);
        return;
      }
      const id = await store.nextNoticeId();
      const channel = review.fallback ? 'sms' : draft.channel;
      await store.take(target.id, review.cost);
      await store.insertNotice({
        id,
        accountId: target.id,
        at: clock(),
        channel,
        header: draft.header.trim().toUpperCase(),
        destination: draft.destination.replace(/\D/g, ''),
        state: 'pending',
        note: 'Queued.',
      });
      const result = await enqueue({
        noticeId: id,
        accountId: target.id,
        cost: review.cost,
        channel,
        header: draft.header.trim().toUpperCase(),
        destination: draft.destination.replace(/\D/g, ''),
        text: draft.body.trim(),
        entityId: target.entityId,
        templateId: review.templateId || review.templateName,
        templateName: review.templateName,
        cli: target.cli,
        fallback: review.fallback,
      });
      const after = await store.snapshot();
      const notice = after.notices.find((row) => row.id === id) || null;
      send(res, 200, { notice, error: '', route: result.note, state: after }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/wallet/sell') {
      if (actor.role === 'client') {
        send(res, 403, { error: 'A client does not sell credit.' }, origin);
        return;
      }
      const body = await readBody(req);
      const amount = Number(body.amount);
      if (amount !== 200) {
        send(res, 422, { error: 'This desk sells 200 credits at a time.' }, origin);
        return;
      }
      const error = await store.sell(String(body.clientId || ''), amount);
      send(res, error ? 422 : 200, { error, state: await store.snapshot() }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/notices/') && url.pathname.endsWith('/click')) {
      const id = url.pathname.split('/')[3];
      await store.click(id);
      send(res, 200, { state: await store.snapshot() }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/hooks/dlr') {
      const body = await readBody(req);
      const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [body];
      let applied = 0;
      for (const event of events) {
        await store.recordHook('dlr', event);
        if (await store.applyDlr(event)) {
          applied += 1;
        }
      }
      send(res, 200, { accepted: events.length, applied, state: await store.snapshot() }, origin);
      return;
    }

    send(res, 404, { error: 'No such route.' }, origin);
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : 'The request failed.' }, origin);
  }
});

if (store.ready) {
  await store.ready;
}
await queue.connectQueue();
await startSmsc(SMPP_PORT, SMPP_PASSWORD);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Umbral gateway on http://127.0.0.1:${PORT} · SMSC 127.0.0.1:${SMPP_PORT} · ${TPS}/s`);
});
