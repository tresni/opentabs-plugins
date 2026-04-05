import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseUpload } from '../lib/api.js';

export const uploadReceipt = defineTool({
  name: 'upload_receipt',
  displayName: 'Upload Receipt',
  description:
    'Upload a receipt to the receipt inbox. The file must be provided as base64-encoded data. Supported formats: PDF, JPEG, JPG, PNG, HTML. Max size 25MB. After uploading, use attach_receipt to link it to an expense on an expense report.',
  icon: 'upload',
  group: 'Receipts',
  input: z.object({
    file_name: z.string().min(1).describe('File name including extension (e.g. "receipt.pdf", "lunch.jpg")'),
    file_data: z.string().min(1).describe('Base64-encoded file content'),
  }),
  output: z.object({
    receipt_id: z.number().describe('Created receipt ID (use with attach_receipt)'),
    file_name: z.string().describe('Uploaded file name'),
  }),
  handle: async params => {
    const ext = params.file_name.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      html: 'text/html',
    };
    const mimeType = mimeTypes[ext] ?? 'application/octet-stream';

    const binaryStr = atob(params.file_data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const formData = new FormData();
    formData.append('upload', new Blob([bytes], { type: mimeType }), params.file_name);
    formData.append('source', 'web_er_drag_and_drop');

    const receipt = await airbaseUpload<{ id: number; name: string }>('/money/received_receipts/', formData);

    return {
      receipt_id: receipt.id,
      file_name: receipt.name,
    };
  },
});
