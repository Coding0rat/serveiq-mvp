# ServeIQ — restaurant operations MVP

A mobile-first React/Vite restaurant workflow with QR-based ordering, kitchen tickets, bills, and administration. It works as a local demo by default and includes the production Supabase and Razorpay-test-mode integration files needed for launch.

> **Local demo limitations:** demo authentication is a client-side convenience, not production security. Data is saved in this browser's `localStorage`. Two tabs in the same browser stay in sync; separate devices do not. The demo payment flow does not transfer money. Do not deploy this local-only mode as a production restaurant system.

## Stack

- React 18 + Vite
- Tailwind CSS 3
- React Router 6
- Local `localStorage` demo store with cross-tab sync, plus optional Supabase-backed data mode
- `qrcode` for downloadable table QR images
- `jspdf` for bill PDF exports
- `lucide-react` for UI icons
- Supabase/Postgres schema, RLS, RPCs and seed data in `supabase/schema.sql`

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). No environment variables are required for the local demo.

The development and preview servers bind to `localhost` by default. For temporary phone testing on a trusted local network, explicitly run `npm run dev -- --host 0.0.0.0`, then stop it when finished.

### Demo routes

- Landing page: `/`
- Guest menu for Table 1: `/t/T1`
- Guest menu for Table 2: `/t/T2`
- Kitchen dashboard: `/kitchen`
- Admin workspace: `/admin`
- Order tracking and bill: `/order/<order-uuid>` (opened automatically after ordering)

### Demo accounts

Use the Staff login screen. The quick-fill buttons are also provided.

| Role | Email | Password |
|---|---|---|
| Kitchen | `kitchen@serveiq.demo` | `Kitchen123!` |
| Admin | `admin@serveiq.demo` | `Admin123!` |

These are fixed demo-only credentials in `src/lib/auth.jsx`; they are not Supabase users.

## Full demo walkthrough

1. Open `/t/T1`, search or filter the menu, and add two or more available items. Try adding **Truffle Parmesan Fries** to see the rule-based “Goes well with” suggestions.
2. Edit an item's special instructions in the cart, adjust quantities, and choose **Place order · Pay at reception** or **Place order · Pay online**.
3. The app opens the live order page with an order number, five-stage progress stepper, itemised bill, subtotal, 5% GST, and grand total.
4. In another browser tab, open `/kitchen` and sign in as `kitchen@serveiq.demo` / `Kitchen123!`. Accept the order, advance it to Preparing, Ready, then Served. The guest tracking page reacts to the same local store.
5. For the mock online-payment branch, use the **Pay online** order option and click either **Simulate successful payment** or **Simulate failed payment**. No payment gateway is called.
6. Open `/admin` and sign in as `admin@serveiq.demo` / `Admin123!`. Review the overview; go to Menu & pairings to add/edit items, toggle availability, manage categories and pairings; go to Tables & QR to generate and download a PNG QR; go to Bills & payments to mark a reception bill paid.
7. Print a bill with **Print bill** or download it as a PDF.

## Included functionality

- Categories, text search, veg/non-veg filter, unavailable dishes visibly disabled and never addable.
- Cart quantity controls, remove action, per-item notes, subtotal and 5% GST calculation.
- Rule-based “Goes well with” suggestions: admin-defined pairings first, plus items co-occurring in historical orders in the local sample store.
- Customer order-tracking stepper: Placed → Accepted → Preparing → Ready → Served.
- Kitchen live board grouped by status, clear table number, one-click status advancement, visible new-order alert, and best-effort audio chime (browser settings may block sound until interaction).
- Printable and downloadable PDF bill.
- Pay at reception and simulated online success/failure.
- Admin dashboard with today's orders, paid revenue, pending bills, active tables, top five ordered items, menu/category/pairing CRUD, availability toggles, table management, table QR PNG downloads and bill reconciliation.
- Demo role-based route gating.

## Folder structure

```text
serveiq/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── README.md
├── .env.example
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── StaffLayout.jsx
│   │   └── UI.jsx
│   ├── lib/
│   │   ├── auth.jsx
│   │   ├── demoStore.js
│   │   └── supabase.js
│   └── pages/
│       ├── AdminPage.jsx
│       ├── CustomerPage.jsx
│       ├── Home.jsx
│       ├── KitchenPage.jsx
│       ├── OrderPage.jsx
│       └── StaffLogin.jsx
└── supabase/
    └── schema.sql
```

## Reset local demo data

In the browser developer console, run:

```js
localStorage.removeItem('serveiq-demo-v1');
localStorage.removeItem('serveiq-demo-user');
location.reload();
```

The menu, tables, pairings and historical recommendation data will be re-seeded on reload.

## Switch from local demo to Supabase

Both modes are supported. The app stays in local demo mode unless `VITE_DATA_MODE=supabase` is set **and** the Supabase URL and anon key are configured. In Supabase mode, staff sign-in uses Supabase Auth and the role in `public.profiles`; menus/tables/categories/pairings load from Postgres; order creation uses the server-validated `place_order` RPC; guest order snapshots use a restricted RPC; kitchen order changes use checked RPCs; and customer/staff order updates use Realtime Broadcast.

