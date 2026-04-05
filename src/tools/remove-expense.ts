import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

export const removeExpense = defineTool({
  name: 'remove_expense',
  displayName: 'Remove Expense from Report',
  description:
    'Remove an expense from a draft expense report. This deletes the expense item permanently. Always confirm with the user before removing. Use get_expense_report to find expense IDs.',
  icon: 'trash-2',
  group: 'Expenses',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    expense_id: z.number().int().describe('The expense item ID to remove'),
  }),
  output: z.object({
    removed: z.boolean().describe('Whether the expense was successfully removed'),
    expense_id: z.number().describe('The removed expense item ID'),
  }),
  handle: async params => {
    await airbasePost<void>(`/service/expense_report/${params.report_id}/bulk_delete/`, {
      items: [params.expense_id],
    });

    return {
      removed: true,
      expense_id: params.expense_id,
    };
  },
});
