import { useMapEvent } from "react-leaflet";

export default function MapClickHandler({ from, to, setFrom, setTo }: {
    from: [number, number] | null,
    to: [number, number] | null,
    setFrom: (c: [number, number]) => void,
    setTo: (c: [number, number]) => void
}) {
    useMapEvent("click", (e) => {
        const coords: [number, number] = [e.latlng.lng, e.latlng.lat];
        if (!from) {
            setFrom(coords);
        } else if (!to) {
            setTo(coords);
        }
    });

    return null; // This component does not render anything
}