1. Create a Supabase project.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it. This creates tables, RLS policies, RPCs, Realtime Broadcast triggers, 4 categories, 20 menu items, 5 tables, explicit pairings, and historical sample orders.
3. In **Authentication → Users**, create two staff users with email/password credentials you choose. Copy each user's UUID.
4. Assign the role profiles in SQL Editor (replace each UUID and display name):

   ```sql
   insert into public.profiles (id, role, display_name)
   values ('<KITCHEN_AUTH_USER_UUID>', 'kitchen', 'Kitchen Team');

   insert into public.profiles (id, role, display_name)
   values ('<ADMIN_AUTH_USER_UUID>', 'admin', 'Restaurant Admin');
   ```

5. Copy `.env.example` to `.env` and provide your project URL and **anon/public key**:

   ```dotenv
   VITE_DATA_MODE=supabase
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

6. Stop and restart `npm run dev`. Visit the app using table QR URLs/IDs from the database. The guest menu uses the table UUID from the QR URL in Supabase mode, while local mode uses `/t/T1` through `/t/T5`.

Local credentials in the previous section only work in demo mode. Supabase mode uses the Auth users you create in step 3.

The database checks table activity, current menu availability, quantities and canonical menu prices inside `place_order`, so the browser cannot set prices or submit unavailable dishes successfully. Online bills are never marked paid by the browser in Supabase mode; the Razorpay Edge Functions verify the payment signature and gateway status first.

## Production launch: tables, QR, database, and Razorpay test mode

The codebase is prepared for these four launch steps, but it cannot be connected or deployed until you supply the accounts and final website domain.

1. Create a Supabase project, run `supabase/schema.sql` in its SQL Editor, then create the admin and kitchen Auth users/profiles described above. For an existing ServeIQ database, run `supabase/migrations/202611170001_razorpay_payments.sql` and then `supabase/migrations/202611180001_deployment_hardening.sql`.
2. Deploy the `serveiq` directory to Vercel. Its `vercel.json` supplies the SPA route fallback and browser security headers. In Vercel, set these variables for the **Production** environment only: `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID` (when payments are enabled), and `VITE_PUBLIC_APP_URL` set to the exact HTTPS production domain. Never use a temporary preview URL for printed QR codes. Do not put a Supabase service-role key, Razorpay key secret, or webhook secret in Vercel or any `VITE_` variable.
3. Deploy the Vite site with an SPA rewrite so every `/t/<table-id>` route serves `index.html`. Once the final domain responds correctly, generate the five PNGs with:

   ```bash
   npm run generate:qrs -- https://your-live-domain.example
   ```

   This creates `public/table-qrs/serveiq-table-1-qr.png` through `serveiq-table-5-qr.png`. The IDs match the five tables seeded in `schema.sql`. For any table added later, use the Admin console's **Generate QR** button after deployment.

4. In Razorpay Dashboard, create **Test Mode** API keys and a webhook secret. Set the browser-safe test key as `VITE_RAZORPAY_KEY_ID`. Add these four secrets to Supabase Edge Functions—not the Vite site:

   ```text
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ALLOWED_ORIGIN=https://your-live-domain.example
   ```

   `ALLOWED_ORIGIN` must be the exact production origin, with no preview domains and no wildcard. Deploy `create-razorpay-order`, `verify-razorpay-payment`, and `razorpay-webhook` from `supabase/functions/`. In Razorpay, point the webhook to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` and subscribe to `payment.captured` and `payment.failed`. The functions create the gateway order from the database total, verify Razorpay's checkout signature, independently check the payment status, and store a private payment audit row before setting a bill to paid.

## Security notes before production

- Never put a Supabase `service_role` key in Vite variables or browser code. Only use the anon/public key client-side, with RLS enabled.
- The demo passwords are public test values; change all credentials when integrating Auth.
- `VITE_RAZORPAY_KEY_ID` is a public test key; the Razorpay key secret and webhook secret must exist only in Supabase Edge Function secrets. Never add either one to a `.env` used by Vite or commit it to source control.
- The payment endpoints intentionally allow guest checkout requests, so they have `verify_jwt = false`. They must be deployed only with `ALLOWED_ORIGIN` configured, and payment completion remains protected by a Razorpay signature plus a server-side gateway-status check.
- In Supabase Auth, set the production Site URL and any redirect URLs to the exact production domain, disable public sign-up if staff accounts are created by an administrator, and enable leaked-password protection. Confirm RLS remains enabled for every `public` table using the Supabase Security Advisor.
- Keep Vercel Preview deployments separate from production data: either use a separate Supabase project for Preview or do not assign the production `VITE_*` variables to that environment. Protect production deployments in Vercel with team access and MFA.
- If a service-role key, Razorpay secret, or webhook secret was ever pasted into browser code, a Vercel variable, a commit, or a shared chat, rotate it before launch.
- Configure production origins, auth redirect URLs, rate limits, backups and monitoring in Supabase before going live.
- Consider keeping immutable item-name snapshots in `order_items` before allowing deletion of menu items referenced by prior orders.
- Validate tax policy with the restaurant/accountant before using the fixed 5% GST assumption in a live business.

## Build verification

```bash
npm run build
```

The local mode remains suitable for demonstration and iterative development. Follow the production launch checklist above for shared, multi-device restaurant operation.
