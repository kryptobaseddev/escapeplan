import type { PageServerLoad } from './$types';
import type { GetAlertRulesResponse } from '@escapeplan/contracts';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch('/api/admin/alert-rules');
    if (!response.ok) {
      return { rules: [], error: `Failed to load alert rules: ${response.statusText}` };
    }
    const data: GetAlertRulesResponse = await response.json();
    return { rules: data.rules };
  } catch (error) {
    console.error('Failed to load alert rules', error);
    return { rules: [], error: 'Failed to load alert rules' };
  }
};
