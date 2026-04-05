import { z } from 'zod';
import { defineTool } from '@opentabs-dev/plugin-sdk';
import { airbaseGet } from '../lib/api.js';

interface CompanyVendorResult {
  id: number;
  company_given_name: string;
  service: { id: number; name: string; logo: string | null } | null;
  state_type: string;
  preferred_payment_method: string;
  is_active: boolean;
}

interface CompanyVendorResponse {
  count: number;
  results: CompanyVendorResult[];
}

interface ServiceSearchResult {
  id: number;
  name: string;
  logo: string | null;
  website: string | null;
  usage_count: number;
  is_company_specific: boolean;
  company_specific_details: { vendor_id: number; company_given_name: string; state_type: string } | null;
}

interface ServiceSearchResponse {
  count: number;
  results: ServiceSearchResult[];
}

export const searchVendors = defineTool({
  name: 'search_vendors',
  displayName: 'Search Vendors',
  description:
    "Search for vendors by name. Searches both your company's vendors and the global Airbase vendor catalog. Company vendors have a vendor_id; global catalog entries have a service_id which can be used when creating virtual card requests. If a vendor exists in the global catalog but not in your company, create_virtual_card_request will add it automatically.",
  icon: 'search',
  group: 'Vendors',
  input: z.object({
    query: z.string().min(1).describe('Vendor name to search for (partial match supported)'),
  }),
  output: z.object({
    company_vendors: z.array(
      z.object({
        vendor_id: z.number().describe('Company vendor ID'),
        name: z.string().describe('Vendor name'),
        service_id: z.number().nullable().describe('Global service ID'),
        status: z.string().describe('Vendor status (active, inactive)'),
        payment_method: z.string().describe('Preferred payment method'),
      }),
    ),
    catalog_vendors: z.array(
      z.object({
        service_id: z.number().describe('Global service/catalog ID (use for card requests)'),
        name: z.string().describe('Vendor name'),
        website: z.string().nullable().describe('Vendor website'),
        usage_count: z.number().describe('Number of companies using this vendor'),
        already_added: z.boolean().describe('Whether this vendor is already in your company'),
      }),
    ),
  }),
  handle: async params => {
    const [companyResults, catalogResults] = await Promise.all([
      airbaseGet<CompanyVendorResponse>('/service/vendor/', { name: params.query, page_size: 10 }),
      airbaseGet<ServiceSearchResponse>('/service/service/', { name: params.query, page_size: 10 }),
    ]);

    return {
      company_vendors: companyResults.results.map(v => ({
        vendor_id: v.id,
        name: v.company_given_name,
        service_id: v.service?.id ?? null,
        status: v.state_type ?? (v.is_active ? 'active' : 'inactive'),
        payment_method: v.preferred_payment_method ?? '',
      })),
      catalog_vendors: catalogResults.results.map(s => ({
        service_id: s.id,
        name: s.name,
        website: s.website,
        usage_count: s.usage_count,
        already_added: s.is_company_specific || s.company_specific_details != null,
      })),
    };
  },
});
