# Umbral

Desk for a registered Indian telemarketer. Sagar Telemedia, in Mumbai, sells through Deccan Relay in Pune to Asha Clinic and Vega Motors. A message is held until the header, the DLT template and the wallet all clear. SMS, WhatsApp, voice and RCS share that filter. RCS with no capable handset falls back to SMS. A short link can take a click. Selling more credit writes an invoice.

The gateway listens on port 8050 and binds SMPP v3.4 to an SMSC on this machine. WhatsApp Cloud, a voice carrier, and RCS leave the machine only when that carrier’s token is set. With `MYSQL_HOST` and `REDIS_URL` the ledger is MySQL and the queue is Redis; otherwise it falls back to SQLite and an in-process queue. `docker compose up -d mysql redis` starts those two. The worker is capped at 20 messages a second. A delivery hook accepts up to 500 events per call.

## Accounts

The password for each is `umbral`.

| Email | Desk |
| --- | --- |
| ananya@asha.demo | Asha Clinic, Pune |
| arjun@deccan.demo | Deccan Relay |
| meera@sagar.demo | Sagar Telemedia |

## Run

```bash
npm install
npm install --prefix server
node server/src/index.js
npm start
```

The desk listens on http://127.0.0.1:8040. The gateway listens on http://127.0.0.1:8050.
