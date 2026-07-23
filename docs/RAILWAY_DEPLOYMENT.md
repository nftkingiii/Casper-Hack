# Railway deployment

Agent Blackbox now runs as one Railway web service. The Node server serves the dashboard and the product API from the same domain.

## Service settings

Use these settings in Railway:

```text
Build command: npm run build
Start command: npm start
Health check path: /health
```

The included `railway.json` already sets those values for Nixpacks.

## Persistent storage

For a durable MVP, add a Railway Volume and mount it at:

```text
/data
```

Then add this environment variable:

```text
RECEIPT_STORE_PATH=/data/receipts.json
```

Without `RECEIPT_STORE_PATH`, the app stores receipts in `.data/receipts.json`, which is fine locally but not durable across production redeploys.

## Environment variables

Required for production:

```text
RECEIPT_STORE_PATH=/data/receipts.json
```

Recommended:

```text
AGENT_BLACKBOX_API_KEY=<long random server-to-server token>
AGENT_BLACKBOX_CONTRACT_HASH=hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8
AGENT_BLACKBOX_CONTRACT_PACKAGE_HASH=hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb
AGENT_BLACKBOX_INSTALL_TX=527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c
AGENT_BLACKBOX_SAMPLE_RECEIPT_ID=28f49029-999a-496c-8e64-ce94df16b7bf
AGENT_BLACKBOX_SAMPLE_RECEIPT_HASH=235470a706053333103e6c12741c4cfa8e147ab1d0230a1343e075c55cfac359
AGENT_BLACKBOX_SAMPLE_RECEIPT_TX=b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad
CSPR_CLICK_APP_ID=your-production-cspr-click-app-id
CSPR_CLOUD_API_KEY=your-cspr-cloud-api-key
CASPER_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_CALL_PAYMENT=5000000000
```

`AGENT_BLACKBOX_API_KEY` protects write endpoints. Leave it unset for an open public demo, or set it when teams integrate Agent Blackbox server-to-server.

Create the CSPR.click application ID in the CSPR.build console and authorize the Railway domain. Keep the CSPR.cloud API key server-side; the browser only receives a boolean capability flag from `/api/config`.

## Public endpoints

```text
GET  /health
GET  /api/config
GET  /api/receipts
POST /api/receipts
GET  /api/receipts/:receiptId
POST /api/receipts/:receiptId/verify
POST /api/receipts/:receiptId/anchor
POST /api/receipts/:receiptId/transaction
POST /api/receipts/:receiptId/confirm
GET  /api/receipts/:receiptId/proof
```

When `AGENT_BLACKBOX_API_KEY` is set, write requests need:

```text
Authorization: Bearer <AGENT_BLACKBOX_API_KEY>
```

## Deploy steps

1. Push the repository to GitHub.
2. Create a new Railway project from the GitHub repository.
3. Confirm Railway detects the Node app through Nixpacks.
4. Add a Volume mounted at `/data`.
5. Add `RECEIPT_STORE_PATH=/data/receipts.json`.
6. Deploy.
7. Open `/health` on the Railway domain and confirm `ok: true`.
8. Open the root page and check that the API status card says `Persisted`.

After Railway gives you the production domain, update the GitHub repository website field and README link to the new Railway URL.
