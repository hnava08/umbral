# Umbral

Umbral is the operations desk for Sagar Telemedia, a registered telemarketer in Mumbai. Deccan Relay, in Pune, resells prepaid credit to Asha Clinic and Vega Motors. Staff sign in, check a message against the DLT register, and queue it on SMS, WhatsApp, voice, or RCS.

## Desks

| Desk | Email | Scope |
| --- | --- | --- |
| Sagar Telemedia | meera@sagar.demo | Admin. Sees both clients. |
| Deccan Relay | arjun@deccan.demo | Reseller. Sells credit to the clinic and the workshop. |
| Asha Clinic | ananya@asha.demo | Client. Sends only for itself. |
| Vega Motors | karthik@vega.demo | Client. Kochi workshop on the Deccan chain. |

The password for every desk is `umbral`.

## Work on the desk

Sagar sees the clients. Deccan sells them credit and can load more than it bought; the wallet shows that extra on its own line. A client sees its balance, its templates, and its notices.

A message stays held until four checks pass: the header is on the account, the words match an approved template, the mobile is a 10-digit Indian number, and the wallet can cover the rate. An open WhatsApp session can reply without a new template. RCS to a handset that cannot take it leaves as SMS.

Rates, in credits: SMS 1, WhatsApp template 2, WhatsApp session reply 1, voice 3, RCS 2.

The report lists delivered, failed, and pending notices, draws the morning by hour, and counts clicks on short links.

## Gateway

`server/` accepts the queue, binds SMPP v3.4, submits the WhatsApp Cloud API payload, runs the voice script, and builds the RCS card. Delivery receipts return on `POST /api/hooks/dlr` and update the notice.

MySQL keeps the ledger. Redis keeps the send queue. Copy `server/.env.example` to `server/.env` before starting.

| Variable | Use |
| --- | --- |
| `PORT` | Gateway port. Default 8050. |
| `SMPP_PORT` | SMSC port. Default 2775. |
| `SMPP_PASSWORD` | Password the gateway uses to bind. |
| `MYSQL_HOST` | MySQL host. |
| `REDIS_URL` | Redis URL. |
| `UMBRAL_TPS` | Sends per second. Default 8. |
| `WHATSAPP_TOKEN` | Meta Cloud API token. |
| `WHATSAPP_PHONE_ID` | Meta phone number id. |

With `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` set, WhatsApp is submitted to Meta. With them empty, the gateway stores the same payload and receipt locally.

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

The desk is http://127.0.0.1:8040. The gateway is http://127.0.0.1:8050.

## Layout

`src/app` is the Angular desk: sign-in, shell, compose, templates, wallet, and report. `server/src` is the gateway: the DLT check, the SMPP bind, the channel submit, and the ledger.
