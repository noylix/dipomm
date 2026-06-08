# Project Memory

## Project
Farm marketplace "Свои Ряды" on FastAPI + MySQL + React UI in `static/react-app.js`.

## Main Goal
Finish a working diploma-grade marketplace flow with focus on functionality first, not polished design.

## Current Product Direction
- Buyer flow must work end to end:
  - find product
  - add to cart
  - checkout
  - choose delivery
  - choose payment
  - see order history
  - receive status updates
- Seller flow must work end to end:
  - manage products
  - see seller cabinet
  - process seller orders
  - see finance summary

## Important User Preferences
- Prioritize functionality over design.
- Keep work practical for defense/demo.
- Seller UI should be structured and not cluttered with irrelevant buttons.
- Use project memory files to speed up future sessions.

## Important Technical Decisions
- Default DB handling was hardened in `database.py`.
- Runtime app startup requires `DATABASE_URL`; use MySQL for local/demo/production runs.
- SQLite is kept only for isolated pytest fixtures that set `DATABASE_URL` explicitly.
- Local server is normally run with:
  - `DATABASE_URL=mysql+pymysql://DB_USER:DB_PASSWORD@127.0.0.1:3306/farmmarket?charset=utf8mb4`
  - `uvicorn main:app --host 127.0.0.1 --port 8000`

## Implemented Features

### Checkout and Orders
- Unified checkout on cart page.
- Order fields:
  - customer name
  - phone
  - address
  - delivery method
  - delivery slot
  - comment
  - payment method
- Order creation, delivery creation, and payment flow are linked.
- Legacy empty checkout submit fallback exists.
- Repeat order works.
- Order receipt page exists.

### Buyer
- Cart works.
- Order history works.
- Repeat order button exists.
- Receipt page exists.
- Seller review after completed order exists.

### Seller
- Seller orders page exists.
- Seller can change order statuses.
- Seller can cancel with reason.
- Seller cabinet has tabs:
  - overview
  - products
  - add
  - finance
- Seller products tab has status filters.
- Seller orders page has summary cards and status filters.
- Seller finance block exists:
  - paid orders
  - gross revenue
  - platform fee
  - pending payout

### Reviews and Communication
- Product reviews exist.
- Seller reviews exist.
- Notifications on order status exist.

### Search
- Search improved across multiple fields.
- Suggestions endpoint exists.
- Simple typo correction exists for common Cyrillic mistakes.
- Search suggestions in the header are wired to the live `/api/search/suggestions` endpoint.
- Typo correction is verified for queries like `малако -> молоко` and `яблки -> яблоки`.

### Admin
- Admin manage page now has structured tabs:
  - products
  - users
  - orders
  - add product
- Admin moderation page now has separate moderation areas for:
  - pending products
  - pending sellers
- Admin can change user roles.
- Admin can approve/block sellers.
- Admin can change order statuses from admin manage page.

## Verified Flows
- Seller can add a product from seller cabinet; new seller product is created with `pending` status.
- Admin can approve a pending seller.
- Admin can approve a pending product.
- Seller cabinet route and seller orders route open successfully.
- Admin manage route and admin moderation route open successfully.
- Search page works with typo correction and returns corrected suggestions.
- Buyer checkout flow was re-verified in automated isolated test DB fixtures.
- Seller order status flow was re-verified: `confirm -> assemble -> ship -> deliver`.
- Buyer receives notifications for seller status changes.

## Current Runtime Status
- Local server is running on `http://127.0.0.1:8000`.
- Current server process was restarted after the latest search and UI fixes.

## Known Risks / Watchouts
- `static/react-app.js` had encoding issues before. New Russian labels should be added carefully.
- Some new UI labels are safer when inserted with unicode escapes if encoding looks unstable.
- Do not rely on bundled SQLite files for the demo; use MySQL through `DATABASE_URL`.

## Likely Next Useful Work
- Continue bug-fixing and defense polish.
- Add deeper admin analytics/detail screens if needed.
- Add seller profile/settings tab if needed.

## Files That Matter Most
- `main.py`
- `database.py`
- `models.py`
- `routes/order.py`
- `routes/seller.py`
- `routes/reviews.py`
- `routes/search.py`
- `static/react-app.js`
- `static/react-ui.css`
