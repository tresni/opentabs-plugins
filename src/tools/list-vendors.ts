import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, formatCents } from '../lib/api.js';

interface VendorListResponse {
  count: number;
  page: number;
  page_size: number;
  next: string | null;
  results: {
    id: number;
    company_given_name: string;
    service: { id: number; name: string; logo: string | null } | null;
    average_monthly_spend_cents: number | null;
    is_international: boolean;
    is_active: boolean;
    state_type: string;
    preferred_payment_method: string;
    payment_terms: string;
    created_date: string;
  }[];
}

export const listVendors = defineTool({
  name: 'list_vendors',
  displayName: 'List Vendors',
  description:
    "List your company's vendors. Can filter by status (active, inactive, pending). Returns vendor name, service ID (for card requests), payment method, and average monthly spend.",
  icon: 'building-2',
  group: 'Vendors',
  input: z.object({
    state: z
      .enum(['active', 'inactive', 'pending_approval'])
      .optional()
      .describe('Vendor status filter (default: active)'),
    page: z.number().int().min(1).optional().describe('Page number (default 1)'),
    page_size: z.number().int().min(1).max(100).optional().describe('Results per page (default 50)'),
  }),
  output: z.object({
    vendors: z.array(
      z.object({
        vendor_id: z.number().describe('Company vendor ID'),
        name: z.string().describe('Vendor name'),
        service_id: z.number().nullable().describe('Global service ID (use for card requests)'),
        average_monthly_spend: z.string().describe('Average monthly spend'),
        payment_method: z.string().describe('Preferred payment method'),
        payment_terms: z.string().describe('Payment terms'),
        is_international: z.boolean().describe('Whether vendor is international'),
      }),
    ),
    total_count: z.number().describe('Total number of matching vendors'),
    has_next: z.boolean().describe('Whether more pages exist'),
    page: z.number().describe('Current page number'),
  }),
  handle: async params => {
    const data = await airbaseGet<VendorListResponse>('/service/vendor/', {
      state_type: params.state ?? 'active',
      page: params.page ?? 1,
      page_size: params.page_size ?? 50,
    });

    return {
      vendors: data.results.map(v => ({
        vendor_id: v.id,
        name: v.company_given_name,
        service_id: v.service?.id ?? null,
        average_monthly_spend: formatCents(v.average_monthly_spend_cents ?? 0),
        payment_method: v.preferred_payment_method ?? '',
        payment_terms: v.payment_terms ?? '',
        is_international: v.is_international,
      })),
      total_count: data.count,
      has_next: data.next != null,
      page: data.page,
    };
  },
});
