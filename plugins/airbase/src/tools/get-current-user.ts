import { z } from 'zod';
import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { airbaseGet } from '../lib/api.js';

interface UserResponse {
  results: {
    id: number;
    email: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    company: number;
    member_of_companies: {
      id: number;
      name: string;
      display_name: string;
    }[];
  }[];
}

export const getCurrentUser = defineTool({
  name: 'get_current_user',
  displayName: 'Get Current User',
  description:
    "Get the current authenticated user's profile including name, email, and company. Useful for understanding who is logged in and their company context.",
  icon: 'user',
  group: 'Account',
  input: z.object({}),
  output: z.object({
    id: z.number().describe('User ID'),
    email: z.string().describe('User email address'),
    first_name: z.string().describe('First name'),
    last_name: z.string().describe('Last name'),
    company_id: z.number().describe('Company ID'),
    company_name: z.string().describe('Company name'),
  }),
  handle: async () => {
    const data = await airbaseGet<UserResponse>('/customer/user/');
    const [user] = data.results;
    if (!user) throw ToolError.internal('No user data returned');
    const company = user.member_of_companies.find(c => c.id === user.company);
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      company_id: user.company,
      company_name: company?.display_name ?? company?.name ?? 'Unknown',
    };
  },
});
