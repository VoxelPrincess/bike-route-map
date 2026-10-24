import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SurfaceBarTextChart } from './SurfaceBarChart';

it('shows a minimum-width bar for shares from 1% and keeps a swatch for smaller shares', () => {
  const { container } = render(
    <SurfaceBarTextChart
      data={[
        { surface_code: 3, surface: 'asphalt', distance_m: 3821, percent: 94.81 },
        { surface_code: 2, surface: 'paved', distance_m: 577, percent: 3.4 },
        { surface_code: 10, surface: 'gravel', distance_m: 334, percent: 1.6 },
        { surface_code: 14, surface: 'paving_stones', distance_m: 5, percent: 0.12 },
      ]}
    />,
  );

  expect(screen.getByText('ORS data')).toBeTruthy();
  expect(container.querySelector('.surface-chart__route-metrics')).toBeNull();
  expect(screen.getByRole('meter', { name: 'Asphalt share' })).toBeTruthy();
  expect(screen.getByRole('meter', { name: 'Paved share' })).toBeTruthy();
  expect(screen.getByRole('meter', { name: 'Gravel share' })).toBeTruthy();
  expect(screen.queryByRole('meter', { name: 'Paving stones share' })).toBeNull();
  expect(container.querySelector('.surface-chart__swatch.surface-chart__fill--asphalt')).toBeTruthy();
  expect(container.querySelector('.surface-chart__swatch.surface-chart__fill--paved')).toBeTruthy();
  expect(container.querySelector('.surface-chart__swatch.surface-chart__fill--gravel')).toBeTruthy();
  expect(container.querySelector('.surface-chart__swatch.surface-chart__fill--paving_stones')).toBeTruthy();

  expect(container.querySelector('.surface-chart__fill[style*="min-width: 4px"]')).toBeTruthy();

  expect(screen.getByText('577 m')).toBeTruthy();
  expect(screen.getByText('334 m')).toBeTruthy();
  expect(screen.getByText('5 m')).toBeTruthy();
  expect(screen.getByText('94.8%')).toBeTruthy();
  expect(screen.getByText('3.4%')).toBeTruthy();
  expect(screen.getByText('1.6%')).toBeTruthy();
  expect(screen.getByText('< 1%').getAttribute('title')).toBe('0.12%');
});
