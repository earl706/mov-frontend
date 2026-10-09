import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
	get: vi.fn(async (url) => {
		if (String(url).includes('/exercises/')) {
			return {
				results: [
					{
						id: 1,
						name: 'Curl',
						movement_group: 'pull',
						load_type: 'dumbbell',
						track_mode: 'reps',
						per_side: true,
						is_seeded: true,
						default_sets: 3,
						default_reps: 10,
						default_hold_seconds: 0,
						default_load_kg: '10.00',
						default_rest_set_seconds: 90,
						met: '5.00',
						notes: ''
					}
				],
				count: 1
			};
		}
		return {};
	}),
	post: vi.fn(),
	patch: vi.fn(),
	put: vi.fn(),
	del: vi.fn(),
	api: { get: vi.fn(), post: vi.fn() },
	tokenStore: { access: null, refresh: null, set() {}, clear() {} }
}));

vi.mock('../stores/toastStore', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}));

import ExercisesPage from './Exercises.jsx';

function wrap(ui) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<MemoryRouter>{ui}</MemoryRouter>
		</QueryClientProvider>
	);
}

describe('ExercisesPage', () => {
	it('renders catalog', async () => {
		wrap(<ExercisesPage />);
		await waitFor(() => expect(screen.getByText('Curl')).toBeTruthy());
	});
});
