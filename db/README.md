# Every Inn Admin Database Migrations

This folder contains D1 / SQLite migrations.

## Local Development (with Wrangler D1 Local SQLite)

1. Run table creation:
```bash
npm run db:migrate:local
```

2. Seed initial master data (Property, Rooms, Pricing rules, Admin/Staff users):
```bash
npm run db:seed:local
```

Default credentials:
- **Manager**: Phone `0901234567`, Password: `everyinn2024`
- **Receptionist**: Phone `0909998888`, Password: `everyinn2024`

## Remote Production (Cloudflare D1)

1. Make sure you are logged in to Wrangler:
```bash
npx wrangler login
```

2. Put your real D1 Database ID into `wrangler.jsonc` under `d1_databases[0].database_id`.

3. Run migrations on Cloudflare D1:
```bash
npm run db:migrate:remote
npm run db:seed:remote
```
