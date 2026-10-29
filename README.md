# Build White-Label CPaaS Platform

Umbral is a white-label CPaaS desk for a registered Indian telemarketer. Sagar Telemedia, in Mumbai, sells through Deccan Relay in Pune. Deccan serves Asha Clinic and Vega Motors. Admin, reseller, and client each sign in to the same console and work only the accounts on their chain.

Messages are scrubbed against the TRAI / DLT register before they are queued. The check covers the principal entity, the header, and the approved template. A number that is not a 10-digit Indian mobile is held. The prepaid wallet is debited only after the message clears.

## Channels

SMS goes out over SMPP v3.4. The submit carries the Indian DLT tags for the principal entity, the template, and the telemarketer in the chain.

WhatsApp uses the Cloud API. Approved templates go out as templates. A number that already has a delivered WhatsApp can take a session reply. Copy that asks for a confirmation is sent as an interactive button.

Voice places the call from the account’s calling line, plays the approved text, and hangs up.

RCS sends a card with a reply action and the brand mark. A handset that cannot take RCS falls back to SMS.

## Administration

The admin sees the client accounts. The reseller sells prepaid credit to those clients and can load more than it bought from the admin; the wallet keeps that virtual extra on its own line and writes an invoice for the sale. A client sees its own balance, templates, and notices. A balance under the account’s line is flagged.

## Reporting

Notices land as delivered, failed, or pending. The report totals those states, shows delivered traffic by hour, and counts clicks on short links. Delivery receipts come back on the webhook and update the notice.

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

Gateway settings live in `server/.env`. See `server/.env.example`.

`src/app` is the desk: sign-in, compose, templates, wallet, and report. `server/src` is the gateway: the DLT scrub, the SMPP bind, channel submit, and the ledger.
