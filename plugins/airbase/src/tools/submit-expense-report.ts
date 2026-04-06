import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

export const submitExpenseReport = defineTool({
  name: 'submit_expense_report',
  displayName: 'Submit Expense Report',
  description:
    'Submit a draft expense report for approval. The report must have at least one expense item. Use get_expense_report to verify the report is in draft state and has items before submitting.',
  icon: 'send',
  group: 'Expense Reports',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID to submit'),
  }),
  output: z.object({
    submitted: z.boolean().describe('Whether the report was submitted'),
    report_id: z.number().describe('The expense report ID'),
  }),
  handle: async params => {
    await airbasePost(`/service/expense_report/${params.report_id}/submit/`, {});

    return {
      submitted: true,
      report_id: params.report_id,
    };
  },
});
