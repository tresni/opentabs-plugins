import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface BillDetail {
  id: number;
  vendor: {
    id: number;
    company_given_name: string;
    preferred_payment_method: string | null;
    payment_terms: string | null;
    service: { name: string };
  };
  subsidiary: { id: number; name: string };
  requested_by: { id: number; first_name: string; last_name: string; email: string };
  invoice_number: string;
  payment_due_date: string | null;
  amount_cents: number;
  balance_amount_cents: number;
  gl_amount_cents: number;
  status: string;
  notes: string;
  created_date: string;
  invoice_date: string | null;
}

interface ApproverResponse {
  id: number;
  approvers: {
    id: number;
    approver: { id: number; first_name: string; last_name: string; email: string };
    status: string;
    created_date: string;
    last_updated_date: string;
  }[];
}

export const getBill = defineTool({
  name: 'get_bill',
  displayName: 'Get Bill',
  description:
    'Get detailed information about a specific bill including vendor, amounts, due date, and the full list of approvers with their approval status. Use list_bills first to find bill IDs.',
  icon: 'file-text',
  group: 'Bill Payments',
  input: z.object({
    bill_id: z.number().int().describe('The bill ID'),
  }),
  output: z.object({
    id: z.number().describe('Bill ID'),
    vendor_name: z.string().describe('Vendor name'),
    invoice_number: z.string().describe('Invoice number'),
    invoice_date: z.string().nullable().describe('Invoice date'),
    amount: z.string().describe('Bill amount'),
    balance: z.string().describe('Remaining balance'),
    payment_due_date: z.string().nullable().describe('Payment due date'),
    status: z.string().describe('Bill status'),
    requested_by: z.string().describe('Who requested this bill'),
    requested_by_email: z.string().describe('Requester email'),
    subsidiary: z.string().describe('Subsidiary name'),
    payment_method: z.string().describe('Preferred payment method'),
    payment_terms: z.string().describe('Payment terms'),
    notes: z.string().describe('Bill notes'),
    created_date: z.string().describe('Date bill was created'),
    approvers: z.array(
      z.object({
        name: z.string().describe('Approver name'),
        email: z.string().describe('Approver email'),
        status: z.string().describe('Approval status (created, accepted, denied)'),
      }),
    ),
  }),
  handle: async params => {
    const [bill, approverData] = await Promise.all([
      airbaseGet<BillDetail>(`/service/bill/${params.bill_id}/`),
      airbaseGet<ApproverResponse[]>('/service/bill/get_approvers_for_list/', { bill_ids: params.bill_id }),
    ]);

    const approvers = approverData.find(a => a.id === params.bill_id)?.approvers ?? [];

    return {
      id: bill.id,
      vendor_name: bill.vendor.company_given_name,
      invoice_number: bill.invoice_number ?? '',
      invoice_date: bill.invoice_date,
      amount: formatCents(bill.amount_cents),
      balance: formatCents(bill.balance_amount_cents),
      payment_due_date: bill.payment_due_date,
      status: bill.status,
      requested_by: `${bill.requested_by.first_name} ${bill.requested_by.last_name}`.trim(),
      requested_by_email: bill.requested_by.email,
      subsidiary: bill.subsidiary?.name ?? '',
      payment_method: bill.vendor.preferred_payment_method ?? 'unknown',
      payment_terms: bill.vendor.payment_terms ?? '',
      notes: bill.notes ?? '',
      created_date: bill.created_date,
      approvers: approvers.map(a => ({
        name: `${a.approver.first_name} ${a.approver.last_name}`.trim(),
        email: a.approver.email,
        status: a.status,
      })),
    };
  },
});
