import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

export const attachReceipt = defineTool({
  name: 'attach_receipt',
  displayName: 'Attach Receipt to Expense',
  description:
    'Attach a receipt from your receipt inbox to an expense on a draft expense report. Use list_pending_receipts to find receipt IDs and get_expense_report to find expense IDs.',
  icon: 'paperclip',
  group: 'Receipts',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    expense_id: z.number().int().describe('The expense item ID to attach the receipt to'),
    receipt_id: z.number().int().describe('The receipt ID from the receipt inbox (use list_pending_receipts to find)'),
  }),
  output: z.object({
    attached: z.boolean().describe('Whether the receipt was successfully attached'),
    expense_id: z.number().describe('The expense item ID'),
    receipt_id: z.number().describe('The attached receipt ID'),
  }),
  handle: async params => {
    await airbasePost(`/service/expense_report/${params.report_id}/bulk_update/`, {
      items: [
        {
          id: params.expense_id,
          reimbursement_type: 'expense',
          receipt: params.receipt_id,
        },
      ],
    });

    return {
      attached: true,
      expense_id: params.expense_id,
      receipt_id: params.receipt_id,
    };
  },
});
