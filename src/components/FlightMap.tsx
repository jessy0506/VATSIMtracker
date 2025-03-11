import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Pilot } from '../types';
import 'leaflet/dist/leaflet.css';

const createPlaneIcon = (heading: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path 
        d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"
        fill="#2563eb"
        transform="rotate(${heading} 12 12)"
      />
    </svg>
  `;

  return new L.DivIcon({
    html: svg,
    className: 'aircraft-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

interface MapBoundsProps {
  pilots: Pilot[];
  selectedFlight?: string;
}

function MapBounds({ pilots, selectedFlight }: MapBoundsProps) {
  const map = useMap();
  
  useEffect(() => {
    if (pilots.length > 0) {
      if (selectedFlight) {
        const selectedPilot = pilots.find(p => p.callsign === selectedFlight);
        if (selectedPilot) {
          map.setView(
            [selectedPilot.latitude, selectedPilot.longitude],
            10,
            { animate: true }
          );
          return;
        }
      }
      const bounds = L.latLngBounds(pilots.map(pilot => [pilot.latitude, pilot.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pilots, selectedFlight, map]);

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
    if (selectedFlight) {
      const selectedPilot = pilots.find(p => p.callsign === selectedFlight);
      if (selectedPilot) {
        return [selectedPilot.latitude, selectedPilot.longitude];
      }
    }
    return [pilots[0].latitude, pilots[0].longitude];
  }, [pilots, selectedFlight]);

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
      <MapBounds pilots={pilots} selectedFlight={selectedFlight} />
      {pilots.map((pilot) => (
        <Marker
          key={pilot.callsign}
          position={[pilot.latitude, pilot.longitude]}
          icon={createPlaneIcon(pilot.heading)}
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