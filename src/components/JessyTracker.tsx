import React from 'react';
import { Pilot } from '../types';
import { Plane, MapPin } from 'lucide-react';

interface JessyTrackerProps {
  pilots: Pilot[];
  onFlightSelect: (callsign: string) => void;
}

export function JessyTracker({ pilots, onFlightSelect }: JessyTrackerProps) {
  const jessyFlight = pilots.find(pilot => pilot.cid === 1186120);

  if (!jessyFlight) {
    return (
      <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
        <h2 className="text-2xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <Plane className="w-6 h-6 text-blue-600" />
          Is Jessy Flying?
        </h2>
        <p className="text-blue-800">Not currently online on VATSIM</p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
      <h2 className="text-2xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
        <Plane className="w-6 h-6 text-blue-600" />
        Jessy is Flying!
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-blue-600">Callsign</p>
            <p className="font-medium text-lg">{jessyFlight.callsign}</p>
          </div>
          <div>
            <p className="text-sm text-blue-600">Aircraft</p>
            <p className="font-medium">{jessyFlight.flight_plan?.aircraft || 'N/A'}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-sm text-blue-600">Altitude</p>
              <p className="font-medium">{Math.round(jessyFlight.altitude).toLocaleString()} ft</p>
            </div>
            <div>
              <p className="text-sm text-blue-600">Ground Speed</p>
              <p className="font-medium">{Math.round(jessyFlight.groundspeed)} kts</p>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600">Route</p>
              <p className="font-medium">
                {jessyFlight.flight_plan ? (
                  <>
                    {jessyFlight.flight_plan.departure} → {jessyFlight.flight_plan.arrival}
                  </>
                ) : (
                  'No flight plan filed'
                )}
              </p>
            </div>
          </div>
          {jessyFlight.flight_plan?.route && (
            <div>
              <p className="text-sm text-blue-600">Filed Route</p>
              <p className="font-medium text-sm break-words">{jessyFlight.flight_plan.route}</p>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onFlightSelect(jessyFlight.callsign)}
        className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Track Flight
      </button>
    </div>
  );
}