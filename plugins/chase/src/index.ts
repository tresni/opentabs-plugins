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
  readonly name = 'tresni-chase';
  readonly description = 'Access Chase accounts and transactions';
  override readonly displayName = 'Chase';
  readonly urlPatterns = ['*://*.chase.com/*'];
  readonly tools: ToolDefinition[] = [listAccounts, listTransactions];

  async isReady(): Promise<boolean> {
    return window.isUserAuthenticated === true;
  }

  /**
   * Reset Chase's inactivity timer after each tool invocation.
   *
   * Chase tracks user activity via keydown/click/scroll events on `window`
   * (see appkit-utilities/sessionTimeout/timeout). API fetch() calls made by
   * the plugin don't fire these DOM events, so Chase's frontend timer keeps
   * counting down and eventually shows a "session about to expire" modal
   * (at 18 min) then force-signs out (at 20 min).
   *
   * Dispatching a synthetic click on `window` resets that timer.
   */
  override onToolInvocationEnd(): void {
    window.dispatchEvent(new MouseEvent('click', { bubbles: false }));
  }
}

export default new ChasePlugin();
