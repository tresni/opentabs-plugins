import { z } from 'zod';
import { defineTool, log } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, getCurrentUserId } from '../lib/api.js';

export const getPendingActions = defineTool({
  name: 'get_pending_actions',
  displayName: 'Get Pending Actions',
  description:
    'Get a summary of everything needing your attention: pending approvals, missing receipts, and unmatched receipts in your inbox. This is the best starting point to understand what needs action.',
  icon: 'bell',
  group: 'Account',
  input: z.object({}),
  output: z.object({
    pending_request_approvals: z.number().describe('Number of spend requests awaiting your approval'),
    pending_bill_approvals: z.number().describe('Number of bills awaiting your approval'),
    pending_expense_report_approvals: z.number().describe('Number of expense reports awaiting your approval'),
    missing_receipts: z.number().describe('Number of your card transactions missing receipts'),
    pending_receipts_inbox: z.number().describe('Number of unmatched receipts in your inbox'),
  }),
  handle: async () => {
    const userId = getCurrentUserId();
    const now = new Date();
    const past45 = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    const [requestCount, billActions, expenseActions, missingReceipts, receiptsInbox] = await Promise.allSettled([
      airbaseGet<{ count: number }>('/request_listing/request/tab_count/', {
        tab: 'my_approvals',
        tab_options: 'pending',
      }),
      airbaseGet<{ count: number }>('/notifications/pending_bill_action/', {
        action_type: 'bill_approvals',
      }),
      airbaseGet<{ count: number }>('/notifications/pending_reimbursement_action/', {
        action_type: 'expense_report_approvals',
      }),
      airbaseGet<{ count: number }>('/reports/v2/transactions/count/', {
        start_date: formatDate(past45),
        end_date: formatDate(now),
        receipt_compliance_status: 'not_attached',
        exclude_transactions_past_receipt_attach_date: true,
        user_id: userId,
        page_size: 250, // matches Airbase UI — count endpoint, param may be required
      }),
      airbaseGet<{ count: number }>('/money/received_receipts/v2/pending/', {
        page_size: 1,
      }),
    ]);

    const extract = (result: PromiseSettledResult<{ count: number }>, label: string): number => {
      if (result.status === 'fulfilled') return result.value.count ?? 0;
      log.warn(`Failed to fetch ${label}`, { error: String(result.reason) });
      return 0;
    };

    return {
      pending_request_approvals: extract(requestCount, 'request approvals'),
      pending_bill_approvals: extract(billActions, 'bill approvals'),
      pending_expense_report_approvals: extract(expenseActions, 'expense report approvals'),
      missing_receipts: extract(missingReceipts, 'missing receipts'),
      pending_receipts_inbox: extract(receiptsInbox, 'receipts inbox'),
    };
  },
});
