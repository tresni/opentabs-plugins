import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

export const detachReceipt = defineTool({
  name: 'detach_receipt',
  displayName: 'Detach Receipt from Expense',
  description:
    'Remove a receipt from an expense on a draft expense report. The receipt is returned to the receipt inbox. Use get_expense_report to see which expenses have receipts attached.',
  icon: 'x-circle',
  group: 'Receipts',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    expense_id: z.number().int().describe('The expense item ID to detach the receipt from'),
  }),
  output: z.object({
    detached: z.boolean().describe('Whether the receipt was successfully detached'),
    expense_id: z.number().describe('The expense item ID'),
  }),
  handle: async params => {
    // Airbase uses receipt: -1 to detach (not null)
    await airbasePost(`/service/expense_report/${params.report_id}/bulk_update/`, {
      items: [{ id: params.expense_id, receipt: -1 }],
    });

    return {
      detached: true,
      expense_id: params.expense_id,
    };
  },
});
