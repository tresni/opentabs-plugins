import { z } from 'zod';
import { defineTool, fetchJSON, ToolError } from '@opentabs-dev/plugin-sdk';
import { JPMC_HEADERS } from '../lib/constants.js';

const MAX_PAGES = 20; // safety cap (~1000 transactions at 50/page)

// Chase API response shape
const ChaseEnrichedMerchantSchema = z.object({
  merchantName: z.string().optional(),
});

const ChaseRawMerchantSchema = z.object({
  merchantDbaName: z.string().optional(),
});

const ChaseMerchantDetailsSchema = z.object({
  enrichedMerchants: z.array(ChaseEnrichedMerchantSchema).optional(),
  rawMerchantDetails: ChaseRawMerchantSchema.optional(),
});

const ChaseActivitySchema = z.object({
  transactionDate: z.string(),
  transactionAmount: z.number(),
  transactionStatusCode: z.string().optional(),
  etuStandardTransactionTypeName: z.string().optional(),
  etuStandardExpenseCategoryCode: z.string().optional(),
  merchantDetails: ChaseMerchantDetailsSchema.optional(),
});

const ChaseTransactionsResponseSchema = z.object({
  activities: z.array(ChaseActivitySchema),
  moreTransactionsIndicator: z.boolean().optional(),
  totalPostedTransactionCount: z.number().optional(),
  lastSortFieldValueText: z.string().optional(),
  paginationContextualText: z.string().optional(),
});

// Tool output shape
const TransactionSchema = z.object({
  date: z.string().describe('Transaction date in YYYY-MM-DD format'),
  amount: z.number().describe('Transaction amount — negative means a credit/refund'),
  merchant: z.string().describe('Merchant name'),
  status: z.string().describe('Transaction status: "Pending" or "Posted"'),
  type: z.string().describe('Transaction type, e.g. "PURCHASE", "RETURN", "PAYMENT"'),
  category: z.string().describe('Expense category, e.g. "SHOP", "FOOD", "TRAVEL"'),
});

function toTransaction(t: z.infer<typeof ChaseActivitySchema>) {
  const enriched = t.merchantDetails?.enrichedMerchants?.[0];
  const merchant =
    enriched?.merchantName ??
    t.merchantDetails?.rawMerchantDetails?.merchantDbaName ??
    'Unknown';
  return {
    date: t.transactionDate,
    amount: t.transactionAmount,
    merchant,
    status: t.transactionStatusCode ?? '',
    type: t.etuStandardTransactionTypeName ?? '',
    category: t.etuStandardExpenseCategoryCode ?? '',
  };
}

export const listTransactions = defineTool({
  name: 'list_transactions',
  displayName: 'List Transactions',
  description:
    'List credit card transactions for a Chase account. Use list_accounts first to get account IDs. ' +
    'Provide startDate and endDate (YYYY-MM-DD) to fetch all transactions in a date range with automatic pagination. ' +
    'Without dates, returns the most recent transactions up to count.',
  icon: 'list',
  input: z.object({
    accountId: z.number().describe('Account ID from list_accounts'),
    startDate: z
      .string()
      .optional()
      .describe('Start date in YYYY-MM-DD format. When provided, fetches all transactions in the range.'),
    endDate: z
      .string()
      .optional()
      .describe('End date in YYYY-MM-DD format. Required when startDate is provided.'),
    count: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Transactions per page when no date range is given (default 50, max 200)'),
  }),
  output: z.object({
    transactions: z.array(TransactionSchema).describe('Transactions, newest first'),
    hasMore: z
      .boolean()
      .describe('Whether more transactions exist beyond the result. Always false when a date range is used.'),
    totalPosted: z.number().describe('Total posted transaction count on the account'),
  }),
  handle: async (params) => {
    const base: Record<string, string> = {
      'digital-account-identifier': String(params.accountId),
      'provide-available-statement-indicator': 'true',
      'sort-order-code': 'D',
      'sort-key-code': 'T',
    };

    const url =
      '/svc/rr/accounts/secure/gateway/credit-card/transactions/inquiry-maintenance/etu-transactions/v4/accounts/transactions';

    const fetchPage = async (extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams({ ...base, ...extra });
      return fetchJSON(`${url}?${qs}`, { headers: JPMC_HEADERS }, ChaseTransactionsResponseSchema);
    };

    if (params.startDate == null || params.endDate == null) {
      // Single page — no auto-pagination
      base['record-count'] = String(params.count ?? 50);
      const data = await fetchPage();
      if (!data) throw ToolError.internal('Unexpected response from Chase transactions API');
      return {
        transactions: data.activities.map(toTransaction),
        hasMore: data.moreTransactionsIndicator ?? false,
        totalPosted: data.totalPostedTransactionCount ?? 0,
      };
    }

    // Date range — auto-paginate until done
    base['account-activity-start-date'] = params.startDate;
    base['account-activity-end-date'] = params.endDate;
    base['request-type-code'] = 'T';
    base['record-count'] = '100'; // max per page for date-range queries

    const all: z.infer<typeof TransactionSchema>[] = [];
    let totalPosted = 0;
    let cursor: Record<string, string> = {};

    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await fetchPage(cursor);
      if (!data) throw ToolError.internal('Unexpected response from Chase transactions API');

      all.push(...data.activities.map(toTransaction));
      totalPosted = data.totalPostedTransactionCount ?? totalPosted;

      if (
        !data.moreTransactionsIndicator ||
        !data.lastSortFieldValueText ||
        !data.paginationContextualText
      ) {
        break;
      }

      cursor = {
        'last-sort-field-value-text': data.lastSortFieldValueText,
        'pagination-contextual-text': data.paginationContextualText,
      };
    }

    return {
      transactions: all,
      hasMore: false,
      totalPosted,
    };
  },
});
