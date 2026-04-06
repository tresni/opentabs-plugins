import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet } from '../lib/api.js';

interface ExpenseCategoryResponse {
  count: number;
  results: {
    id: number;
    name: string;
    acct_num: string | null;
    type: string;
  }[];
}

export const listExpenseCategories = defineTool({
  name: 'list_expense_categories',
  displayName: 'List Expense Categories',
  description:
    'List available GL expense categories for expense reports. Returns category IDs needed by add_expense and update_expense tools.',
  icon: 'tag',
  group: 'Expenses',
  input: z.object({}),
  output: z.object({
    categories: z.array(
      z.object({
        id: z.number().describe('Category ID (use with add_expense/update_expense)'),
        name: z.string().describe('Category name'),
      }),
    ),
  }),
  handle: async () => {
    const data = await airbaseGet<ExpenseCategoryResponse>('/ledger/account/expense_category/', {
      page_size: 800,
      page: 1,
    });

    return {
      categories: data.results.map(c => ({
        id: c.id,
        name: c.name,
      })),
    };
  },
});
