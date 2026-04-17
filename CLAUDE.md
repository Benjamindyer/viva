# Viva Españiel

Dog transport service website — Spain ↔ UK.

## Project structure

- `pet-transport-to-spain.html` — main public site (the product)
- `index.html` — redirect to `pet-transport-to-spain.html`
- `admin.html` — admin dashboard (login-protected)
- `supabase/` — backend (Edge Functions + DB migrations)

## Tech stack

- Pure HTML/CSS/JS — no build step, no framework, no npm
- [Leaflet.js](https://leafletjs.com) for the route map
- [Supabase](https://supabase.com) for database + auth + serverless functions
- [Resend](https://resend.com) for transactional email

## Supabase Edge Functions

Located in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `route-proxy` | Proxies OpenRouteService API calls |
| `submit-booking` | Handles booking form submissions |
| `admin-auth` | Admin login (JWT-based) |
| `admin-bookings` | CRUD for bookings in admin |
| `send-payment-details` | Sends PayPal payment email to customer |

## Database

Migrations in `supabase/migrations/` — run in order via Supabase SQL Editor.

## Key conventions

- Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set at the top of both `pet-transport-to-spain.html` and `admin.html`
- Secrets (API keys, passwords) are configured via `supabase secrets set`, never hardcoded
- All styles are inline `<style>` blocks inside each HTML file — no separate CSS files
- All JS is inline `<script>` blocks inside each HTML file — no separate JS files
- CSS variables defined in `:root`: `--primary: #c84b31`, `--secondary: #ffb319`, `--accent: #2d6a4f`, `--dark: #1a1a2e`

## Deployment

Static files served via GitHub Pages. Edge Functions deployed via Supabase CLI.
See `supabase/SETUP.md` for full setup instructions.
