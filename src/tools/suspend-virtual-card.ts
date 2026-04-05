import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePatch } from '../lib/api.js';

interface PatchResponse {
  id: number;
  vendor: { company_given_name: string };
  is_active: boolean;
}

export const suspendVirtualCard = defineTool({
  name: 'suspend_virtual_card',
  displayName: 'Suspend Virtual Card',
  description:
    'Permanently suspend a virtual card. This disables the card so the vendor can no longer charge it. WARNING: This action cannot be undone — the vendor may cancel your account or remove access. Always confirm with the user before calling this tool. Use list_virtual_cards to find card IDs.',
  icon: 'ban',
  group: 'Virtual Cards',
  input: z.object({
    card_id: z.number().int().describe('The virtual card ID (subscription ID from list_virtual_cards)'),
  }),
  output: z.object({
    id: z.number().describe('Card ID'),
    vendor_name: z.string().describe('Vendor name'),
    is_active: z.boolean().describe('Whether card is still active (should be false after suspend)'),
  }),
  handle: async params => {
    const data = await airbasePatch<PatchResponse>(`/service/subscription/${params.card_id}/`, { is_active: false });
    return {
      id: data.id,
      vendor_name: data.vendor.company_given_name,
      is_active: data.is_active,
    };
  },
});
