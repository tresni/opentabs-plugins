import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

interface CreateReportResponse {
  id: number;
  name: string;
  state: string;
}

export const createExpenseReport = defineTool({
  name: 'create_expense_report',
  displayName: 'Create Expense Report',
  description:
    'Create a new draft expense report. After creating, use add_expense or add_mileage_expense to add items.',
  icon: 'file-plus',
  group: 'Expense Reports',
  input: z.object({
    name: z.string().min(1).describe('Name for the expense report (e.g. "NYC offsite", "Q1 travel")'),
  }),
  output: z.object({
    report_id: z.number().describe('Created expense report ID'),
    name: z.string().describe('Report name'),
    state: z.string().describe('Report state (draft)'),
  }),
  handle: async params => {
    const result = await airbasePost<CreateReportResponse>('/service/expense_report/', {
      name: params.name,
      report_type: 'out_of_pocket',
      receipts: [],
    });

    return {
      report_id: result.id,
      name: result.name,
      state: result.state,
    };
  },
});
