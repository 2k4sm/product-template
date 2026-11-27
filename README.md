# Agent Office product template

A minimal public product baseline using Node.js 26 LTS, Express 4, PostgreSQL
via `pg`, plain HTML/CSS/vanilla JavaScript, and `node:test`. The health endpoint
returns `{"status":"ok"}` without connecting to PostgreSQL.

## Run locally

Install Node.js 26 LTS, then run:

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm start
```

The server listens on port `8080` by default. Set `PORT` or `DATABASE_URL` in the
environment as needed; see `.env.example`. No database is needed for the health
endpoint or the included tests.

```sh
curl --fail http://127.0.0.1:8080/healthz
```

Open `http://127.0.0.1:8080/` for the static frontend.

## Docker

```sh
docker build --tag product-template:local .
docker run --rm --publish 8080:8080 product-template:local
```

The multi-stage image runs as the non-root `node` user. Its `HEALTHCHECK`
requests `/healthz`. CI builds on native amd64 and arm64 runners, runs a
container health smoke test, and publishes the multi-architecture image to
`ghcr.io/<owner>/<repo>` with `sha-<short>` and `main` tags on `main` only.
Published images are public.

## Create a product from this template

After this template has passed independent review:

```sh
gh repo create <owner>/<name> --public --template 2k4sm/product-template --clone
```

Rename the package and user-facing product text, and replace the `product`
schema in the initial migration with the product's unique schema before the
first database migration. Keep one schema per product.

## Migrations

Create migration files locally with `supabase migration new <descriptive_name>`;
this needs no login or database. Replace the `product` schema in the initial
migration with the product's unique schema **before applying anything**. Never
apply the generic template placeholder unchanged, and keep one schema per
product.

Migrations are reviewed in a pull request. After merge, Agent Office production
uses the Supabase MCP `apply_migration` tool with exactly the reviewed SQL and
the same migration name, followed by `list_tables`, `list_migrations`, and
`get_advisors` verification. Do not use `supabase db push` for Agent Office
production; the office does not hold the database password.

## License

GNU AGPL-3.0-only; see `LICENSE`. Commercial licensing is described in
`COMMERCIAL.md`. Contributors must sign `CLA.md` through CLA Assistant.
