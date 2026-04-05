import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet } from '../lib/api.js';

interface ReceiptsResponse {
  count: number;
  page: number;
  page_size: number;
  next: string | null;
  results: {
    id: number;
    name: string;
    created_date: string;
    updated_date: string;
    source: string;
  }[];
}

export const listPendingReceipts = defineTool({
  name: 'list_pending_receipts',
  displayName: 'List Pending Receipts',
  description:
    'List receipts in your inbox that are waiting to be matched to a card transaction or added to an expense report. Shows receipt name, upload date, and total count of pending receipts.',
  icon: 'image',
  group: 'Receipts',
  input: z.object({
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(100).optional().describe('Results per page (default 40)'),
  }),
  output: z.object({
    receipts: z.array(
      z.object({
        id: z.number().describe('Receipt ID'),
        name: z.string().describe('Receipt filename'),
        created_date: z.string().describe('Upload date'),
      }),
    ),
    total_count: z.number().describe('Total number of pending receipts'),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const data = await airbaseGet<ReceiptsResponse>('/money/received_receipts/v2/pending/', {
      page_size: params.page_size ?? 40,
      page: params.page ?? 1,
    });

    return {
      receipts: data.results.map(r => ({
        id: r.id,
        name: r.name,
        created_date: r.created_date,
      })),
      total_count: data.count,
      has_next: data.next != null,
      page: data.page,
    };
  },
});
