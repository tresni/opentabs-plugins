import { z } from 'zod';
import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { airbaseGet, airbasePost, extractBulkItems, formatCents, getDefaultDepartmentTag } from '../lib/api.js';

interface BulkAddResponse {
  expense_report_items: {
    id: number;
    trip: {
      id: number;
      policy: { id: number; distance_unit: string; cost_basic_per_unit: number; cost_per_unit: number };
    };
  }[];
}

interface BulkUpdateResponse {
  expense_report_items: {
    id: number;
    payout_amount: number;
    payout_amount_basic: number;
    cost_cents: number;
    trip: { id: number; distance: number; distance_meters: number };
  }[];
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
}

// Use Google Maps services loaded in the Airbase page to resolve addresses
async function resolvePlace(query: string): Promise<PlaceResult> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error -- google.maps is loaded in the Airbase page
    const autocomplete = new google.maps.places.AutocompleteService();
    autocomplete.getPlacePredictions({ input: query }, (predictions: unknown[], status: string) => {
      if (status !== 'OK' || !predictions?.length) {
        reject(new Error(`No place found for "${query}"`));
        return;
      }
      const prediction = predictions[0] as { place_id: string; description: string };

      // @ts-expect-error -- google.maps is loaded in the Airbase page
      const placesService = new google.maps.places.PlacesService(document.createElement('div'));
      placesService.getDetails(
        { placeId: prediction.place_id, fields: ['geometry', 'name', 'formatted_address'] },
        (
          place: {
            name: string;
            formatted_address: string;
            geometry: { location: { lat: () => number; lng: () => number } };
          } | null,
          detailStatus: string,
        ) => {
          if (detailStatus !== 'OK' || !place) {
            reject(new Error(`Could not get details for place "${query}"`));
            return;
          }
          resolve({
            place_id: prediction.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
        },
      );
    });
  });
}

async function getRouteDistance(
  originPlaceId: string,
  destPlaceId: string,
): Promise<{ distance_meters: number; distance_miles: number }> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error -- google.maps is loaded in the Airbase page
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: { placeId: originPlaceId },
        destination: { placeId: destPlaceId },
        // @ts-expect-error -- google.maps is loaded in the Airbase page
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: { routes: { legs: { distance: { value: number } }[] }[] } | null, status: string) => {
        if (status !== 'OK' || !result?.routes?.[0]?.legs?.[0]) {
          reject(new Error('Could not calculate route'));
          return;
        }
        const meters = result.routes[0].legs[0].distance.value;
        resolve({ distance_meters: meters, distance_miles: meters / 1609.344 });
      },
    );
  });
}

export const addMileageExpense = defineTool({
  name: 'add_mileage_expense',
  displayName: 'Add Mileage Expense',
  description:
    'Add a mileage expense to a draft expense report. Provide origin and destination addresses — the route distance and reimbursement amount are calculated automatically based on company mileage policy. Use get_expense_report to find the report ID.',
  icon: 'map-pin',
  group: 'Expenses',
  input: z.object({
    report_id: z.number().int().describe('The expense report ID'),
    origin: z.string().min(1).describe('Origin address (e.g. "123 Main St, Boise, ID")'),
    destination: z.string().min(1).describe('Destination address (e.g. "Boise Airport")'),
    date: z.string().describe('Trip date in YYYY-MM-DD format'),
    is_round_trip: z.boolean().optional().describe('Whether this is a round trip (default: false)'),
    purpose: z.string().optional().describe('Purpose of the trip'),
    category_id: z.number().optional().describe('GL expense category ID'),
    department_tag_id: z.number().optional().describe('Department tag ID'),
  }),
  output: z.object({
    expense_id: z.number().describe('Created expense item ID'),
    origin: z.string().describe('Resolved origin address'),
    destination: z.string().describe('Resolved destination address'),
    distance: z.string().describe('Trip distance'),
    amount: z.string().describe('Reimbursement amount'),
    rate: z.string().describe('Mileage rate'),
    is_round_trip: z.boolean().describe('Whether round trip'),
  }),
  handle: async params => {
    const isRoundTrip = params.is_round_trip ?? false;

    const [addResult, originPlace, destPlace, defaultDeptTag, subsidiaries] = await Promise.all([
      airbasePost<BulkAddResponse>(`/service/expense_report/${params.report_id}/bulk_add/`, {
        items: [{ reimbursement_type: 'mileage' }],
      }),
      resolvePlace(params.origin),
      resolvePlace(params.destination),
      params.department_tag_id ? Promise.resolve(params.department_tag_id) : getDefaultDepartmentTag(),
      airbaseGet<{ results: { id: number }[] }>('/customer/subsidiary/list_with_spend_types/', {
        access_type: 'all',
        page_size: 1,
      }),
    ]);

    const addItems = extractBulkItems<BulkAddResponse['expense_report_items'][number]>(addResult);
    const newItem = addItems[addItems.length - 1];
    if (!newItem?.trip) throw ToolError.internal('Failed to create mileage expense');
    const subsidiary = subsidiaries.results[0]?.id;
    if (!subsidiary) throw ToolError.internal('No subsidiary found');

    const policy = newItem.trip.policy;
    const route = await getRouteDistance(originPlace.place_id, destPlace.place_id);

    let totalMiles = route.distance_miles;
    let totalMeters = route.distance_meters;
    if (isRoundTrip) {
      totalMiles *= 2;
      totalMeters *= 2;
    }
    const roundedMiles = Math.round(totalMiles * 10) / 10;
    const costDollars = roundedMiles * policy.cost_per_unit;
    const costCents = Math.round(costDollars * 100);

    const glLineTags = defaultDeptTag ? [defaultDeptTag] : [];

    await airbasePost<BulkUpdateResponse>(`/service/expense_report/${params.report_id}/bulk_update/`, {
      items: [
        {
          reimbursement_type: 'mileage',
          id: newItem.id,
          transaction_date: params.date,
          gl_category: params.category_id ?? null,
          gl_line_tags: glLineTags,
          purpose: params.purpose ?? '',
          cost: costDollars,
          payout_amount: costDollars,
          payout_amount_basic: costCents,
          cost_cents: costCents,
          subsidiary_amount: costDollars,
          subsidiary_amount_basic: costCents,
          payout_usd_fx_rate: 1,
          payout_subsidiary_fx_rate: 1,
          subsidiary_id: subsidiary,
          payout_currency: 'USD',
          subsidiary_currency: 'USD',
          receipt_currency: null,
          receipt_amount_basic: null,
          receipt_payout_fx_rate: null,
          user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          approvers: [],
          trip: {
            id: newItem.trip.id,
            origin: originPlace,
            destination: destPlace,
            origin_text: null,
            destination_text: null,
            stops: [],
            is_round_trip: isRoundTrip,
            policy,
            distance: roundedMiles,
            distance_meters: Math.round(totalMeters),
            actual_distance: roundedMiles,
            actual_distance_meters: Math.round(totalMeters),
          },
        },
      ],
    });

    return {
      expense_id: newItem.id,
      origin: originPlace.formatted_address,
      destination: destPlace.formatted_address,
      distance: `${roundedMiles} ${policy.distance_unit}${isRoundTrip ? ' (round trip)' : ''}`,
      amount: formatCents(costCents),
      rate: `$${policy.cost_per_unit}/${policy.distance_unit}`,
      is_round_trip: isRoundTrip,
    };
  },
});
