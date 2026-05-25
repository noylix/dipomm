# Next Steps

## Current Priority
Stabilize the full buyer + seller + admin demo and clean up remaining visible issues before defense.

## Recommended Order
1. Fix any remaining visible UI text/encoding issues found in browser.
2. Manually click through buyer demo on the running server and note any UX snags.
3. Manually click through seller demo on the running server and note any UX snags.
4. Manually click through admin demo on the running server and note any UX snags.
5. If no blockers remain, prepare a short defense script with the best demo order.

## Definition of Done For Near Term
- Seller can quickly find products by status and process orders without confusion.
- Admin can moderate products and sellers, manage users, and update orders.
- Buyer, seller, and admin demo flows work without obvious breakage.
- Search suggestions and typo correction are visible in the live UI.

## Quick Test URLs
- `/seller/`
- `/seller/orders`
- `/cart/`
- `/order/orders`
- `/search?q=малако`
- `/admin/manage`
- `/admin/moderation`

## Notes
- Local app server is expected on `http://127.0.0.1:8000`.
- If a future session starts cold, read:
  1. `PROJECT_MEMORY.md`
  2. `NEXT_STEPS.md`
  3. `QUESTIONS_FOR_OWNER.md`
