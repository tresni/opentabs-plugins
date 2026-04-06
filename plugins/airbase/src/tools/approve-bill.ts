import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePatch } from '../lib/api.js';

interface ApproverResult {
  id: number;
  status: string;
}

export const approveBill = defineTool({
  name: 'approve_bill',
  displayName: 'Approve Bill',
  description:
    'Approve a bill that is pending your approval. Use get_bill to find your approver_id from the approvers list (look for your name with status "created").',
  icon: 'check-circle',
  group: 'Bill Payments',
  input: z.object({
    approver_id: z.number().int().describe('Your approver entry ID from get_bill approvers list (not your user ID)'),
  }),
  output: z.object({
    approved: z.boolean().describe('Whether the bill was approved'),
    approver_id: z.number().describe('The approver entry ID'),
  }),
  handle: async params => {
    await airbasePatch<ApproverResult>(`/service/bill_approver/${params.approver_id}/`, {
      status: 'accepted',
    });

    return {
      approved: true,
      approver_id: params.approver_id,
    };
  },
});
