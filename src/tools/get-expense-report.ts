import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface ExpenseReportItem {
  id: number;
  service: { name: string } | null;
  gl_category: { id: number; name: string } | null;
  purpose: string | null;
  payout_amount: number;
  payout_amount_basic: number;
  cost_cents: number;
  transaction_date: string | null;
  receipt: { name: string } | null;
  violations_count: number;
  payout_currency: { symbol: string; iso_code: string } | null;
}

interface ExpenseReportDetail {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  state: string;
  approval_status: string;
  cost_cents: number;
  payout_amount_basic: number;
  number_of_expenses: number;
  report_type: string;
  submitted_date: string | null;
  updated_date: string;
  created_date: string;
  payout_currency: { symbol: string; iso_code: string };
  pending_on_ids: number[];
  sent_back_details: { reason: string } | null;
  payment_details: {
    status: string;
    payment_method: string;
    estimated_payment_date: string | null;
    completed_date: string | null;
    payout_amount_basic: number;
    failure_reason: string;
  } | null;
  total_violations_count: number;
  has_comments: boolean;
  expense_report_items: ExpenseReportItem[];
}

export const getExpenseReport = defineTool({
  name: 'get_expense_report',
  displayName: 'Get Expense Report',
  description:
    'Get detailed information about a specific expense report including all individual expenses, approval status, and payment info. Use list_expense_reports first to find report IDs.',
  icon: 'receipt',
  group: 'Expense Reports',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
  }),
  output: z.object({
    id: z.number().describe('Report ID'),
    name: z.string().describe('Report name'),
    start_date: z.string().describe('Report start date'),
    end_date: z.string().describe('Report end date'),
    state: z.string().describe('Report state'),
    approval_status: z.string().describe('Approval status'),
    total_cost: z.string().describe('Total cost'),
    payout_amount: z.string().describe('Payout amount'),
    currency: z.string().describe('Currency ISO code'),
    number_of_expenses: z.number().describe('Number of expenses'),
    report_type: z.string().describe('Report type'),
    submitted_date: z.string().nullable().describe('Date submitted'),
    created_date: z.string().describe('Date created'),
    violations_count: z.number().describe('Number of policy violations'),
    sent_back_reason: z.string().nullable().describe('Reason if sent back'),
    payment_status: z.string().nullable().describe('Payment status'),
    payment_method: z.string().nullable().describe('Payment method'),
    estimated_payment_date: z.string().nullable().describe('Estimated payment date'),
    payment_completed_date: z.string().nullable().describe('Payment completed date'),
    expenses: z.array(
      z.object({
        id: z.number().describe('Expense item ID'),
        vendor: z.string().describe('Vendor/merchant name'),
        category: z.string().describe('GL expense category name'),
        category_id: z.number().nullable().describe('GL expense category ID (use with add_expense/update_expense)'),
        description: z.string().describe('Expense description/purpose'),
        amount: z.string().describe('Expense amount'),
        date: z.string().nullable().describe('Transaction date'),
        has_receipt: z.boolean().describe('Whether a receipt is attached'),
        violations_count: z.number().describe('Number of violations on this expense'),
      }),
    ),
  }),
  handle: async params => {
    const report = await airbaseGet<ExpenseReportDetail>(`/service/expense_report/${params.report_id}/`);
    const sym = report.payout_currency?.symbol ?? '$';
    return {
      id: report.id,
      name: report.name,
      start_date: report.start_date,
      end_date: report.end_date,
      state: report.state,
      approval_status: report.approval_status,
      total_cost: formatCents(report.cost_cents, sym),
      payout_amount: formatCents(report.payout_amount_basic, sym),
      currency: report.payout_currency?.iso_code ?? 'USD',
      number_of_expenses: report.number_of_expenses ?? report.expense_report_items?.length ?? 0,
      report_type: report.report_type,
      submitted_date: report.submitted_date,
      created_date: report.created_date,
      violations_count: report.total_violations_count ?? 0,
      sent_back_reason: report.sent_back_details?.reason ?? null,
      payment_status: report.payment_details?.status ?? null,
      payment_method: report.payment_details?.payment_method ?? null,
      estimated_payment_date: report.payment_details?.estimated_payment_date ?? null,
      payment_completed_date: report.payment_details?.completed_date ?? null,
      expenses: (report.expense_report_items ?? []).map(item => {
        const itemSym = item.payout_currency?.symbol ?? sym;
        return {
          id: item.id,
          vendor: item.service?.name ?? '',
          category: item.gl_category?.name ?? '',
          category_id: item.gl_category?.id ?? null,
          description: item.purpose ?? '',
          amount: formatCents(item.payout_amount_basic ?? item.cost_cents, itemSym),
          date: item.transaction_date,
          has_receipt: item.receipt != null,
          violations_count: item.violations_count ?? 0,
        };
      }),
    };
  },
});
