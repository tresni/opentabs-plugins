import { z } from 'zod';
import { defineTool, postForm, ToolError } from '@opentabs-dev/plugin-sdk';
import { JPMC_HEADERS } from '../lib/constants.js';

// Chase API response shape
const ChaseAccountDetailSchema = z.object({
  currentBalance: z.number().optional(),
  availableBalance: z.number().optional(),
  nextPaymentAmount: z.number().optional(),
  nextPaymentDueDate: z.string().optional(),
  closed: z.boolean().optional(),
});

const ChaseAccountSchema = z.object({
  id: z.number(),
  mask: z.string().optional(),
  nickname: z.string().optional(),
  cardType: z.string().optional(),
  groupType: z.string(),
  detail: ChaseAccountDetailSchema.optional(),
});

const ChaseAccountsResponseSchema = z.object({
  code: z.string(),
  accounts: z.array(ChaseAccountSchema).optional(),
});

// Tool output shape
const AccountSchema = z.object({
  id: z.number().describe('Account ID used to fetch transactions'),
  mask: z.string().describe('Last 4 digits of the card'),
  nickname: z.string().describe('Account nickname, e.g. "Sapphire Preferred"'),
  cardType: z.string().describe('Card type, e.g. "CHASE_SAPPHIRE_PREFERRED"'),
  groupType: z.string().describe('Account group type: CARD, DEPOSIT, or LOAN'),
  currentBalance: z.number().describe('Current balance owed'),
  availableCredit: z.number().describe('Available credit remaining'),
  nextPaymentAmount: z.number().nullable().describe('Minimum payment due'),
  nextPaymentDueDate: z.string().nullable().describe('Payment due date in YYYYMMDD format'),
  closed: z.boolean().describe('Whether the account is closed'),
});

export const listAccounts = defineTool({
  name: 'list_accounts',
  displayName: 'List Accounts',
  description:
    'List all Chase accounts with balances and payment info. Returns account IDs needed for list_transactions.',
  icon: 'credit-card',
  input: z.object({}),
  output: z.object({
    accounts: z.array(AccountSchema).describe('All Chase accounts'),
  }),
  handle: async () => {
    const data = await postForm(
      '/svc/rr/accounts/secure/v1/dashboard/overview/accounts/list',
      { context: 'WEB_CPO_OVERVIEW_DASHBOARD', selectorIdType: 'ACCOUNT_GROUP' },
      { headers: JPMC_HEADERS },
      ChaseAccountsResponseSchema,
    );

    if (!data || data.code !== 'SUCCESS') {
      throw ToolError.internal(`Chase API error: ${data?.code}`);
    }

    const accounts = (data.accounts ?? []).map((a) => ({
      id: a.id,
      mask: a.mask ?? '',
      nickname: a.nickname ?? '',
      cardType: a.cardType ?? '',
      groupType: a.groupType,
      currentBalance: a.detail?.currentBalance ?? 0,
      availableCredit: a.detail?.availableBalance ?? 0,
      nextPaymentAmount: a.detail?.nextPaymentAmount ?? null,
      nextPaymentDueDate: a.detail?.nextPaymentDueDate ?? null,
      closed: a.detail?.closed ?? false,
    }));

    return { accounts };
  },
});
