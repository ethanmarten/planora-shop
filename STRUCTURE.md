# Planora - site structure

## Pages (client/src/pages)
| Route | File | Who |
|---|---|---|
| `/` | Home.tsx | everyone - hero + planner grid |
| `/planner/:slug` | Planner.tsx | everyone - details, live cover preview, name/email form, license checkbox |
| `/order/:token` | Order.tsx | the buyer (secret link) - payment status, download button, downloads left |
| `/license` | License.tsx | everyone - personal-use license |
| `/admin` | Admin.tsx | owner only - add planners, hide/show, orders, mark paid, refund, +downloads |

## Server (server/)
- `personalize.ts` - builds the buyer's copy: name on cover, licence footer, tracing metadata
- `store.ts` - database functions (products, orders, atomic download counter)
- `download.ts` - `GET /api/download/:token` and `POST /api/webhooks/payment`
- `routers.ts` - tRPC API: `catalog`, `orders`, `admin`, `auth`
- `storage.ts` - private file storage (master PDFs) - from the platform template
- `_core/` - platform plumbing (login, server start). Leave alone.

## Data (drizzle/)
`users`, `products`, `orders` - migrations `0000`, `0001`, `0002`.

## Products (seed/)
`seed/products.json` + one folder per planner with `master.pdf` and `cover.jpg`. Run `pnpm seed`.

## Money flow
Delivery: two PDFs from one master - `?format=a4` (A4 landscape sheets, two A5 pages each, instruction sheet first, cut marks at the centre) and `?format=a5` (single A5 pages for tablets). Both share the order's download count.

buyer fills form -> order `pending` -> payment confirmed (webhook or admin "Mark paid") -> order `paid` -> download builds the personalised PDF.
