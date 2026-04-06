import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface PersonRef {
  id: number;
  full_name: string;
}

interface VendorRef {
  id: number;
  name: string;
  service: { name: string; logo: string | null };
}

interface PendingOnRef {
  pending_on_user: PersonRef | null;
  pending_on_group: { name: string } | null;
}

interface RequestItem {
  id: number;
  description: string;
  requested_by: PersonRef;
  submitted_on: string;
  pending_on: PendingOnRef | null;
  status: string;
  rl_status: string;
  request_type: string;
  vendor: VendorRef;
  amount: number;
  currency_code: string;
  is_one_time_payment?: boolean;
}

interface BillItem {
  id: number;
  description: string;
  requested_by: PersonRef;
  created_by: PersonRef;
  submitted_on: string;
  pending_on: PendingOnRef | null;
  status: string;
  rl_status: string;
  vendor: VendorRef;
  amount: number;
  currency_code: string;
  invoice_number: string;
  payment_status: string;
}

interface RequestListingResult {
  rl_id: number;
  request_type: string;
  request: RequestItem | null;
  bill: BillItem | null;
  expense_report: unknown | null;
  intake_request: unknown | null;
}

interface RequestListingResponse {
  count: number;
  page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: RequestListingResult[];
}

export const listRequests = defineTool({
  name: 'list_requests',
  displayName: 'List Requests',
  description:
    'List spend requests, bill approvals, and other requests. Use "my_requests" tab with "inprogress" to see your own pending requests (e.g. virtual card requests awaiting approval). Use "my_approvals" with "pending" to see requests waiting for your approval.',
  icon: 'inbox',
  group: 'Account',
  input: z.object({
    tab: z
      .enum(['my_requests', 'my_submissions', 'my_approvals', 'observing_requests'])
      .optional()
      .describe(
        'Which tab to view. my_requests = requests you submitted, my_submissions = items you created for others, my_approvals = items awaiting your approval, observing_requests = items you are watching. Default: my_requests.',
      ),
    tab_options: z
      .enum(['inprogress', 'pending', 'completed'])
      .optional()
      .describe('Status filter. Default: inprogress.'),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(50).optional().describe('Results per page (default 20)'),
  }),
  output: z.object({
    requests: z.array(
      z.object({
        rl_id: z.number().describe('Request listing ID'),
        request_type: z.string().describe('Type: SPEND_REQUEST, BILL, EXPENSE_REPORT, etc.'),
        vendor_name: z.string().describe('Vendor or service name'),
        description: z.string().describe('Request description'),
        amount: z.string().describe('Request amount'),
        status: z.string().describe('Current status'),
        submitted_on: z.string().describe('Date submitted'),
        requested_by: z.string().describe('Who submitted the request'),
        pending_on: z.string().nullable().describe('Who the request is currently waiting on'),
      }),
    ),
    count: z.number().describe('Total number of matching requests'),
    page: z.number().describe('Current page number'),
    has_next: z.boolean().describe('Whether more pages exist'),
  }),
  handle: async params => {
    const tab = params.tab ?? 'my_requests';
    const tabOptions = params.tab_options ?? 'inprogress';
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;

    const data = await airbaseGet<RequestListingResponse>('/request_listing/request/', {
      tab,
      tab_options: tabOptions,
      page,
      page_size: pageSize,
    });

    return {
      requests: data.results.map(r => mapResult(r)),
      count: data.count,
      page: data.page,
      has_next: data.next != null,
    };
  },
});

function mapResult(r: RequestListingResult) {
  const item = r.request ?? r.bill;
  if (!item) {
    return {
      rl_id: r.rl_id,
      request_type: r.request_type || 'UNKNOWN',
      vendor_name: '',
      description: '',
      amount: '$0.00',
      status: 'unknown',
      submitted_on: '',
      requested_by: '',
      pending_on: null,
    };
  }

  const fallbackType = r.request ? 'SPEND_REQUEST' : 'BILL';
  return {
    rl_id: r.rl_id,
    request_type: r.request_type || fallbackType,
    vendor_name: item.vendor?.name ?? '',
    description: item.description ?? '',
    amount: formatCents(item.amount * 100),
    status: item.rl_status ?? item.status,
    submitted_on: item.submitted_on,
    requested_by: item.requested_by?.full_name ?? '',
    pending_on: item.pending_on?.pending_on_user?.full_name ?? null,
  };
}
