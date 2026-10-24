import type { Coordinates } from '../api/routeApi';

export type Place = {
  coordinates: Coordinates;
  label: string | null;
};
