# HisabApp Central API

## Environment

```env
DATABASE_URL=mysql://user:password@host:3306/hisabapp
PORT=3000
```

## Run

```bash
pnpm exec tsx server/index.ts
```

## Endpoints

- `GET /health`
- `POST /api/sync/push`
- `GET /api/reports/trial-balance?companyId=1`
- `GET /api/reports/cashboxes?companyId=1`

`POST /api/sync/push` requires an `Idempotency-Key`. The stock receipt operation is processed inside one MySQL transaction: receipt header, receipt line, stock movement, and sync operation record.

Before production use, add authentication, company scoping from the authenticated user, foreign keys/indexes, and the inventory balance update inside the same transaction.
