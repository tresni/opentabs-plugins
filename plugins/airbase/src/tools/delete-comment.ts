import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseDelete } from '../lib/api.js';

export const deleteComment = defineTool({
  name: 'delete_comment',
  displayName: 'Delete Comment',
  description:
    'Delete a comment you posted on an expense report item, bill, or request. You can only delete your own comments.',
  icon: 'trash-2',
  group: 'Comments',
  input: z.object({
    comment_id: z.number().int().describe('The comment ID to delete'),
  }),
  output: z.object({
    deleted: z.boolean().describe('Whether the comment was successfully deleted'),
    comment_id: z.number().describe('The deleted comment ID'),
  }),
  handle: async params => {
    await airbaseDelete(`/service/request_comment/${params.comment_id}/`);
    return {
      deleted: true,
      comment_id: params.comment_id,
    };
  },
});
