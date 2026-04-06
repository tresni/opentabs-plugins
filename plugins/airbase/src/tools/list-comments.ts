import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet } from '../lib/api.js';

interface CommentNotification {
  id: number;
  is_read: boolean;
  is_mentioned: boolean;
  created_date: string;
  comment: {
    id: number;
    comment: string;
    is_deleted: boolean;
    created_date: string;
    request: number | null;
    bill: number | null;
    expense_report_item: {
      id: number;
      expense_report_id: number;
      vendor_name: string;
    } | null;
    user: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
    };
  };
}

interface CommentListResponse {
  count: number;
  results: CommentNotification[];
}

export const listComments = defineTool({
  name: 'list_comment_notifications',
  displayName: 'List Comment Notifications',
  description:
    'List your comment notifications, optionally filtered to unread only. Shows comments on expense report items, bills, and requests.',
  icon: 'bell',
  group: 'Comments',
  input: z.object({
    unread_only: z.boolean().optional().describe('Only show unread notifications (default: true)'),
  }),
  output: z.object({
    count: z.number().describe('Total number of matching notifications'),
    notifications: z.array(
      z.object({
        id: z.number().describe('Notification ID'),
        is_read: z.boolean().describe('Whether the notification has been read'),
        is_mentioned: z.boolean().describe('Whether you were @mentioned'),
        comment_text: z.string().describe('The comment text'),
        author: z.string().describe('Who wrote the comment'),
        created_date: z.string().describe('When the comment was posted'),
        expense_report_item_id: z.number().nullable().describe('Expense report item ID if applicable'),
        expense_report_id: z.number().nullable().describe('Expense report ID if applicable'),
        vendor_name: z.string().nullable().describe('Vendor name if on an expense item'),
      }),
    ),
  }),
  handle: async params => {
    const unreadOnly = params.unread_only ?? true;
    const queryParams: Record<string, string | number | boolean> = {
      page_size: 25,
    };
    if (unreadOnly) queryParams.is_read = false;

    const data = await airbaseGet<CommentListResponse>('/service/comment_notifications/', queryParams);

    return {
      count: data.count,
      notifications: data.results.map(n => ({
        id: n.id,
        is_read: n.is_read,
        is_mentioned: n.is_mentioned,
        comment_text: n.comment.comment,
        author: `${n.comment.user.first_name} ${n.comment.user.last_name}`,
        created_date: n.comment.created_date,
        expense_report_item_id: n.comment.expense_report_item?.id ?? null,
        expense_report_id: n.comment.expense_report_item?.expense_report_id ?? null,
        vendor_name: n.comment.expense_report_item?.vendor_name ?? null,
      })),
    };
  },
});
