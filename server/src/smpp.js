import net from 'node:net';

const BIND = 0x00000009;
const BIND_RESP = 0x80000009;
const SUBMIT = 0x00000004;
const SUBMIT_RESP = 0x80000004;
const DELIVER = 0x00000005;
const DELIVER_RESP = 0x80000005;
const UNBIND = 0x00000006;
const UNBIND_RESP = 0x80000006;

const PE_ID = 0x1400;
const TEMPLATE_ID = 0x1401;
const TM_ID = 0x1402;

function cstring(value) {
  return Buffer.from(`${value}\0`, 'ascii');
}

function frame(command, status, sequence, body) {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(16 + body.length, 0);
  header.writeUInt32BE(command, 4);
  header.writeUInt32BE(status, 8);
  header.writeUInt32BE(sequence, 12);
  return Buffer.concat([header, body]);
}

function readCString(buffer, offset) {
  const end = buffer.indexOf(0, offset);
  if (end < 0) {
    throw new Error('SMPP string was not closed.');
  }
  return { value: buffer.toString('ascii', offset, end), offset: end + 1 };
}

function parseSubmit(body) {
  let offset = 0;
  const take = () => {
    const read = readCString(body, offset);
    offset = read.offset;
    return read.value;
  };
  take();
  offset += 2;
  const source = take();
  offset += 2;
  const destination = take();
  offset += 3;
  take();
  take();
  offset += 4;
  const length = body[offset];
  offset += 1;
  const text = body.toString('utf8', offset, offset + length);
  offset += length;
  const tlvs = {};
  while (offset + 4 <= body.length) {
    const tag = body.readUInt16BE(offset);
    offset += 2;
    const size = body.readUInt16BE(offset);
    offset += 2;
    tlvs[tag] = body.toString('ascii', offset, offset + size);
    offset += size;
  }
  return { source, destination, text, tlvs };
}

function tlv(tag, value) {
  const bytes = Buffer.from(String(value), 'ascii');
  const head = Buffer.alloc(4);
  head.writeUInt16BE(tag, 0);
  head.writeUInt16BE(bytes.length, 2);
  return Buffer.concat([head, bytes]);
}

function submitBody(job) {
  const text = Buffer.from(job.text, 'utf8');
  if (text.length > 254) {
    throw new Error('The SMS body does not fit in one SMPP short_message.');
  }
  return Buffer.concat([
    cstring(''),
    Buffer.from([0x05, 0x00]),
    cstring(job.source),
    Buffer.from([0x01, 0x01]),
    cstring(job.destination),
    Buffer.from([0x00, 0x00, 0x00]),
    cstring(''),
    cstring(''),
    Buffer.from([0x01, 0x00, 0x00, 0x00, text.length]),
    text,
    tlv(PE_ID, job.entityId),
    tlv(TEMPLATE_ID, job.templateId),
    tlv(TM_ID, job.tmId),
  ]);
}

function bindBody(systemId, password) {
  return Buffer.concat([
    cstring(systemId),
    cstring(password),
    cstring(''),
    Buffer.from([0x34, 0x00, 0x00]),
    cstring(''),
  ]);
}

function listen(socket, onPdu) {
  let pending = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 16) {
      const length = pending.readUInt32BE(0);
      if (length < 16 || length > 8192) {
        socket.destroy();
        return;
      }
      if (pending.length < length) {
        return;
      }
      const pdu = pending.subarray(0, length);
      pending = pending.subarray(length);
      onPdu({
        command: pdu.readUInt32BE(4),
        status: pdu.readUInt32BE(8),
        sequence: pdu.readUInt32BE(12),
        body: pdu.subarray(16),
      });
    }
  });
}

export function startSmsc(port, password) {
  const server = net.createServer((socket) => {
    let bound = false;
    listen(socket, (pdu) => {
      if (pdu.command === BIND) {
        const systemId = readCString(pdu.body, 0).value;
        const pass = readCString(pdu.body, systemId.length + 1).value;
        const ok = systemId === 'umbral' && pass === password;
        bound = ok;
        socket.write(frame(BIND_RESP, ok ? 0 : 0x0000000d, pdu.sequence, cstring(ok ? 'umbral' : '')));
        return;
      }
      if (!bound) {
        socket.destroy();
        return;
      }
      if (pdu.command === SUBMIT) {
        const parsed = parseSubmit(pdu.body);
        const id = `sm${pdu.sequence}`;
        socket.write(frame(SUBMIT_RESP, 0, pdu.sequence, cstring(id)));
        const receipt =
          `id:${id} sub:001 dlvrd:001 submit date:2610281152 done date:2610281152 stat:DELIVRD err:000 text:${parsed.text.slice(0, 20)}`;
        const receiptBytes = Buffer.from(receipt, 'ascii');
        const deliver = Buffer.concat([
          cstring(''),
          Buffer.from([0x01, 0x01]),
          cstring(parsed.destination),
          Buffer.from([0x05, 0x00]),
          cstring(parsed.source),
          Buffer.from([0x04, 0x00, 0x00]),
          cstring(''),
          cstring(''),
          Buffer.from([0x00, 0x00, 0x00, 0x00, receiptBytes.length]),
          receiptBytes,
        ]);
        socket.write(frame(DELIVER, 0, pdu.sequence + 1, deliver));
        return;
      }
      if (pdu.command === DELIVER_RESP) {
        return;
      }
      if (pdu.command === UNBIND) {
        socket.write(frame(UNBIND_RESP, 0, pdu.sequence, Buffer.alloc(0)));
        socket.end();
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export function submitSm(port, password, job) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let sequence = 1;
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once('error', fail);
    listen(socket, (pdu) => {
      if (pdu.command === BIND_RESP) {
        if (pdu.status !== 0) {
          fail(new Error('The SMSC refused the bind.'));
          return;
        }
        socket.write(frame(SUBMIT, 0, sequence, submitBody(job)));
        return;
      }
      if (pdu.command === SUBMIT_RESP) {
        if (pdu.status !== 0) {
          fail(new Error('submit_sm was rejected.'));
        }
        return;
      }
      if (pdu.command === DELIVER) {
        const receipt = pdu.body.toString('ascii');
        const stat = receipt.match(/stat:([A-Z]+)/)?.[1] ?? 'UNKNOWN';
        const id = receipt.match(/id:(\S+)/)?.[1] ?? '';
        socket.write(frame(DELIVER_RESP, 0, pdu.sequence, cstring(id)));
        socket.write(frame(UNBIND, 0, sequence + 1, Buffer.alloc(0)));
        socket.end();
        const tags = [PE_ID, TEMPLATE_ID, TM_ID].map((tag) => `0x${tag.toString(16)}`).join(' ');
        resolve({
          id,
          stat,
          note: `SMPP submit_sm ${id} ${stat}. TLV ${tags}. PE ${job.entityId}. Template ${job.templateId}.`,
        });
      }
    });
    socket.on('connect', () => {
      socket.write(frame(BIND, 0, sequence, bindBody('umbral', password)));
      sequence += 1;
    });
  });
}
