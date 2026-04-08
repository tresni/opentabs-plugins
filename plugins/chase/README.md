# Chase

OpenTabs plugin for Chase — gives AI agents access to Chase through your authenticated browser session.

## Install

```bash
opentabs plugin install chase
```

Or install globally via npm:

```bash
npm install -g opentabs-plugin-chase
```

## Setup

1. Open [chase.com](https://chase.com) in Chrome and log in
2. Open the OpenTabs side panel — the Chase plugin should appear as **ready**

## Tools (2)

| Tool | Description | Type |
|---|---|---|
| `list_accounts` | List all Chase accounts with balances and payment info | Read |
| `list_transactions` | List transactions for a Chase account, with optional date range and pagination | Read |

## How It Works

This plugin runs inside your Chase tab through the [OpenTabs](https://opentabs.dev) Chrome extension. It uses your existing browser session — no API tokens or OAuth apps required. All operations happen as you, with your permissions.

## License

MIT
