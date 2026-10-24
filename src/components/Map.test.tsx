import type { ReactNode } from 'react';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Map from './Map';
import { deferred, jsonResponse, liveResult, partialResult, sampleRoute } from '../test/routeFixtures';

// Simulate Leaflet's immutable GeoJSON data: updates require a new component key.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pane: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GeoJSON: ({ data }: { data: unknown }) => {
    const [initial] = useState(data);
    return <div data-testid="route-line">{JSON.stringify(initial)}</div>;
  },
}));

vi.mock('./MapClickHandler', () => ({
  default: ({ setFrom, setTo }: { setFrom: (p: [number, number]) => void; setTo: (p: [number, number]) => void }) => (
    <>
      <button onClick={() => setFrom([24.94, 60.17])}>Select A</button>
      <button onClick={() => setTo([24.96, 60.20])}>Select B</button>
      <button onClick={() => setTo([24.97, 60.21])}>Change B</button>
    </>
  ),
}));

beforeEach(() => { vi.stubEnv('VITE_USE_SAMPLE', '0'); vi.stubEnv('VITE_API_BASE', 'http://localhost:8000'); });
const selectRoute = () => {
  fireEvent.click(screen.getByText('Select A'));
  fireEvent.click(screen.getByText('Select B'));
};

it('shows loading then line and metrics without depending on a surface chart', async () => {
  const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  render(<Map />);
  expect(screen.getByRole('status').textContent).toBe('Click to select point A');
  selectRoute();
  expect(screen.getByRole('status').textContent).toBe('Finding route…');
  expect(screen.queryByTestId('route-line')).toBeNull();
  await act(async () => { pending.resolve(jsonResponse(liveResult())); });
  expect(screen.getByText('Distance: 1.20 km')).toBeTruthy();
  expect(screen.getByText('Time: 7 min')).toBeTruthy();
  expect(screen.getByTestId('route-line')).toBeTruthy();
});

it('keeps route and metrics on partial and explains missing surface', async () => {
  const logWarning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(partialResult())));
  render(<Map />); selectRoute();
  expect(await screen.findByText('Distance: 1.20 km')).toBeTruthy();
  expect(screen.getByText(/Surface coverage unavailable/).textContent).toContain('Surface data is missing.');
  expect(screen.getByTestId('route-line')).toBeTruthy();
  expect(logWarning).toHaveBeenCalledWith('[route] Surface unavailable', {
    code: 'surface_unavailable', message: 'Surface data is missing.',
  });
});

it('clears a previous route on failure and supports an explicit retry', async () => {
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(liveResult()))
    .mockResolvedValueOnce(jsonResponse({ status: 'error', mode: 'live', route: null, surface: null,
      error: { code: 'ors_timeout', message: 'Routing timed out.' } }, 504))
    .mockResolvedValueOnce(jsonResponse(liveResult(2400)));
  vi.stubGlobal('fetch', fetch);
  render(<Map />); selectRoute();
  await screen.findByText('Distance: 1.20 km');
  fireEvent.click(screen.getByText('Change B'));
  expect((await screen.findByRole('alert')).textContent).toBe('Routing timed out.');
  expect(logError).toHaveBeenCalledWith('[route] Request failed', {
    code: 'ors_timeout', message: 'Routing timed out.',
  });
  expect(screen.queryByTestId('route-line')).toBeNull();
  expect(screen.queryByLabelText('Route details')).toBeNull();
  fireEvent.click(screen.getByText('Try again'));
  expect(await screen.findByText('Distance: 2.40 km')).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.every(([url]) => url === 'http://localhost:8000/api/v1/route')).toBe(true);
});

it('displays the next geometry instead of Leaflet retaining its previous data', async () => {
  const second = liveResult(2400); second.route.geometry.coordinates[1] = [24.97, 60.21];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(liveResult())).mockResolvedValueOnce(jsonResponse(second)));
  render(<Map />); selectRoute();
  await screen.findByText('Distance: 1.20 km');
  fireEvent.click(screen.getByText('Change B'));
  await screen.findByText('Distance: 2.40 km');
  expect(screen.getByTestId('route-line').textContent).toContain('24.97');
});

it('Reset clears the UI and a late response cannot restore it', async () => {
  const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  render(<Map />); selectRoute();
  fireEvent.click(screen.getByText('Reset route'));
  await act(async () => { pending.resolve(jsonResponse(liveResult())); });
  expect(screen.getByRole('status').textContent).toBe('Click to select point A');
  expect(screen.queryByTestId('route-line')).toBeNull();
  expect(screen.queryByLabelText('Route details')).toBeNull();
});

it('marks demo mode and hides absent sample metrics without live requests', async () => {
  vi.stubEnv('VITE_USE_SAMPLE', '1');
  const fetch = vi.fn().mockResolvedValue(jsonResponse(sampleRoute)); vi.stubGlobal('fetch', fetch);
  render(<Map />); selectRoute();
  await screen.findByTestId('route-line');
  expect(screen.queryByLabelText('Route details')).toBeNull();
  expect(screen.getByText('Demo · fixed route')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Route is shown. Reset to select new points.');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/sample-route.json');
});

it('shows a sample loading error instead of claiming the route is shown', async () => {
  vi.stubEnv('VITE_USE_SAMPLE', '1');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
  render(<Map />); selectRoute();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('demo route could not be loaded'));
  expect(screen.queryByTestId('route-line')).toBeNull();
});
