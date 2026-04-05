import { z } from 'zod';
import { defineTool, log, ToolError } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface CardResponse {
  count: number;
  results: {
    id: number;
    state: string;
    last_four: string;
    expiration: string;
    expiration_time: string;
    created_date: string;
    client_access_token: { token: string };
    subscription: {
      id: number;
      vendor: {
        id: number;
        company_given_name: string;
        service: { name: string; logo: string | null; description: string | null };
      };
      owner: { id: number; first_name: string; last_name: string; email: string };
      spend_limit_cents: number;
      spend_limit_window: string;
      average_monthly_spend_cents: number;
      card_total_spend_cents: number | undefined;
      subscription_currency_total_spend_cents: number | undefined;
      card_last_four: string;
      card_first_name: string;
      card_last_name: string;
      lock_status: string;
      is_active: boolean;
      is_business_critical: boolean;
      notes: string;
      purchase_name: string;
      last_charge_date: string | null;
      card_first_transaction_date: string | null;
      currency: { symbol: string; iso_code: string };
      subsidiary: { id: number; name: string };
    };
    user: {
      first_name: string;
      last_name: string;
      address1: string;
      address2: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
  }[];
}

interface SubscriptionDetail {
  ledger_rule: {
    line_items: {
      account: { id: number; name: string; acct_num: string };
      tags: { id: number; name: string; display_name: string; type: string }[];
      split_percentage: number;
    }[];
  } | null;
}

const accountingLineItemSchema = z.object({
  category_name: z.string().describe('GL account/category name'),
  category_id: z.number().describe('GL account ID'),
  account_number: z.string().describe('GL account number'),
  department: z.string().describe('Department tag (e.g. "G&A > Executive")'),
  department_tag_id: z.number().nullable().describe('Department tag ID'),
  split_percentage: z.number().describe('Percentage allocation'),
});

export const getVirtualCard = defineTool({
  name: 'get_virtual_card',
  displayName: 'Get Virtual Card',
  description:
    'Get detailed information about a specific virtual card including vendor, spend limits, owner, card expiry date, billing address, accounting details, and card state. Use list_virtual_cards first to find card IDs. The response includes a marqeta_reveal_url for retrieving the full card number and CVV — see that field for instructions.',
  icon: 'credit-card',
  group: 'Virtual Cards',
  input: z.object({
    card_id: z.number().int().describe('The virtual card ID (subscription ID from list_virtual_cards)'),
  }),
  output: z.object({
    id: z.number().describe('Card ID'),
    vendor_name: z.string().describe('Vendor name'),
    purchase_name: z.string().describe('Purchase/subscription name'),
    card_last_four: z.string().describe('Last 4 digits'),
    card_name_on_card: z.string().describe('Name on the card'),
    card_state: z.string().describe('Card state (active, terminated, suspended)'),
    expiration: z.string().describe('Card expiry in MM/YY format'),
    expiration_time: z.string().describe('Full expiry timestamp'),
    owner_name: z.string().describe('Card owner name'),
    owner_email: z.string().describe('Card owner email'),
    spend_limit: z.string().describe('Spend limit per period'),
    spend_limit_window: z.string().describe('Spend limit period'),
    average_monthly_spend: z.string().describe('Average monthly spend'),
    total_spend: z.string().describe('Total lifetime spend'),
    lock_status: z.string().describe('Lock status'),
    is_active: z.boolean().describe('Whether card is active'),
    is_business_critical: z.boolean().describe('Whether marked as business critical'),
    notes: z.string().describe('Card notes'),
    subsidiary: z.string().describe('Subsidiary name'),
    created_date: z.string().describe('Date card was created'),
    last_charge_date: z.string().nullable().describe('Date of last charge'),
    first_transaction_date: z.string().nullable().describe('Date of first transaction'),
    currency: z.string().describe('Currency ISO code'),
    billing_address: z.string().describe('Billing address on the card'),
    accounting: z.array(accountingLineItemSchema).describe('GL accounting line items (category, department, split)'),
    marqeta_reveal_url: z
      .string()
      .describe(
        'Short-lived URL (~5 min) that returns full card PAN and CVV as JSON. IMPORTANT: Only use this when the user explicitly asks for the full card number or CVV. MUST be fetched from the widgets.marqeta.com origin due to same-origin policy. Steps: (1) browser_open_tab to https://widgets.marqeta.com/marqetajs/1.1.0/panframe.html (2) browser_execute_script in that tab: fetch this URL then parse JSON for {pan, cvv_number, expiration} (3) browser_close_tab.',
      ),
  }),
  handle: async params => {
    const [cardData, subDetail] = await Promise.all([
      airbaseGet<CardResponse>('/money/card/', {
        subscription: params.card_id,
        primary: true,
      }),
      airbaseGet<SubscriptionDetail>(`/service/subscription/${params.card_id}/`).catch(err => {
        log.warn('Failed to fetch subscription detail for accounting info', { error: String(err) });
        return null;
      }),
    ]);

    const card = cardData.results[0];
    if (!card) throw ToolError.notFound(`Card not found for subscription ${params.card_id}`);
    const sub = card.subscription;
    const sym = sub.currency?.symbol ?? '$';
    const exp = card.expiration;
    const expirationFormatted = exp ? `${exp.slice(0, 2)}/${exp.slice(2)}` : '';
    const addr = card.user;
    const addressParts = [
      addr.address1,
      addr.address2,
      `${addr.city}, ${addr.state} ${addr.zip_code}`,
      addr.country,
    ].filter(Boolean);

    const decoded = JSON.parse(atob(card.client_access_token.token));
    const revealToken = btoa(decoded.token);
    const revealUrl = `${decoded.application.client_api_base_url}/cardpan?client_fingerprint=${revealToken}`;

    const accounting = (subDetail?.ledger_rule?.line_items ?? []).map(li => {
      const deptTag = li.tags?.find(t => t.type === 'department');
      return {
        category_name: li.account?.name ?? '',
        category_id: li.account?.id ?? 0,
        account_number: li.account?.acct_num ?? '',
        department: deptTag?.display_name ?? '',
        department_tag_id: deptTag?.id ?? null,
        split_percentage: li.split_percentage ?? 100,
      };
    });

    return {
      id: sub.id,
      vendor_name: sub.vendor.company_given_name,
      purchase_name: sub.purchase_name,
      card_last_four: card.last_four,
      card_name_on_card: `${sub.card_first_name} ${sub.card_last_name}`.trim(),
      card_state: card.state,
      expiration: expirationFormatted,
      expiration_time: card.expiration_time,
      owner_name: `${sub.owner.first_name} ${sub.owner.last_name}`.trim(),
      owner_email: sub.owner.email,
      spend_limit: formatCents(sub.spend_limit_cents, sym),
      spend_limit_window: sub.spend_limit_window,
      average_monthly_spend: formatCents(sub.average_monthly_spend_cents, sym),
      total_spend: formatCents(sub.card_total_spend_cents ?? sub.subscription_currency_total_spend_cents ?? 0, sym),
      lock_status: sub.lock_status,
      is_active: sub.is_active,
      is_business_critical: sub.is_business_critical,
      notes: sub.notes ?? '',
      subsidiary: sub.subsidiary?.name ?? '',
      created_date: card.created_date,
      last_charge_date: sub.last_charge_date,
      first_transaction_date: sub.card_first_transaction_date,
      currency: sub.currency?.iso_code ?? 'USD',
      billing_address: addressParts.join(', '),
      accounting,
      marqeta_reveal_url: revealUrl,
    };
  },
});
