import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Coordinates } from '../api/routeApi';
import { useRoute } from './useRoute';
import { deferred, jsonResponse, liveResult, partialResult } from '../test/routeFixtures';

const from: Coordinates = [24.94, 60.17];
const to: Coordinates = [24.96, 60.20];
const next: Coordinates = [24.97, 60.21];

beforeEach(() => { vi.stubEnv('VITE_USE_SAMPLE', '0'); vi.stubEnv('VITE_API_BASE', 'http://localhost:8000'); });

it.each(['resolve', 'reject'] as const)('ignores an older request that will %s after the new route', async outcome => {
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const old = deferred<Response>(); const newer = deferred<Response>();
  const fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ end }) => useRoute(from, end), { initialProps: { end: to } });
  expect(result.current.phase).toBe('loading');
  rerender({ end: next });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { newer.resolve(jsonResponse(liveResult(2400))); });
  expect(result.current.result?.route.properties.distance_m).toBe(2400);
  await act(async () => {
    if (outcome === 'resolve') old.resolve(jsonResponse(liveResult(900)));
    else old.reject(new Error('old failure'));
  });
  expect(result.current.phase).toBe('ready');
  expect(result.current.result?.route.properties.distance_m).toBe(2400);
  expect(logError).not.toHaveBeenCalled();
});

it('clears previous route and surface while fetching, then accepts partial without old coverage', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(liveResult())).mockReturnValueOnce(pending.promise));
  const { result, rerender } = renderHook(({ end }) => useRoute(from, end), { initialProps: { end: to } });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  expect(result.current.result?.surface).not.toBeNull();
  rerender({ end: next });
  expect(result.current.phase).toBe('loading');
  expect(result.current.result).toBeNull();
  await act(async () => { pending.resolve(jsonResponse(partialResult())); });
  expect(result.current.result?.status).toBe('partial');
  expect(result.current.result?.surface).toBeNull();
});

it('reset invalidates a pending response even if fetch ignores abort', async () => {
  const pending = deferred<Response>(); const fetch = vi.fn().mockReturnValue(pending.promise);
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ start, end }) => useRoute(start, end), {
    initialProps: { start: from as Coordinates | null, end: to as Coordinates | null },
  });
  act(() => { result.current.clear(); });
  rerender({ start: null, end: null });
  await act(async () => { pending.resolve(jsonResponse(liveResult())); });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(result.current.phase).toBe('idle');
  expect(result.current.result).toBeNull();
});

it('aborts pending work on unmount', () => {
  const fetch = vi.fn().mockReturnValue(new Promise(() => {})); vi.stubGlobal('fetch', fetch);
  const { unmount } = renderHook(() => useRoute(from, to));
  unmount();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
