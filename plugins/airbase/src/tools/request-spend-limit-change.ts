import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, airbasePost, getApprovalPolicy, getDefaultDepartmentTag } from '../lib/api.js';

interface SubscriptionInfo {
  id: number;
  service: { id: number; name: string };
  vendor: { id: number; company_given_name: string };
  spend_limit_cents: number;
  spend_limit_window: string;
  is_one_time_payment: boolean;
  renewal_frequency_in_months: number;
  subsidiary: { id: number; name: string };
}

interface CreatedRequest {
  id: number;
  status: string;
  pending_on: { full_name: string } | null;
}

export const requestSpendLimitChange = defineTool({
  name: 'request_spend_limit_change',
  displayName: 'Request Spend Limit Change',
  description:
    'Submit a request to change the spend limit on an existing virtual card. The request goes through the approval workflow. Always confirm the new amount with the user before calling this tool. Use get_virtual_card to see the current spend limit.',
  icon: 'trending-up',
  group: 'Virtual Cards',
  input: z.object({
    card_id: z.number().int().describe('The virtual card ID (subscription ID)'),
    new_amount: z.number().positive().describe('New spend limit amount in dollars'),
    is_permanent: z.boolean().optional().describe('true for permanent change (default), false for temporary'),
    notes: z.string().optional().describe('Justification for the change'),
  }),
  output: z.object({
    request_id: z.number().describe('Created request ID'),
    status: z.string().describe('Request status'),
    vendor_name: z.string().describe('Vendor name'),
    current_limit: z.number().describe('Current spend limit in dollars'),
    new_limit: z.number().describe('Requested new spend limit in dollars'),
    pending_on: z.string().nullable().describe('Name of first approver'),
    approvers: z.array(z.string()).describe('List of approver names'),
  }),
  handle: async params => {
    const [sub, departmentTagId] = await Promise.all([
      airbaseGet<SubscriptionInfo>(`/service/subscription/${params.card_id}/`),
      getDefaultDepartmentTag(),
    ]);

    const policy = await getApprovalPolicy({
      type: 'spend_limit_change',
      cost: params.new_amount,
      spend_limit_window: sub.spend_limit_window,
      service_id: sub.service.id,
      subsidiary_id: sub.subsidiary.id,
      department_tag_id: departmentTagId,
    });

    const approvers = policy.approval_policy.map(a => ({ type: a.type, value: a.value.id }));
    const watchers = policy.watchers.map(w => ({ type: w.type, value: w.value.id }));

    const created = await airbasePost<CreatedRequest>('/service/request/', {
      service: sub.service.id,
      change_subscription: params.card_id,
      request_type: 'spend_limit_change',
      is_one_time_payment: sub.is_one_time_payment,
      renewal_frequency_in_months: sub.renewal_frequency_in_months,
      cost: params.new_amount,
      spend_limit: params.new_amount,
      is_permanent: params.is_permanent ?? true,
      spend_limit_window: sub.spend_limit_window,
      approvers,
      watchers,
      ...(params.notes ? { description: params.notes } : {}),
    });

    return {
      request_id: created.id,
      status: created.status,
      vendor_name: sub.vendor.company_given_name,
      current_limit: sub.spend_limit_cents / 100,
      new_limit: params.new_amount,
      pending_on: created.pending_on?.full_name ?? null,
      approvers: policy.approval_policy.map(a => `${a.value.first_name} ${a.value.last_name}`),
    };
  },
});
