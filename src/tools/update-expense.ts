import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost, extractBulkItems, formatCents } from '../lib/api.js';
import { stripUndefined } from '@opentabs-dev/plugin-sdk';

interface BulkUpdateResponse {
  expense_report_items: {
    id: number;
    payout_amount: number;
    payout_amount_basic: number;
    cost_cents: number;
    purpose: string | null;
    transaction_date: string | null;
    service: { name: string } | null;
    gl_category: { id: number; name: string } | null;
  }[];
}

export const updateExpense = defineTool({
  name: 'update_expense',
  displayName: 'Update Expense on Report',
  description:
    'Update an existing expense on a draft expense report. Only the fields you provide will be changed. Use get_expense_report to find expense IDs and current values.',
  icon: 'pencil',
  group: 'Expenses',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    expense_id: z.number().int().describe('The expense item ID to update'),
    merchant_name: z.string().optional().describe('New merchant/vendor name'),
    amount: z.number().positive().optional().describe('New amount in dollars'),
    date: z.string().optional().describe('New transaction date in YYYY-MM-DD format'),
    category_id: z.number().optional().describe('New GL expense category ID'),
    purpose: z.string().optional().describe('New description/purpose'),
    department_tag_id: z.number().optional().describe('New department tag ID'),
  }),
  output: z.object({
    expense_id: z.number().describe('Updated expense item ID'),
    merchant: z.string().describe('Merchant name'),
    amount: z.string().describe('Expense amount'),
    date: z.string().nullable().describe('Transaction date'),
    category: z.string().describe('GL category name'),
  }),
  handle: async params => {
    const amountCents = params.amount ? Math.round(params.amount * 100) : undefined;

    const updateFields = stripUndefined({
      id: params.expense_id,
      reimbursement_type: 'expense' as const,
      service_name: params.merchant_name,
      transaction_date: params.date,
      gl_category: params.category_id,
      gl_line_tags: params.department_tag_id ? [params.department_tag_id] : undefined,
      purpose: params.purpose,
      cost: params.amount,
      payout_amount: params.amount,
      payout_amount_basic: amountCents,
      cost_cents: amountCents,
      subsidiary_amount: params.amount,
      subsidiary_amount_basic: amountCents,
      user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const result = await airbasePost(`/service/expense_report/${params.report_id}/bulk_update/`, {
      items: [updateFields],
    });

    const updated = extractBulkItems<BulkUpdateResponse['expense_report_items'][number]>(result).find(
      i => i.id === params.expense_id,
    );

    return {
      expense_id: params.expense_id,
      merchant: updated?.service?.name ?? params.merchant_name ?? '',
      amount: updated
        ? formatCents(updated.payout_amount_basic ?? updated.cost_cents)
        : amountCents != null
          ? formatCents(amountCents)
          : '',
      date: updated?.transaction_date ?? params.date ?? null,
      category: updated?.gl_category?.name ?? String(params.category_id ?? ''),
    };
  },
});
