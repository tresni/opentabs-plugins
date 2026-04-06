import { z } from 'zod';
import { defineTool, log, ToolError } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, airbasePost, getApprovalPolicy, getDefaultDepartmentTag } from '../lib/api.js';

interface ServiceSearchResponse {
  count: number;
  results: { id: number; name: string; website: string; logo: string | null }[];
}

interface BufferedAmountResponse {
  resulted_amount: number;
  buffered_amount: number;
  buffer_percentage: number;
  exchange_rate: number;
}

interface CreatedRequest {
  id: number;
  status: string;
  pending_on: { id: number; first_name: string; last_name: string; full_name: string } | null;
}

export const createVirtualCardRequest = defineTool({
  name: 'create_virtual_card_request',
  displayName: 'Create Virtual Card Request',
  description:
    'Submit a new virtual card request for approval. Requires a vendor name (searched automatically), amount, and whether it is recurring or one-time. Optionally accepts a description and GL category/department tag IDs (use get_virtual_card on an existing card to find these). The request will be routed to the appropriate approvers based on company policy. Always confirm the details with the user before calling this tool.',
  icon: 'plus-circle',
  group: 'Virtual Cards',
  input: z.object({
    vendor_name: z.string().min(1).describe('Vendor/service name to search for (e.g. "Amazon Web Services")'),
    amount: z.number().positive().describe('Monthly spend amount in dollars (e.g. 35000)'),
    is_recurring: z.boolean().describe('true for recurring monthly card, false for one-time card'),
    description: z.string().optional().describe('Description/justification for the request'),
    category_id: z
      .number()
      .optional()
      .describe('GL account ID for the expense category (e.g. 2259788 for IT Software)'),
    department_tag_id: z.number().optional().describe('Department tag ID (e.g. 1332392 for "G&A > Executive")'),
    currency: z.string().optional().describe('Currency code (default: USD)'),
  }),
  output: z.object({
    request_id: z.number().describe('Created request ID'),
    status: z.string().describe('Request status (usually "created")'),
    vendor_name: z.string().describe('Matched vendor name'),
    amount: z.number().describe('Requested amount'),
    spend_limit: z.number().describe('Spend limit including buffer'),
    buffer_percentage: z.number().describe('Buffer percentage applied'),
    pending_on: z.string().nullable().describe('Name of first approver'),
    approvers: z.array(z.string()).describe('List of approver names'),
  }),
  handle: async params => {
    const currency = params.currency ?? 'USD';
    const amountCents = Math.round(params.amount * 100);
    const requestType = params.is_recurring ? 'recurring' : 'one-time';

    const services = await airbaseGet<ServiceSearchResponse>('/service/service/', {
      name: params.vendor_name,
      page_size: 5,
    });
    const service = services.results[0];
    if (!service) {
      throw ToolError.notFound(
        `No vendor found matching "${params.vendor_name}". The vendor must already exist in Airbase. Ask the user to verify the vendor name or create the vendor in Airbase first.`,
      );
    }
    log.info('Matched vendor', { service_id: service.id, name: service.name });

    const [subsidiaries, departmentTagId] = await Promise.all([
      airbaseGet<{ results: { id: number; name: string }[] }>('/customer/subsidiary/list_with_spend_types/', {
        access_type: 'all',
        page_size: 250,
      }),
      params.department_tag_id ? Promise.resolve(params.department_tag_id) : getDefaultDepartmentTag(),
    ]);
    const subsidiary = subsidiaries.results[0];
    if (!subsidiary) throw ToolError.internal('No subsidiary found');

    const [buffered, policy] = await Promise.all([
      airbaseGet<BufferedAmountResponse>('/approvals/request/buffered_amount/', {
        currency_type: currency,
        request_type: requestType,
        amount: amountCents,
        to_currency_code: currency,
      }),
      getApprovalPolicy({
        type: requestType,
        cost: params.amount,
        spend_limit_window: 'month',
        service_id: service.id,
        subsidiary_id: subsidiary.id,
        department_tag_id: departmentTagId,
      }),
    ]);
    const spendLimitCents = buffered.buffered_amount;

    const approvers = policy.approval_policy.map(a => ({ type: a.type, value: a.value.id }));
    const watchers = policy.watchers.map(w => ({ type: w.type, value: w.value.id }));

    const glLineItems: { account_id: number; split_percentage: number; entry_type: string; tags: number[] }[] = [];
    if (params.category_id) {
      glLineItems.push({
        account_id: params.category_id,
        split_percentage: 10000,
        entry_type: 'expense',
        tags: departmentTagId ? [departmentTagId] : [],
      });
    }

    const created = await airbasePost<CreatedRequest>('/service/request/', {
      buffer_amount: '0',
      primary_currency_code: currency,
      service: service.id,
      primary_amount: String(params.amount),
      request_type: 'new',
      spend_limit_window: 'month',
      spend_limit: spendLimitCents / 100,
      subsidiary: subsidiary.id,
      transaction_tags: [],
      manager: approvers[0]?.value,
      watcherIds: watchers.map(w => w.value),
      watchers,
      cost: params.amount,
      primary_amount_fx_rate: 1,
      description: params.description ?? '',
      is_one_time_payment: !params.is_recurring,
      approvers,
      gl_data: { line_items: glLineItems, transaction_tags: [] },
    });

    return {
      request_id: created.id,
      status: created.status,
      vendor_name: service.name,
      amount: params.amount,
      spend_limit: spendLimitCents / 100,
      buffer_percentage: buffered.buffer_percentage,
      pending_on: created.pending_on?.full_name ?? null,
      approvers: policy.approval_policy.map(a => `${a.value.first_name} ${a.value.last_name}`),
    };
  },
});
