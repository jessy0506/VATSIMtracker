import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Pilot } from '../types';
import 'leaflet/dist/leaflet.css';

const createSquareIcon = (heading: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <rect width="12" height="12" fill="#2563eb" x="6" y="6"/>
      <line 
        x1="12" 
        y1="12" 
        x2="${12 + 8 * Math.sin(heading * Math.PI / 180)}" 
        y2="${12 - 8 * Math.cos(heading * Math.PI / 180)}" 
        stroke="#2563eb" 
        stroke-width="2"
      />
    </svg>
  `;

  return new L.DivIcon({
    html: svg,
    className: 'aircraft-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

interface MapBoundsProps {
  pilots: Pilot[];
}

function MapBounds({ pilots }: MapBoundsProps) {
  const map = useMap();
  
  useEffect(() => {
    if (pilots.length > 0) {
      const bounds = L.latLngBounds(pilots.map(pilot => [pilot.latitude, pilot.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pilots, map]);

  return null;
}

interface FlightMapProps {
  pilots: Pilot[];
  selectedFlight?: string;
  onFlightSelect?: (callsign: string) => void;
}

export function FlightMap({ pilots, selectedFlight, onFlightSelect }: FlightMapProps) {
  const center = useMemo(() => {
    if (pilots.length === 0) return [0, 0];
    return [pilots[0].latitude, pilots[0].longitude];
  }, [pilots]);

  return (
    <MapContainer
      center={[center[0], center[1]]}
      zoom={4}
      style={{ height: '500px', width: '100%', borderRadius: '0.75rem' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBounds pilots={pilots} />
      {pilots.map((pilot) => (
        <Marker
          key={pilot.callsign}
          position={[pilot.latitude, pilot.longitude]}
          icon={createSquareIcon(pilot.heading)}
          eventHandlers={{
            click: () => onFlightSelect?.(pilot.callsign)
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{pilot.callsign}</p>
              <p>Aircraft: {pilot.flight_plan?.aircraft || 'N/A'}</p>
              <p>Altitude: {Math.round(pilot.altitude).toLocaleString()} ft</p>
              <p>Ground Speed: {Math.round(pilot.groundspeed)} kts</p>
              <p>Heading: {Math.round(pilot.heading)}°</p>
              {pilot.flight_plan && (
                <>
                  <p>From: {pilot.flight_plan.departure}</p>
                  <p>To: {pilot.flight_plan.arrival}</p>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}