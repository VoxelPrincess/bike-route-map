import { useMapEvent } from "react-leaflet";
import type { Coordinates } from '../api/routeApi';
import type { Place } from '../types/place';

export default function MapClickHandler({ from, to, setFrom, setTo }: {
    from: Place | null,
    to: Place | null,
    setFrom: (place: Place) => void,
    setTo: (place: Place) => void
}) {
    useMapEvent("click", (e) => {
        const coordinates: Coordinates = [e.latlng.lng, e.latlng.lat];
        const place: Place = { coordinates, label: null };
        if (!from) {
            setFrom(place);
        } else if (!to) {
            setTo(place);
        }
    });

    return null; 
}
