import { createClient } from 'redis';

const memory = [];
const waiters = new Map();
let redis;

export const backend = process.env.REDIS_URL ? 'redis' : 'memory';

export async function connectQueue() {
  if (!process.env.REDIS_URL) {
    return;
  }
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', (error) => {
    console.error(error.message);
  });
  await redis.connect();
}

export async function push(job) {
  const payload = JSON.stringify(job);
  if (redis) {
    await redis.lPush('umbral:jobs', payload);
    return;
  }
  memory.push(job);
}

export async function takeJob() {
  if (redis) {
    const raw = await redis.rPop('umbral:jobs');
    return raw ? JSON.parse(raw) : null;
  }
  return memory.shift() || null;
}

export function wait(id) {
  return new Promise((resolve) => {
    waiters.set(id, resolve);
  });
}

export function finish(id, result) {
  const done = waiters.get(id);
  waiters.delete(id);
  if (done) {
    done(result);
  }
}

export async function depth() {
  if (redis) {
    return redis.lLen('umbral:jobs');
  }
  return memory.length;
}
