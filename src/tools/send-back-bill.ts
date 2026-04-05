import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

export const sendBackBill = defineTool({
  name: 'send_back_bill',
  displayName: 'Send Back Bill',
  description:
    'Send a bill back to the submitter for corrections. Use get_bill to find the bill ID. Optionally include a note explaining what needs to be fixed.',
  icon: 'corner-up-left',
  group: 'Bill Payments',
  input: z.object({
    bill_id: z.number().int().describe('The bill ID to send back'),
    notes: z.string().optional().describe('Notes explaining why the bill is being sent back'),
  }),
  output: z.object({
    sent_back: z.boolean().describe('Whether the bill was sent back'),
    bill_id: z.number().describe('The bill ID'),
  }),
  handle: async params => {
    await airbasePost(`/service/bill/${params.bill_id}/send_back/`, {
      send_back_notes: params.notes ?? null,
    });

    return {
      sent_back: true,
      bill_id: params.bill_id,
    };
  },
});
