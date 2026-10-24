import type { ReactNode } from 'react';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Map from './Map';
import type { Place } from '../types/place';
import { deferred, jsonResponse, liveResult, partialResult, sampleRoute } from '../test/routeFixtures';

// Simulate Leaflet's immutable GeoJSON data: updates require a new component key.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pane: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children, position }: { children: ReactNode; position: [number, number] }) => (
    <div data-testid="map-marker" data-position={JSON.stringify(position)}>{children}</div>
  ),
  Tooltip: ({ children, pane }: { children: ReactNode; pane?: string }) => <div data-pane={pane}>{children}</div>,
  GeoJSON: ({ data }: { data: unknown }) => {
    const [initial] = useState(data);
    return <div data-testid="route-line">{JSON.stringify(initial)}</div>;
  },
  Polyline: ({ children, positions, pathOptions }: { children?: ReactNode; positions: [number, number][]; pathOptions: { className?: string; color?: string; dashArray?: string; weight?: number } }) => (
    <div
      data-testid={pathOptions.className === 'route-halo' ? 'route-halo' : pathOptions.className === 'route-outline' ? 'route-outline' : 'route-line'}
      data-color={pathOptions.color}
      data-dasharray={pathOptions.dashArray}
      data-weight={pathOptions.weight}
      data-positions={JSON.stringify(positions)}
    >
      {children}
    </div>
  ),
}));

vi.mock('./MapClickHandler', () => ({
  default: ({ setFrom, setTo }: { setFrom: (place: Place) => void; setTo: (place: Place) => void }) => (
    <>
      <button onClick={() => setFrom({ coordinates: [24.94, 60.17], label: null })}>Select A</button>
      <button onClick={() => setTo({ coordinates: [24.96, 60.20], label: null })}>Select B</button>
      <button onClick={() => setTo({ coordinates: [24.97, 60.21], label: null })}>Change B</button>
    </>
  ),
}));

beforeEach(() => { vi.stubEnv('VITE_USE_SAMPLE', '0'); vi.stubEnv('VITE_API_BASE', 'http://localhost:8000'); });
const selectRoute = () => {
  fireEvent.click(screen.getByText('Select A'));
  fireEvent.click(screen.getByText('Select B'));
};

it('shows route metrics and the surface chart after a successful live request', async () => {
  const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  render(<Map />);
  expect(screen.getByRole('status').textContent).toBe('Click to select point A');
  expect(screen.getByLabelText('Point A').textContent).toContain('Select point A on the map');
  selectRoute();
  expect(screen.getByRole('status').textContent).toBe('Finding route…');
  expect(screen.queryByTestId('route-line')).toBeNull();
  await act(async () => { pending.resolve(jsonResponse(liveResult())); });
  expect(screen.getByLabelText('Trip summary')).toBeTruthy();
  expect(screen.getByLabelText('Point A').textContent).toContain('Map point');
  expect(screen.getByLabelText('Point B').textContent).toContain('Map point');
  expect(screen.getByLabelText('Route details').textContent).toBe('1.20 km·7 min');
  expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Surface breakdown' })).toBeTruthy();
  expect(screen.getByText('Asphalt')).toBeTruthy();
  expect(screen.getByText('100.0%')).toBeTruthy();
  expect(screen.getByTestId('route-line')).toBeTruthy();
  expect(screen.getByTestId('route-halo')).toBeTruthy();
  expect(screen.getByTestId('route-outline')).toBeTruthy();
  const routeTooltip = screen.getByText('Asphalt · ≈ 1.20 km');
  expect(routeTooltip).toBeTruthy();
  expect(routeTooltip.getAttribute('data-pane')).toBe('tooltipPane');
});

it.each([
  [45 * 60, '45 min'],
  [65 * 60, '1 h 5 min'],
  [2 * 60 * 60, '2 h'],
])('formats a %s second trip duration as %s', async (durationSeconds, expected) => {
  const result = liveResult();
  result.route.properties.duration_s = durationSeconds;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(result)));

  render(<Map />);
  selectRoute();

  expect(await screen.findByLabelText('Route details')).toBeTruthy();
  expect(screen.getByLabelText('Route details').textContent).toContain(expected);
  expect(screen.getByLabelText('Route details').textContent).not.toContain('0 min');
});

it('clears one selected point while keeping the other and rebuilds from its coordinates', async () => {
  const fetch = vi.fn().mockImplementation(() => jsonResponse(liveResult()));
  vi.stubGlobal('fetch', fetch);
  render(<Map />);
  selectRoute();
  await screen.findByLabelText('Route details');

  fireEvent.click(screen.getByRole('button', { name: 'Clear point A' }));

  expect(screen.getByLabelText('Point A').textContent).toContain('Select point A on the map');
  expect(screen.getByLabelText('Point B').textContent).toContain('Map point');
  expect(screen.getByRole('status').textContent).toBe('Click to select point A');
  expect(screen.queryByLabelText('Route details')).toBeNull();
  expect(screen.queryByTestId('route-line')).toBeNull();
  expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
  expect(screen.getByTestId('map-marker').dataset.position).toBe('[60.2,24.96]');

  fireEvent.click(screen.getByText('Select A'));
  await screen.findByLabelText('Route details');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    start: [24.94, 60.17],
    end: [24.96, 60.2],
  });
});

