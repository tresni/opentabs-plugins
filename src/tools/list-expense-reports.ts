import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface DraftReportsResponse {
  count: number;
  page: number;
  page_size: number;
  results: ExpenseReportItem[];
}

interface SubmittedReportsResponse {
  has_next: boolean;
  page: number;
  page_size: number;
  results: ExpenseReportItem[];
}

interface ExpenseReportItem {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  state?: string;
  approval_status?: string;
  total_cost_cents: number;
  total_payout_amount_basic?: number;
  number_of_items: number;
  report_type: string;
  submitted_date?: string;
  updated_date?: string;
  payout_currency: { symbol: string; iso_code: string };
  payment?: {
    status: string;
    estimated_payment_date: string | null;
    completed_date: string | null;
    payout_amount_basic: number;
  } | null;
  pending_on?: string | null;
}

export const listExpenseReports = defineTool({
  name: 'list_expense_reports',
  displayName: 'List Expense Reports',
  description:
    'List your expense reports by state. Draft reports are in progress; submitted reports have been sent for approval. Shows report name, date range, total cost, item count, and payment status.',
  icon: 'receipt',
  group: 'Expense Reports',
  input: z.object({
    state: z.enum(['draft', 'submitted']).optional().describe('Report state filter (default: submitted)'),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(50).optional().describe('Results per page (default 15)'),
  }),
  output: z.object({
    reports: z.array(
      z.object({
        id: z.number().describe('Report ID'),
        name: z.string().describe('Report name'),
        start_date: z.string().describe('Report start date'),
        end_date: z.string().describe('Report end date'),
        state: z.string().describe('Report state (draft, submitted)'),
        approval_status: z.string().describe('Approval status'),
        total_cost: z.string().describe('Total cost'),
        number_of_items: z.number().describe('Number of line items'),
        report_type: z.string().describe('Report type (out_of_pocket, etc.)'),
        payment_status: z.string().nullable().describe('Payment status if submitted'),
      }),
    ),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const state = params.state ?? 'submitted';
    const pageSize = params.page_size ?? 15;
    const page = params.page ?? 1;

    if (state === 'draft') {
      // include_receipts matches what the Airbase UI sends — do not remove
      const data = await airbaseGet<DraftReportsResponse>('/service/expense_report/', {
        state: 'draft',
        include_receipts: true,
        page_size: pageSize,
        page,
      });
      return {
        reports: data.results.map(r => mapReport(r, 'draft')),
        has_next: data.count > page * pageSize,
        page: data.page,
      };
    }

    const data = await airbaseGet<SubmittedReportsResponse>('/service/expense_report/list/requestor/submitted/', {
      page,
      page_size: pageSize,
      sort_by: '-submitted_date',
    });
    return {
      reports: data.results.map(r => mapReport(r, 'submitted')),
      has_next: data.has_next ?? false,
      page: data.page,
    };
  },
});

function mapReport(r: ExpenseReportItem, fallbackState: string) {
  const sym = r.payout_currency?.symbol ?? '$';
  return {
    id: r.id,
    name: r.name,
    start_date: r.start_date,
    end_date: r.end_date,
    state: r.state ?? fallbackState,
    approval_status: r.approval_status ?? 'pending',
    total_cost: formatCents(r.total_cost_cents, sym),
    number_of_items: r.number_of_items,
    report_type: r.report_type,
    payment_status: r.payment?.status ?? null,
  };
}
