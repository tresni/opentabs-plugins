import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface VirtualCardsResponse {
  has_next: boolean;
  page: number;
  page_size: number;
  results: {
    id: number;
    vendor: {
      id: number;
      company_given_name: string;
      service: { name: string; logo: string | null };
    };
    owner: { id: number; first_name: string; last_name: string; email: string };
    spend_limit_cents: number;
    spend_limit_window: string;
    average_monthly_spend_cents: number;
    card_total_spend_cents: number;
    card_last_four: string;
    lock_status: string;
    last_charge_date: string | null;
    is_active: boolean;
    is_one_time_payment: boolean;
    notes: string;
    purchase_name: string;
    created_date: string;
    currency: { symbol: string; iso_code: string };
  }[];
}

const FILTER_PATHS: Record<string, string> = {
  recurring_active: '/cards/virtual/recurring/self/active',
  recurring_suspended: '/cards/virtual/recurring/self/suspended',
  onetime_active: '/cards/virtual/onetime/self/active',
  onetime_suspended: '/cards/virtual/onetime/self/suspended',
};

export const listVirtualCards = defineTool({
  name: 'list_virtual_cards',
  displayName: 'List Virtual Cards',
  description:
    'List your virtual cards with vendor name, spend limits, monthly average spend, and total spend. Filter by type (recurring/one-time) and status (active/suspended). Defaults to active recurring cards.',
  icon: 'credit-card',
  group: 'Virtual Cards',
  input: z.object({
    filter: z
      .enum(['recurring_active', 'recurring_suspended', 'onetime_active', 'onetime_suspended'])
      .optional()
      .describe('Card filter (default: recurring_active)'),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(250).optional().describe('Results per page (default 250)'),
  }),
  output: z.object({
    cards: z.array(
      z.object({
        id: z.number().describe('Card ID'),
        vendor_name: z.string().describe('Vendor name'),
        purchase_name: z.string().describe('Purchase/subscription name'),
        card_last_four: z.string().describe('Last 4 digits of card number'),
        spend_limit: z.string().describe('Spend limit per period'),
        spend_limit_window: z.string().describe('Spend limit period (e.g. month)'),
        average_monthly_spend: z.string().describe('Average monthly spend'),
        total_spend: z.string().describe('Total lifetime spend'),
        lock_status: z.string().describe('Card lock status'),
        last_charge_date: z.string().nullable().describe('Date of last charge'),
        is_active: z.boolean().describe('Whether card is active'),
      }),
    ),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const filter = params.filter ?? 'recurring_active';
    const path = FILTER_PATHS[filter] as string;
    const data = await airbaseGet<VirtualCardsResponse>(path, {
      page_size: params.page_size ?? 250,
      page: params.page ?? 1,
    });

    return {
      cards: data.results.map(card => {
        const sym = card.currency?.symbol ?? '$';
        return {
          id: card.id,
          vendor_name: card.vendor.company_given_name,
          purchase_name: card.purchase_name,
          card_last_four: card.card_last_four,
          spend_limit: formatCents(card.spend_limit_cents, sym),
          spend_limit_window: card.spend_limit_window,
          average_monthly_spend: formatCents(card.average_monthly_spend_cents, sym),
          total_spend: formatCents(card.card_total_spend_cents, sym),
          lock_status: card.lock_status,
          last_charge_date: card.last_charge_date,
          is_active: card.is_active,
        };
      }),
      has_next: data.has_next,
      page: data.page,
    };
  },
});
