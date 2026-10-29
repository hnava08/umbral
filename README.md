# Build White-Label CPaaS Platform

White-label CPaaS application for a registered telemarketer. One multi-tenant desk lets the admin, resellers, and end users run SMS, WhatsApp, voice, and RCS. Traffic is scrubbed against Indian TRAI / DLT rules before it is queued.

## Channels

Bulk SMS goes out over SMPP v3.4. The submit carries the DLT tags for the principal entity and the template.

WhatsApp uses the Cloud API: approved templates, session replies, and an interactive confirmation button.

Voice places an outbound call from the account’s calling line and plays the approved text.

RCS sends a rich card with a reply action and the brand mark. If the handset cannot take RCS, the message falls back to SMS.

## Administration

Separate logins for admin, reseller, and end user. A reseller can sell more prepaid credit than it bought. The wallet tracks each sub-account, flags a balance under its line, and writes an invoice for the sale.

## Compliance

The scrub runs before submit. It checks the principal entity, the header, and the approved template. A destination that is not a valid Indian mobile is held.

## Reporting

Notices are delivered, failed, or pending. The report shows those rates and counts clicks on short links. Delivery receipts come back on the webhook and update the notice.

## Stack

Angular for the desk. Node.js for the gateway. MySQL for the ledger. Redis for the send queue. Docker Compose for MySQL and Redis.

## Run

Node 22 and Docker.

```bash
npm install
npm install --prefix server
docker compose up -d mysql redis
cp server/.env.example server/.env
node server/src/index.js
npm start
```

Gateway settings are in `server/.env`. See `server/.env.example`.

`src/app` is the desk: sign-in, compose, templates, wallet, and report. `server/src` is the gateway: the DLT scrub, the SMPP bind, channel submit, and the ledger.
