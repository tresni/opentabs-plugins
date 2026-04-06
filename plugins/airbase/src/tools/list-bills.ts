import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents, getCurrentUserId } from '../lib/api.js';

const STATUS_MAP: Record<string, string> = {
  pending: 'created,sent_back',
  approved: 'approved',
  denied: 'denied',
  archived: 'archived',
};

interface BillsResponse {
  has_next: boolean;
  page: number;
  page_size: number;
  results: {
    id: number;
    vendor: {
      company_given_name: string;
      id: number;
      preferred_payment_method: string | null;
      service: { name: string };
    };
    subsidiary: { id: number; name: string };
    requested_by: { id: number; first_name: string; last_name: string; email: string };
    invoice_number: string;
    payment_due_date: string | null;
    amount_cents: number;
    balance_amount_cents: number;
    gl_amount_cents: number;
    gl_currency_id: number;
    created_date: string;
    approvers: { type: string; value: number }[];
  }[];
}

export const listBills = defineTool({
  name: 'list_bills',
  displayName: 'List Bills',
  description:
    'List bills filtered by status. Shows vendor name, invoice number, amount, due date, and who requested them. Use "pending" status to see bills awaiting approval.',
  icon: 'file-text',
  group: 'Bill Payments',
  input: z.object({
    status: z
      .enum(['pending', 'approved', 'denied', 'archived'])
      .optional()
      .describe('Bill status filter (default: pending)'),
    pending_on_me: z
      .boolean()
      .optional()
      .describe(
        'If true, only show bills pending on you. If false, show bills pending on others. Omit for all. Only applies to pending status.',
      ),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(100).optional().describe('Results per page (default 50)'),
  }),
  output: z.object({
    bills: z.array(
      z.object({
        id: z.number().describe('Bill ID'),
        vendor_name: z.string().describe('Vendor name'),
        invoice_number: z.string().describe('Invoice number'),
        amount: z.string().describe('Bill amount'),
        payment_due_date: z.string().nullable().describe('Payment due date'),
        requested_by: z.string().describe('Who requested this bill'),
        subsidiary: z.string().describe('Subsidiary name'),
        created_date: z.string().describe('Date bill was created'),
      }),
    ),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const status = params.status ?? 'pending';
    const apiStatus = STATUS_MAP[status];

    const queryParams: Record<string, string | number | boolean | undefined> = {
      status: apiStatus,
      page: params.page ?? 1,
      page_size: params.page_size ?? 50,
      is_bill_allocation: false,
      sort_by: '-payment_due_date',
    };

    if (status === 'pending' && params.pending_on_me !== undefined) {
      const userId = getCurrentUserId();
      if (params.pending_on_me) {
        queryParams.pending_on = userId;
      } else {
        queryParams.exclude_pending_on = userId;
      }
    }

    const data = await airbaseGet<BillsResponse>('/service/bill/', queryParams);

    return {
      bills: data.results.map(bill => ({
        id: bill.id,
        vendor_name: bill.vendor.company_given_name,
        invoice_number: bill.invoice_number ?? '',
        amount: formatCents(bill.amount_cents),
        payment_due_date: bill.payment_due_date,
        requested_by: `${bill.requested_by.first_name} ${bill.requested_by.last_name}`.trim(),
        subsidiary: bill.subsidiary?.name ?? '',
        created_date: bill.created_date,
      })),
      has_next: data.has_next,
      page: data.page,
    };
  },
});
