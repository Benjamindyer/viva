# Supabase setup guide

Follow these steps once to connect the site and admin to a live database.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up / log in
2. Click **New project** — choose a name (e.g. `viva-espaniel`) and a strong database password
3. Wait ~2 minutes for the project to provision

## 2. Run the database migrations

In the Supabase dashboard, go to **SQL Editor** and run the two migration files in order:

1. Paste the contents of `migrations/001_initial.sql` → Run
2. Paste the contents of `migrations/002_increment_spots.sql` → Run

## 3. Get your project credentials

In the dashboard go to **Settings → API**. You need:

- **Project URL** — looks like `https://xyzxyzxyz.supabase.co`
- **anon / public key** — the long JWT string under "Project API keys"

Update **both** of these in:
- `pet-transport-to-spain.html` — the `<script>` block near the top (lines with `SUPABASE_URL` and `SUPABASE_ANON_KEY`)
- `admin.html` — the same block at the top

## 4. Deploy the Edge Functions

Install the Supabase CLI (requires Node.js):

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Then set secrets (replace values with your real ones):

```bash
supabase secrets set ORS_API_KEY="your_openrouteservice_key"
supabase secrets set RESEND_API_KEY="your_resend_key"
supabase secrets set JON_EMAIL="jon@yourdomain.com"
supabase secrets set ADMIN_PASSWORD="choose_a_strong_password"
supabase secrets set ADMIN_JWT_SECRET="a_random_32+_char_string"
```

Then deploy all functions:

```bash
supabase functions deploy route-proxy
supabase functions deploy submit-booking --no-verify-jwt
supabase functions deploy admin-auth --no-verify-jwt
supabase functions deploy admin-bookings --no-verify-jwt
supabase functions deploy send-payment-details
```

> **Note:** `admin-auth` and `admin-bookings` use a custom JWT (signed with `ADMIN_JWT_SECRET`), not the Supabase project JWT. The `--no-verify-jwt` flag tells Supabase to skip its gateway-level JWT check so the functions can handle their own auth.

## 5. Configure Resend

1. Sign up at https://resend.com
2. Add and verify your sending domain (e.g. `vivaespaniel.com`)
3. Update the `from` address in `submit-booking/index.ts` and `send-payment-details/index.ts` to match your verified domain

## 6. Add travel dates in Admin

1. Open `admin.html` on your deployed site
2. Log in with the `ADMIN_PASSWORD` you set above
3. Go to **Travel Dates** and add your first run dates

## 7. Add PayPal details in Admin

1. In **Settings**, enter Jon's PayPal email and PayPal.me link
2. These are used in the payment details email sent to customers

## Done!

The site is ready to take real booking requests. Customers submit → Jon reviews in Admin → clicks **Send Payment Details** → customer pays deposit via PayPal.
