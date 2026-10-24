import type { SurfaceData } from '../../api/routeApi';
import { surfaceColor, surfaceKey, surfaceLabel } from './surfacePresentation';
import './SurfaceBarChart.css';

const BAR_THRESHOLD_PERCENT = 1;
const MIN_BAR_WIDTH_PX = 4;

type Props = {
  data: SurfaceData['summary'];
};

function formatSurfaceDistance(distanceMeters: number): string {
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(3)} km`;
}

function formatPercent(percent: number): string {
  return percent < 1 ? '< 1%' : `${percent.toFixed(1)}%`;
}

export const SurfaceBarTextChart = ({ data }: Props) => {
  const items = [...data].sort((a, b) => b.percent - a.percent);

  if (items.length === 0) return null;

  return (
    <section className="surface-chart" aria-label="Surface breakdown, ORS data">
      <header className="surface-chart__header">
        <h2 className="surface-chart__title">Surface breakdown</h2>
        <span className="surface-chart__source">ORS data</span>
      </header>
      <ul className="surface-chart__list">
        {items.map(row => {
          const label = surfaceLabel(row.surface);
          const key = surfaceKey(row.surface);
          const percent = Math.min(row.percent, 100);
          const showBar = percent >= BAR_THRESHOLD_PERCENT;

          return (
            <li className="surface-chart__row" key={row.surface_code} title={`${label}: ${row.distance_m} m (${row.percent}%)`}>
              <span className="surface-chart__label" title={label}>
                <span
                  className={`surface-chart__swatch surface-chart__fill--${key}`}
                  style={{ backgroundColor: surfaceColor(row.surface) }}
                  aria-hidden="true"
                />
                <span className="surface-chart__label-text">{label}</span>
              </span>
              <span className="surface-chart__distance" title={`${row.distance_m} m`}>
                {formatSurfaceDistance(row.distance_m)}
              </span>
              {showBar ? (
                <div
                  className="surface-chart__bar"
                  role="meter"
                  aria-label={`${label} share`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percent}
                >
                  <div
                    className="surface-chart__fill"
                    style={{
                      width: `${percent}%`,
                      minWidth: `${MIN_BAR_WIDTH_PX}px`,
                      backgroundColor: surfaceColor(row.surface),
                    }}
                  />
                </div>
              ) : <span aria-hidden="true" />}
              <span className="surface-chart__percent" title={`${row.percent}%`} aria-label={`${row.percent}%`}>
                {formatPercent(row.percent)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
