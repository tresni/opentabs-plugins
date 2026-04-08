# Airbase

OpenTabs plugin for Airbase — gives AI agents access to Airbase through your authenticated browser session.

## Install

```bash
opentabs plugin install @tresni/opentabs-plugin-airbase
```

Or install globally via npm:

```bash
npm install -g @tresni/opentabs-plugin-airbase
```

## Setup

1. Open [airbase.io](https://airbase.io) in Chrome and log in
2. Open the OpenTabs side panel — the Airbase plugin should appear as **ready**

## Tools (32)

### Account (2)

| Tool | Description | Type |
|---|---|---|
| `get_current_user` | Get your profile, email, and company info | Read |
| `list_requests` | List spend requests, bill approvals, and other requests by tab | Read |

### Expense Reports (4)

| Tool | Description | Type |
|---|---|---|
| `list_expense_reports` | List your expense reports by state (draft, submitted) | Read |
| `get_expense_report` | Detailed report with all expenses, approval, and payment info | Read |
| `create_expense_report` | Create a new draft expense report | Write |
| `submit_expense_report` | Submit a draft report for approval | Write |

### Expenses (5)

| Tool | Description | Type |
|---|---|---|
| `add_expense` | Add an expense to a draft report | Write |
| `update_expense` | Update an existing expense on a draft report | Write |
| `remove_expense` | Remove an expense from a draft report | Write |
| `add_mileage_expense` | Add a mileage expense with auto-calculated distance and reimbursement | Write |
| `list_expense_categories` | List GL expense categories and their IDs | Read |

### Receipts (4)

| Tool | Description | Type |
|---|---|---|
| `list_pending_receipts` | List unmatched receipts in your inbox | Read |
| `upload_receipt` | Upload a receipt to the inbox (URL or base64) | Write |
| `attach_receipt` | Attach an inbox receipt to an expense | Write |
| `detach_receipt` | Remove a receipt from an expense | Write |

### Bill Payments (5)

| Tool | Description | Type |
|---|---|---|
| `list_bills` | List bills filtered by status | Read |
| `get_bill` | Detailed bill info including approvers and their status | Read |
| `approve_bill` | Approve a bill pending your approval | Write |
| `deny_bill` | Deny/reject a bill pending your approval | Write |
| `send_back_bill` | Send a bill back to the submitter with notes | Write |

### Virtual Cards (7)

| Tool | Description | Type |
|---|---|---|
| `list_virtual_cards` | List cards with filter (recurring/onetime, active/suspended) | Read |
| `get_virtual_card` | Full card details: expiry, billing address, accounting, Marqeta reveal URL | Read |
| `list_card_transactions` | Transaction history with receipt compliance and GL sync status | Read |
| `create_virtual_card_request` | Submit a new virtual card request for approval | Write |
| `request_spend_limit_change` | Request a spend limit change on an existing card | Write |
| `lock_virtual_card` | Temporarily lock or unlock a card (reversible) | Write |
| `suspend_virtual_card` | Permanently suspend a card (irreversible) | Write |

### Vendors (2)

| Tool | Description | Type |
|---|---|---|
| `list_vendors` | List your company's vendors with status filter | Read |
| `search_vendors` | Search by name across company vendors and global catalog | Read |

### Comments (3)

| Tool | Description | Type |
|---|---|---|
| `add_comment` | Comment on an expense item, bill, or request | Write |
| `delete_comment` | Delete a comment you posted | Write |
| `list_comment_notifications` | List your comment notifications (unread by default) | Read |

## How It Works

This plugin runs inside your Airbase tab through the [OpenTabs](https://opentabs.dev) Chrome extension. It uses your existing browser session — no API tokens or OAuth apps required. All operations happen as you, with your permissions.

### Card Number Reveal

The `get_virtual_card` tool returns a `marqeta_reveal_url` field for retrieving the full card number (PAN) and CVV. Due to PCI-DSS security, this requires a 3-step process:

1. Open a tab to `https://widgets.marqeta.com/marqetajs/1.1.0/panframe.html`
2. Fetch the reveal URL from that tab (same-origin requirement)
3. Close the tab

The reveal URL expires ~5 minutes after the `get_virtual_card` call.

### Brave Browser Note

This plugin uses `fetch()` directly instead of the SDK's `fetchFromPage` because Brave browser blocks cross-origin requests with `credentials: 'include'`. Since Airbase uses Bearer token auth (not cookies), this has no impact on functionality.

## Development

```bash
npm install
npm run dev        # Watch mode (TypeScript + plugin build)
npm run check      # Full validation (build + type-check + lint + format)
```

## License

MIT
