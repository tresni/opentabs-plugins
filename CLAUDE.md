# CLAUDE.md

This is an OpenTabs browser plugin for Airbase (expense management SaaS). It runs in the browser page context via the OpenTabs Chrome extension, giving AI agents access to Airbase through the user's authenticated session.

## Architecture

```
src/
  index.ts              # Plugin entry point, tool registry
  lib/api.ts            # All API helpers, auth, HTTP methods
  tools/*.ts            # One file per tool (32 tools)
```

**Plugin class** in `index.ts` extends `OpenTabsPlugin` and registers all tools. Tools are organized into groups (Account, Expense Reports, Expenses, Receipts, Bill Payments, Virtual Cards, Vendors, Comments).

**API layer** in `lib/api.ts` provides `airbaseGet`, `airbasePost`, `airbasePatch`, `airbaseUpload`, `airbaseDelete`. All API access must go through these helpers — never call `fetch()` directly in tool files.

## Key Design Decisions

### Auth: Bearer token from localStorage
Airbase stores `id_token` (JWT) and `currentCompany` (company ID) in localStorage. All requests use Bearer token auth. No cookies needed. The `isReady()` check waits up to 5 seconds for auth tokens to appear.

### Brave browser compatibility
Uses `fetch()` directly instead of the SDK's `fetchFromPage`/`fetchJSON` because Brave blocks cross-origin requests with `credentials: 'include'`. Since Airbase uses Bearer tokens (not cookies), this works fine.

### Sardine fraud prevention token
Write operations include an `X-Airbase-Sardine-Token` header built from `sardine_session_token` in localStorage, prefixed with an ISO timestamp. This is optional but expected by the API.

### Bulk endpoint response format
Airbase bulk endpoints (`bulk_add`, `bulk_update`) inconsistently return either a plain array `[{item}, ...]` or an object `{ expense_report_items: [...] }`. Use `extractBulkItems()` from api.ts to normalize — never parse bulk responses manually in tool files.

### 204 No Content responses
`bulk_delete` and `airbaseDelete` return 204 with no body. `handleResponse()` returns `undefined` for 204 — this is expected, not an error.

### Receipt detachment magic value
To detach a receipt from an expense, set `receipt: -1` in the bulk_update payload. `null` does not work.

### Expense creation is two-step
Adding an expense requires: (1) `bulk_add` to create an empty item, then (2) `bulk_update` to fill in details (merchant, amount, date, category, etc). This matches the Airbase UI behavior.

### Bill approval uses approver entry ID
`approve_bill` and `deny_bill` take an `approver_id` which is the approver *entry* ID from `get_bill`'s approvers list — not the user ID. The endpoint is `PATCH /service/bill_approver/{approver_id}/`.

## API Base & Endpoints

Base URL: `https://api.airbase.in`

Key endpoint patterns:
- `/service/expense_report/` — expense report CRUD
- `/service/expense_report/{id}/bulk_add/`, `bulk_update/`, `bulk_delete/` — expense item operations
- `/service/expense_report/{id}/submit/` — submit report for approval
- `/service/bill/` — bills
- `/service/bill_approver/{id}/` — bill approval actions (PATCH with status)
- `/service/bill/{id}/send_back/` — send bill back (POST with send_back_notes)
- `/service/request_comment/` — comments (POST to create, DELETE to remove)
- `/service/comment_notifications/` — comment notifications (GET)
- `/money/received_receipts/` — receipt inbox (GET to list, POST multipart to upload)
- `/money/received_receipts/v2/pending/` — pending receipts
- `/ledger/account/expense_category/` — GL categories
- `/request_listing/request/` — unified request listing (all types)
- `/customer/subsidiary/list_with_spend_types/` — subsidiary lookup
- `/customer/user/` — user info

## Tool Development Patterns

Each tool is a single file exporting a `defineTool()` call with:
- `name`: snake_case (this is the MCP tool name)
- `displayName`: Human-readable
- `description`: Detailed — guides the AI on when/how to use the tool
- `icon`: Lucide icon name
- `group`: One of the established groups
- `input`/`output`: Zod schemas with `.describe()` on every field
- `handle`: Async function, returns the output object

Register new tools in `index.ts` by importing and adding to the `tools` array under the appropriate group comment.

## Gotchas

- **Never call fetch() directly in tools** — always use api.ts helpers. The upload-receipt tool previously did this and it caused auth header duplication.
- **Bulk API responses are inconsistent** — always use `extractBulkItems()`.
- **`deny_bill` and `send_back_bill` are unverified** — implemented based on JS bundle analysis, not live API testing. Status value `"rejected"` and endpoint `POST /service/bill/{id}/send_back/` were extracted from the Airbase frontend JS but never tested against the live API.
- **Amounts in the API are in cents** — use `formatCents()` to convert to dollar strings for output.
- **Subsidiary ID is required** for expense creation — fetched from `/customer/subsidiary/list_with_spend_types/` (first result).
- **Department tag** defaults are fetched from the user's GL line tags if not provided.
- **`list_expense_categories` fetches all** with `page_size: 800` — the category list is small enough that this is fine.

## Build & Quality

```bash
npm run dev          # Watch mode
npm run build        # One-shot build (tsc + opentabs-plugin build)
npm run check        # Full: build + type-check + lint + format
npm run lint:fix     # Auto-fix lint issues
npm run format       # Auto-format with Biome
```

Linting and formatting use Biome. TypeScript strict mode is enabled.