it('draws each ORS surface segment in its matching color and reports its distance', async () => {
  const result = liveResult(1000);
  result.route.geometry.coordinates = [
    [24.94, 60.17], [24.95, 60.18], [24.96, 60.19], [24.97, 60.20], [24.98, 60.21],
  ];
  const surface = result.surface;
  if (!surface) throw new Error('Expected an ORS surface result.');
  surface.summary = [
    { surface_code: 3, surface: 'asphalt', distance_m: 700, percent: 70 },
    { surface_code: 14, surface: 'paving_stones', distance_m: 200, percent: 20 },
    { surface_code: 0, surface: 'unknown', distance_m: 100, percent: 10 },
  ];
  surface.segments = [
    { surface_code: 3, surface: 'asphalt', index_start: 0, index_end: 2 },
    { surface_code: 14, surface: 'paving_stones', index_start: 2, index_end: 3 },
    { surface_code: 0, surface: 'unknown', index_start: 3, index_end: 4 },
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(result)));

  render(<Map />); selectRoute();

  expect(await screen.findByText('Paving stones')).toBeTruthy();
  expect(screen.getByText('Unknown')).toBeTruthy();
  const lines = screen.getAllByTestId('route-line');
  expect(lines).toHaveLength(3);
  expect(lines[0].dataset.color).toBe('#2f2f33');
  expect(lines[0].dataset.positions).toBe('[[60.17,24.94],[60.18,24.95],[60.19,24.96]]');
  expect(lines[1].dataset.color).toBe('#9aa4b2');
  expect(lines[1].dataset.positions).toBe('[[60.19,24.96],[60.2,24.97]]');
  expect(lines[2].dataset.color).toBe('#cfd6df');
  expect(lines[2].dataset.dasharray).toBe('5 6');
  expect(lines[2].dataset.positions).toBe('[[60.2,24.97],[60.21,24.98]]');
  expect(screen.getByText(/^Paving stones · ≈ /)).toBeTruthy();
  expect(screen.getByText('Unknown · ≈ 250 m')).toBeTruthy();
  const halos = screen.getAllByTestId('route-halo');
  const outlines = screen.getAllByTestId('route-outline');
  expect(halos).toHaveLength(3);
  expect(halos.every(line => line.dataset.color === '#fff' && line.dataset.weight === '8')).toBe(true);
  expect(outlines).toHaveLength(3);
  expect(outlines.every(line => line.dataset.color === '#1f2937' && line.dataset.weight === '6')).toBe(true);
  expect(lines.every(line => line.dataset.weight === '4')).toBe(true);
  expect(halos[2].dataset.dasharray).toBe('5 6');
  expect(outlines[2].dataset.dasharray).toBe('5 6');
  expect(screen.getByRole('meter', { name: 'Paving stones share' }).firstElementChild?.className)
    .toBe('surface-chart__fill');
  expect(screen.getByRole('meter', { name: 'Unknown share' }).firstElementChild?.className)
    .toBe('surface-chart__fill');
  expect(screen.getByText('700 m')).toBeTruthy();
  expect(screen.getByText('70.0%')).toBeTruthy();
  expect(screen.getByText('100 m')).toBeTruthy();
  expect(screen.getByText('10.0%')).toBeTruthy();
});

it('keeps route and metrics on partial and explains missing surface', async () => {
  const logWarning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(partialResult())));
  render(<Map />); selectRoute();
  expect(await screen.findByLabelText('Route details')).toBeTruthy();
  expect(screen.getByText(/Surface coverage unavailable/).textContent).toContain('Surface data is missing.');
  expect(screen.getByTestId('route-line')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Surface breakdown' })).toBeNull();
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
  await screen.findByLabelText('Route details');
  fireEvent.click(screen.getByText('Change B'));
  expect((await screen.findByRole('alert')).textContent).toBe('Routing timed out.');
  expect(logError).toHaveBeenCalledWith('[route] Request failed', {
    code: 'ors_timeout', message: 'Routing timed out.',
  });
  expect(screen.queryByTestId('route-line')).toBeNull();
  expect(screen.queryByLabelText('Route details')).toBeNull();
  fireEvent.click(screen.getByText('Try again'));
  expect(await screen.findByLabelText('Route details')).toBeTruthy();
  expect(screen.getByLabelText('Route details').textContent).toContain('2.40 km');
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.every(([url]) => url === 'http://localhost:8000/api/v1/route')).toBe(true);
});

it('displays the next geometry instead of Leaflet retaining its previous data', async () => {
  const second = liveResult(2400); second.route.geometry.coordinates[1] = [24.97, 60.21];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(liveResult())).mockResolvedValueOnce(jsonResponse(second)));
  render(<Map />); selectRoute();
  await screen.findByLabelText('Route details');
  fireEvent.click(screen.getByText('Change B'));
  await screen.findByLabelText('Route details');
  expect(screen.getByTestId('route-line').dataset.positions).toContain('24.97');
});

it('Reset clears the UI and a late response cannot restore it', async () => {
  const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  render(<Map />); selectRoute();
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
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
  expect(screen.queryByRole('heading', { name: 'Surface breakdown' })).toBeNull();
  expect(screen.getByText('Demo · fixed route')).toBeTruthy();
  expect(screen.getByLabelText('Trip summary')).toBeTruthy();
  expect(screen.queryByLabelText('Point A')).toBeNull();
  expect(screen.queryByLabelText('Point B')).toBeNull();
  expect(screen.getAllByTestId('map-marker').map(marker => marker.dataset.position)).toEqual([
    '[60.16,24.93]', '[60.18,24.95]',
  ]);
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
