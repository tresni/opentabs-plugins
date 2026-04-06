import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePatch } from '../lib/api.js';

interface PatchResponse {
  id: number;
  vendor: { company_given_name: string };
  lock_status: string;
}

export const lockVirtualCard = defineTool({
  name: 'lock_virtual_card',
  displayName: 'Lock/Unlock Virtual Card',
  description:
    'Temporarily lock or unlock a virtual card. Locking prevents the vendor from charging the card until it is unlocked. Unlike suspending, this is reversible. Confirm with the user before locking.',
  icon: 'lock',
  group: 'Virtual Cards',
  input: z.object({
    card_id: z.number().int().describe('The virtual card ID (subscription ID from list_virtual_cards)'),
    lock: z.boolean().describe('true to lock the card, false to unlock it'),
  }),
  output: z.object({
    id: z.number().describe('Card ID'),
    vendor_name: z.string().describe('Vendor name'),
    lock_status: z.string().describe('New lock status (locked or unlocked)'),
  }),
  handle: async params => {
    const data = await airbasePatch<PatchResponse>(`/service/subscription/${params.card_id}/`, {
      lock_status: params.lock ? 'locked' : 'unlocked',
    });
    return {
      id: data.id,
      vendor_name: data.vendor.company_given_name,
      lock_status: data.lock_status,
    };
  },
});
