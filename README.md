# PawaPay Callback Proxy — Cloudflare Worker

Stateless proxy that routes PawaPay webhook callbacks to the correct Ando service (Customer or Rider app) based on the `service` field in the callback metadata.

## How it works

```
PawaPay ──POST──▶ Worker ──reads metadata──▶ service=CUST  → Customer App
                                             service=RIDER → Rider App
```

1. Each Django app includes `{"fieldName": "service", "fieldValue": "RIDER"}` (or `"CUST"`) in the PawaPay metadata when initiating a deposit/payout
2. PawaPay echoes this metadata back in the callback
3. The Worker reads it and forwards to the correct downstream URL
4. Fully stateless — no database, no KV store, just routing

## Local development

```bash
# Install dependencies
npm install

# Start the worker locally (runs on http://localhost:8787)
npx wrangler dev

# In another terminal, run the test suite
node tests/test_routing.js
```

The test suite sends 10 scenarios including happy paths, edge cases, and error handling. Watch the `wrangler dev` console to see forwarding logs.

> Note: Tests for routing to CUST/RIDER will show "Downstream unreachable" or
> "Forwarded (downstream error)" locally — that's expected since your Django
> apps aren't running at the configured URLs. The test validates the Worker's
> routing decisions via the response body messages.

## Deploy

```bash
# Login to Cloudflare (first time only)
npx wrangler login

# Deploy
npx wrangler deploy
```

### Custom domain setup

Option A — Workers route (if andofoods.co is on Cloudflare):

1. Uncomment the `routes` section in `wrangler.toml`
2. Set `proxy.andofoods.co` (or whatever subdomain you want)
3. Redeploy

Option B — Workers custom domain:

1. Go to Cloudflare dashboard → Workers → your worker → Triggers
2. Add a custom domain

Either way, set the callback URLs in PawaPay portal to:

| Type    | URL                                                   |
| ------- | ----------------------------------------------------- |
| Deposit | `https://proxy.andofoods.co/callback/pawapay/deposit` |
| Payout  | `https://proxy.andofoods.co/callback/pawapay/payout`  |
| Refund  | `https://proxy.andofoods.co/callback/pawapay/refund`  |

## Django integration

Copy `django_integration/pawapay_utils.py` into both apps.

```python
# settings.py
PAWAPAY_SERVICE_PREFIX = "RIDER"  # or "CUST" for customer app

# When initiating a deposit:
from payments.pawapay_utils import generate_deposit_id, build_metadata

deposit_id = generate_deposit_id()  # plain UUID v4
metadata = build_metadata(order_id="ORD-123", rider_id="42")
# → [
#     {"fieldName": "service", "fieldValue": "RIDER"},
#     {"fieldName": "order_id", "fieldValue": "ORD-123"},
#     {"fieldName": "rider_id", "fieldValue": "42"},
#   ]

payload = {
    "depositId": deposit_id,
    "amount": "3000",
    "currency": "RWF",
    "correspondent": "MTN_MOMO_RWA",
    "payer": {"type": "MSISDN", "address": {"value": "250780000000"}},
    "metadata": metadata,
}
```

## Project structure

```
├── src/
│   └── index.js           # Worker — routing logic
├── tests/
│   └── test_routing.js    # Test suite
├── django_integration/
│   └── pawapay_utils.py   # Drop into both Django apps
├── wrangler.toml           # Cloudflare config + env vars
└── package.json
```
