import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface TransactionResponse {
  count: number;
  page: number;
  page_size: number;
  next: string | null;
  has_next?: boolean;
  results: {
    id: number;
    description: string;
    current_status: string;
    transaction_created_date: string;
    transaction_currency: { symbol: string; iso_code: string; number_to_basic: number };
    transaction_currency_spent_cents: number;
    transaction_currency_pending_cents: number;
    transaction_currency_settled_cents: number;
    transaction_currency_amount: number;
    ordering_date: string;
    effective_status: string;
    receipt_compliance: { receipt_required: boolean; receipt_attached: boolean } | null;
    ledger_entry: { is_synced: boolean; is_reviewed: boolean } | null;
    receipt: { id: number } | null;
    expense_report: { id: number; name: string } | null;
  }[];
}

export const listCardTransactions = defineTool({
  name: 'list_card_transactions',
  displayName: 'List Card Transactions',
  description:
    'List transactions for a specific virtual card. Shows transaction date, description, amount, status (pending/settled), receipt compliance, and GL sync status. Use list_virtual_cards to find card IDs.',
  icon: 'list',
  group: 'Virtual Cards',
  input: z.object({
    card_id: z.number().int().describe('The virtual card ID (subscription ID from list_virtual_cards)'),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(50).optional().describe('Results per page (default 10)'),
  }),
  output: z.object({
    transactions: z.array(
      z.object({
        id: z.number().describe('Transaction ID'),
        description: z.string().describe('Transaction description (usually merchant name)'),
        amount: z.string().describe('Transaction amount'),
        status: z.string().describe('Transaction status (pending, settled, declined)'),
        date: z.string().describe('Transaction date'),
        receipt_attached: z.boolean().describe('Whether a receipt is attached'),
        receipt_required: z.boolean().describe('Whether a receipt is required'),
        gl_synced: z.boolean().describe('Whether the transaction is synced to GL'),
      }),
    ),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const data = await airbaseGet<TransactionResponse>(`/cards/${params.card_id}/transactions/pending_or_settled/`, {
      page: params.page ?? 1,
      page_size: params.page_size ?? 10,
    });

    return {
      transactions: data.results.map(t => {
        const sym = t.transaction_currency?.symbol ?? '$';
        return {
          id: t.id,
          description: t.description,
          amount: formatCents(t.transaction_currency_spent_cents, sym),
          status: t.effective_status ?? t.current_status,
          date: t.transaction_created_date,
          receipt_attached: t.receipt_compliance?.receipt_attached ?? false,
          receipt_required: t.receipt_compliance?.receipt_required ?? false,
          gl_synced: t.ledger_entry?.is_synced ?? false,
        };
      }),
      has_next: data.has_next ?? data.next != null,
      page: data.page,
    };
  },
});
