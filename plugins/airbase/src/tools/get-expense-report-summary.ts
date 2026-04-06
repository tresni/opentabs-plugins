import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface SummaryCategory {
  amount: number | string;
  payout_currency?: { symbol: string; iso_code: string; number_to_basic: number };
  currency?: { symbol: string; iso_code: string; number_to_basic: number };
  count?: number;
}

interface ExpenseReportSummaryResponse {
  reports_pending_approval: SummaryCategory;
  reports_sent_back: SummaryCategory;
  reports_in_progress: SummaryCategory;
  reports_approved_unpaid: SummaryCategory;
  reports_paid: SummaryCategory;
  pct_reports_pending_approval: SummaryCategory;
}

export const getExpenseReportSummary = defineTool({
  name: 'get_expense_report_summary',
  displayName: 'Get Expense Report Summary',
  description:
    'Get a summary of your expense reports: counts and amounts for pending approval, sent back, in progress, approved but unpaid, and paid. Useful for a quick overview of your reimbursement status.',
  icon: 'bar-chart-3',
  group: 'Expense Reports',
  input: z.object({}),
  output: z.object({
    pending_approval: z.object({
      count: z.number().describe('Number of reports pending approval'),
      amount: z.string().describe('Total amount pending approval'),
    }),
    sent_back: z.object({
      count: z.number().describe('Number of reports sent back'),
      amount: z.string().describe('Total amount sent back'),
    }),
    in_progress: z.object({
      count: z.number().describe('Number of reports in progress'),
      amount: z.string().describe('Total amount in progress'),
    }),
    approved_unpaid: z.object({
      count: z.number().describe('Number of approved but unpaid reports'),
      amount: z.string().describe('Total approved but unpaid amount'),
    }),
    paid: z.object({
      count: z.number().describe('Number of paid reports'),
      amount: z.string().describe('Total paid amount'),
    }),
  }),
  handle: async () => {
    const data = await airbaseGet<ExpenseReportSummaryResponse>('/service/expense_report/summary/', {
      show_count: true,
    });

    return {
      pending_approval: mapCategory(data.reports_pending_approval),
      sent_back: mapCategory(data.reports_sent_back),
      in_progress: mapCategory(data.reports_in_progress),
      approved_unpaid: mapCategory(data.reports_approved_unpaid),
      paid: mapCategory(data.reports_paid),
    };
  },
});

function mapCategory(cat: SummaryCategory) {
  const cur = cat.payout_currency ?? cat.currency;
  const sym = cur?.symbol ?? '$';
  const amountNum = typeof cat.amount === 'string' ? parseFloat(cat.amount) : cat.amount;
  const amountCents = cur?.number_to_basic ? Math.round(amountNum * cur.number_to_basic) : Math.round(amountNum * 100);
  return {
    count: cat.count ?? 0,
    amount: formatCents(amountCents, sym),
  };
}
