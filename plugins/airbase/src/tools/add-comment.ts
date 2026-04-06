import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbasePost } from '../lib/api.js';

interface CommentResponse {
  id: number;
  comment: string;
  expense_report_item: number | null;
  bill: number | null;
  request: number | null;
  user: { id: number; first_name: string; last_name: string };
  created_date: string;
}

export const addComment = defineTool({
  name: 'add_comment',
  displayName: 'Add Comment',
  description:
    'Add a comment to an expense report item, bill, or request. Use get_expense_report to find expense item IDs.',
  icon: 'message-square',
  group: 'Comments',
  input: z.object({
    comment: z.string().min(1).describe('The comment text'),
    expense_report_item: z.number().int().optional().describe('Expense report item ID to comment on'),
    bill: z.number().int().optional().describe('Bill ID to comment on'),
    request: z.number().int().optional().describe('Request ID to comment on'),
  }),
  output: z.object({
    comment_id: z.number().describe('Created comment ID'),
    comment: z.string().describe('Comment text'),
    created_date: z.string().describe('When the comment was created'),
  }),
  handle: async params => {
    const body: Record<string, unknown> = {
      comment: params.comment,
      notify_req_users: [],
      notify_additional_users: [],
    };

    if (params.expense_report_item) body.expense_report_item = params.expense_report_item;
    if (params.bill) body.bill = params.bill;
    if (params.request) body.request = params.request;

    const result = await airbasePost<CommentResponse>('/service/request_comment/', body);

    return {
      comment_id: result.id,
      comment: result.comment,
      created_date: result.created_date,
    };
  },
});
