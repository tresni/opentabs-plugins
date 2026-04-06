import { z } from 'zod';
import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, airbasePost, extractBulkItems, formatCents, getDefaultDepartmentTag } from '../lib/api.js';

interface ExpenseItem {
  id: number;
  payout_amount: number;
  payout_amount_basic: number;
  cost_cents: number;
  purpose: string | null;
  transaction_date: string | null;
  service: { name: string } | null;
  gl_category: { id: number; name: string } | null;
}

interface BulkResponse {
  expense_report_items?: ExpenseItem[];
  // The response may be the full report object or just the items
  [key: string]: unknown;
}

export const addExpense = defineTool({
  name: 'add_expense',
  displayName: 'Add Expense to Report',
  description:
    'Add a new expense to a draft expense report. Creates the expense and fills in the details in one step. Use get_expense_report to find the report ID and see existing expenses.',
  icon: 'plus',
  group: 'Expenses',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    merchant_name: z.string().min(1).describe('Merchant/vendor name'),
    amount: z.number().positive().describe('Expense amount in dollars'),
    date: z.string().describe('Transaction date in YYYY-MM-DD format'),
    category_id: z
      .number()
      .describe('GL expense category ID (use get_expense_report to see categories from existing expenses)'),
    purpose: z.string().optional().describe('Description/purpose of the expense'),
    department_tag_id: z.number().optional().describe('Department tag ID'),
  }),
  output: z.object({
    expense_id: z.number().describe('Created expense item ID'),
    merchant: z.string().describe('Merchant name'),
    amount: z.string().describe('Expense amount'),
    date: z.string().describe('Transaction date'),
    category: z.string().describe('GL category name'),
  }),
  handle: async params => {
    const amountCents = Math.round(params.amount * 100);

    const [addResult, subsidiaries, defaultDeptTag] = await Promise.all([
      airbasePost<BulkResponse>(`/service/expense_report/${params.report_id}/bulk_add/`, {
        items: [{ reimbursement_type: 'expense' }],
      }),
      airbaseGet<{ results: { id: number }[] }>('/customer/subsidiary/list_with_spend_types/', {
        access_type: 'all',
        page_size: 1,
      }),
      params.department_tag_id ? Promise.resolve(params.department_tag_id) : getDefaultDepartmentTag(),
    ]);

    const items = extractBulkItems<ExpenseItem>(addResult);
    const newItem = items[items.length - 1];
    if (!newItem) {
      throw ToolError.internal('Failed to create expense item');
    }

    const subsidiary = subsidiaries.results[0]?.id;
    if (!subsidiary) throw ToolError.internal('No subsidiary found');
    const glLineTags = defaultDeptTag ? [defaultDeptTag] : [];

    const updateResult = await airbasePost<BulkResponse>(`/service/expense_report/${params.report_id}/bulk_update/`, {
      items: [
        {
          reimbursement_type: 'expense',
          id: newItem.id,
          service_name: params.merchant_name,
          transaction_date: params.date,
          gl_category: params.category_id,
          gl_line_tags: glLineTags,
          purpose: params.purpose ?? '',
          cost: params.amount,
          payout_amount: params.amount,
          payout_amount_basic: amountCents,
          cost_cents: amountCents,
          subsidiary_amount: params.amount,
          subsidiary_amount_basic: amountCents,
          payout_usd_fx_rate: 1,
          payout_subsidiary_fx_rate: 1,
          subsidiary_id: subsidiary,
          payout_currency: 'USD',
          subsidiary_currency: 'USD',
          receipt_currency: null,
          receipt_amount_basic: null,
          receipt_payout_fx_rate: null,
          user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          approvers: [],
          attendees: [],
          split_group_id: null,
        },
      ],
    });

    const updated = extractBulkItems<ExpenseItem>(updateResult).find(i => i.id === newItem.id) ?? newItem;

    return {
      expense_id: updated.id,
      merchant: params.merchant_name,
      amount: formatCents(amountCents),
      date: params.date,
      category: updated.gl_category?.name ?? String(params.category_id),
    };
  },
});
