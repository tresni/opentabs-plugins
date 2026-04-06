import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';

declare global {
  interface Window {
    isUserAuthenticated?: boolean;
  }
}
import { listAccounts } from './tools/list-accounts.js';
import { listTransactions } from './tools/list-transactions.js';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';

class ChasePlugin extends OpenTabsPlugin {
  readonly name = 'chase';
  readonly description = 'Access Chase accounts and transactions';
  override readonly displayName = 'Chase';
  readonly urlPatterns = ['*://*.chase.com/*'];
  readonly tools: ToolDefinition[] = [listAccounts, listTransactions];

  async isReady(): Promise<boolean> {
    return window.isUserAuthenticated === true;
  }
}

export default new ChasePlugin();
