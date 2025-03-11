import React, { useState, useEffect } from 'react';
import { Search, Plane, Radio, Info, CloudSun, PlaneLanding, MapPin } from 'lucide-react';
import { VatsimData, FilterOptions, Pilot, FlightStatus, Metar } from './types';
import { format, addMinutes, utcToZonedTime } from 'date-fns';
import { fetchVatsimData, fetchMetar } from './api';
import { FlightMap } from './components/FlightMap';

function App() {
  const [icao, setIcao] = useState<string>('');
  const [airlineCode, setAirlineCode] = useState<string>('');
  const [airlineAircraftFilter, setAirlineAircraftFilter] = useState<string>('');
  const [data, setData] = useState<VatsimData | null>(null);
  const [metar, setMetar] = useState<Metar | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    callsign: '',
    aircraftType: '',
    status: 'all'
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'time' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [debug, setDebug] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchVatsimData();
        
        const airportCoordinates = new Map<string, { lat: number; lon: number }>();
        
        result.pilots.forEach(pilot => {
          if (pilot.flight_plan?.departure) {
            airportCoordinates.set(pilot.flight_plan.departure, {
              lat: pilot.latitude,
              lon: pilot.longitude
            });
          }
        });
        
        const pilotsWithDestinations = result.pilots.map(pilot => {
          if (pilot.flight_plan?.arrival) {
            const destCoords = airportCoordinates.get(pilot.flight_plan.arrival);
            if (destCoords) {
              return {
                ...pilot,
                destination_lat: destCoords.lat,
                destination_lon: destCoords.lon
              };
            }
          }
          return pilot;
        });
        
        setData({
          ...result,
          pilots: pilotsWithDestinations
        });
        setDebug(`Total pilots: ${result.pilots.length}`);
      } catch (error) {
        console.error('Error fetching VATSIM data:', error);
        setDebug(`Error: ${error}`);
      }
    };

    const interval = setInterval(fetchData, 60000);
    fetchData();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!icao) {
        setMetar(null);
        return;
      }
      
      const metarData = await fetchMetar(icao);
      setMetar(metarData);
    };

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 300000);
    
    return () => clearInterval(interval);
  }, [icao]);

  const getFlightStatus = (pilot: Pilot): FlightStatus => {
    if (!pilot.flight_plan) return 'departed';

    const isDeparture = pilot.flight_plan.departure.toUpperCase() === icao.toUpperCase();
    const isArrival = pilot.flight_plan.arrival.toUpperCase() === icao.toUpperCase();

    if (isDeparture) {
      return pilot.groundspeed < 50 ? 'departing' : 'departed';
    }
    else if (isArrival) {
      return pilot.groundspeed < 50 ? 'arrived' : 'arriving';
    }

    return 'departed';
  };

  const calculateGreatCircleDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3440.065; // Earth's radius in nautical miles
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const calculateEstimatedArrival = (pilot: Pilot): string => {
    if (!pilot.flight_plan || !pilot.destination_lat || !pilot.destination_lon || pilot.groundspeed <= 0) {
      return 'N/A';
    }

    try {
      const remainingDistance = calculateGreatCircleDistance(
        pilot.latitude,
        pilot.longitude,
        pilot.destination_lat,
        pilot.destination_lon
      );

      const timeRemainingHours = remainingDistance / pilot.groundspeed;
      const timeRemainingMinutes = timeRemainingHours * 60;

      if (!isFinite(timeRemainingMinutes) || timeRemainingMinutes < 0) {
        return 'N/A';
      }

      // Create a UTC date object
      const now = new Date();
      const utcNow = new Date(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );
      
      const estimatedArrival = addMinutes(utcNow, Math.round(timeRemainingMinutes));
      return format(estimatedArrival, 'HH:mm') + 'Z';
    } catch (error) {
      console.error('Error calculating estimated arrival:', error);
      return 'N/A';
    }
  };

  const getTimeDisplay = (pilot: Pilot): string => {
    if (!pilot.flight_plan) return 'N/A';
    
    const status = getFlightStatus(pilot);
    
    if (status === 'departed' || status === 'departing') {
      return pilot.flight_plan.deptime + 'Z';
    } else if (status === 'arriving') {
      return calculateEstimatedArrival(pilot);
    } else if (status === 'arrived') {
      return 'Landed';
    }
    
    return 'N/A';
  };

  const getTimeValue = (pilot: Pilot): number => {
    const time = getTimeDisplay(pilot);
    if (time === 'N/A' || time === 'Landed') return Infinity;
    
    // Parse the time string (HH:mmZ format)
    const [hours, minutes] = time.slice(0, -1).split(':').map(Number);
    
    // For sorting purposes, adjust midnight (00) to 24 to ensure correct ordering
    const adjustedHours = hours === 0 ? 24 : hours;
    return (adjustedHours * 60) + minutes;
  };

  const filteredPilots = React.useMemo(() => {
    if (!data?.pilots) return [];
    
    let pilots = data.pilots;

    if (airlineCode) {
      pilots = pilots.filter(pilot => 
        pilot.callsign.startsWith(airlineCode.toUpperCase())
      );

      if (airlineAircraftFilter) {
        pilots = pilots.filter(pilot =>
          pilot.flight_plan?.aircraft?.toLowerCase().includes(airlineAircraftFilter.toLowerCase())
        );
      }
    }
    
    if (icao) {
      pilots = pilots.filter(pilot => {
        if (!pilot.flight_plan) return false;

        const isDeparture = pilot.flight_plan.departure.toUpperCase() === icao.toUpperCase();
        const isArrival = pilot.flight_plan.arrival.toUpperCase() === icao.toUpperCase();
        
        if (!isDeparture && !isArrival) return false;

        const matchesCallsign = !filters.callsign || 
                               pilot.callsign.toLowerCase().includes(filters.callsign.toLowerCase());
        const matchesAircraft = !filters.aircraftType || 
                               (pilot.flight_plan.aircraft || '').toLowerCase().includes(filters.aircraftType.toLowerCase());
        
        const status = getFlightStatus(pilot);
        let matchesStatus = filters.status === 'all';

        if (filters.status === 'departed') {
          matchesStatus = (status === 'departed' || status === 'departing') && isDeparture;
        } else if (filters.status === 'arrived') {
          matchesStatus = (status === 'arrived' || status === 'arriving') && isArrival;
        }

        return matchesCallsign && matchesAircraft && matchesStatus;
      });
    }

    if (sortConfig.key === 'time') {
      pilots.sort((a, b) => {
        const timeA = getTimeValue(a);
        const timeB = getTimeValue(b);
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }

    return pilots;
  }, [data, icao, airlineCode, airlineAircraftFilter, filters, sortConfig]);

  const activeControllers = React.useMemo(() => {
    if (!data?.controllers || !icao) return [];
    
    return data.controllers.filter(controller => {
      const controllerICAO = controller.callsign.split('_')[0];
      return controllerICAO.toUpperCase() === icao.toUpperCase();
    });
  }, [data, icao]);

  const activeAtis = React.useMemo(() => {
    if (!data?.atis || !icao) return [];
    
    return data.atis.filter(atis => {
      const atisICAO = atis.callsign.split('_')[0];
      return atisICAO.toUpperCase() === icao.toUpperCase();
    });
  }, [data, icao]);

  const handleTimeSort = () => {
    setSortConfig(current => ({
      key: 'time',
      direction: current.key === 'time' && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getFlightCategoryColor = (category: Metar['flightCategory']): string => {
    switch (category) {
      case 'VFR':
        return 'bg-green-100 text-green-800';
      case 'MVFR':
        return 'bg-blue-100 text-blue-800';
      case 'IFR':
        return 'bg-red-100 text-red-800';
      case 'LIFR':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.5)), url('https://images.unsplash.com/photo-1544950111-0c3082d5341e?auto=format&fit=crop&w=2560&q=80')`
        }}
      />
      
      <div className="cloud" />
      <div className="cloud" />
      <div className="cloud" />
      <div className="cloud" />
      <div className="cloud" />

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8 backdrop-blur-sm bg-white/30 rounded-xl p-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-4 flex items-center justify-center gap-3">
            <Radio className="w-10 h-10 text-blue-600" />
            VATSIM Airport Tracker
          </h1>
          <div className="max-w-md mx-auto space-y-4">
            <div className="relative">
              <input
                type="text"
                value={icao}
                onChange={(e) => setIcao(e.target.value.toUpperCase())}
                placeholder="Enter Airport ICAO Code (e.g., KLAX)"
                className="w-full px-6 py-3 text-lg border-2 border-blue-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white/80 backdrop-blur-sm"
              />
              <Search className="absolute right-4 top-3.5 text-blue-400 w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={airlineCode}
                  onChange={(e) => setAirlineCode(e.target.value.toUpperCase())}
                  placeholder="Enter Airline ICAO Code (e.g., KLM, BAW)"
                  className="w-full px-6 py-3 text-lg border-2 border-blue-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white/80 backdrop-blur-sm"
                />
                <PlaneLanding className="absolute right-4 top-3.5 text-blue-400 w-6 h-6" />
              </div>
              {airlineCode && (
                <input
                  type="text"
                  value={airlineAircraftFilter}
                  onChange={(e) => setAirlineAircraftFilter(e.target.value)}
                  placeholder="Filter airline by aircraft type (e.g., B738, A320)"
                  className="w-full px-6 py-3 text-lg border-2 border-blue-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white/80 backdrop-blur-sm"
                />
              )}
            </div>
            {debug && <p className="mt-2 text-sm text-gray-500">{debug}</p>}
          </div>
        </div>

        {(airlineCode || icao) && (
          <div className="space-y-6">
            {metar && icao && (
              <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-semibold text-blue-900 flex items-center gap-2">
                    <CloudSun className="w-6 h-6 text-blue-600" />
                    Weather at {icao}
                  </h2>
                  {metar.flightCategory && (
                    <span className={`px-3 py-1 rounded-full font-medium ${getFlightCategoryColor(metar.flightCategory)}`}>
                      {metar.flightCategory}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-mono text-sm bg-blue-50/50 p-3 rounded">{metar.raw}</p>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-blue-600">Wind</p>
                      <p className="font-medium">{metar.wind || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600">Visibility</p>
                      <p className="font-medium">{metar.visibility || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600">Temperature/Dewpoint</p>
                      <p className="font-medium">{metar.temperature}/{metar.dewpoint}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600">Pressure</p>
                      <p className="font-medium">{metar.pressure}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-blue-600">Clouds</p>
                      <p className="font-medium">{metar.clouds || 'N/A'}</p>
                    </div>
                    {metar.conditions && (
                      <div className="col-span-2">
                        <p className="text-sm text-blue-600">Conditions</p>
                        <p className="font-medium">{metar.conditions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeControllers.length > 0 && icao && (
              <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
                <h2 className="text-2xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Radio className="w-6 h-6 text-green-600" />
                  Active Controllers at {icao}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeControllers.map((controller) => (
                    <div key={controller.callsign} 
                         className="bg-gradient-to-br from-green-50/90 to-blue-50/90 p-4 rounded-lg border border-green-100 shadow-sm backdrop-blur-sm">
                      <p className="font-semibold text-green-800 text-lg">{controller.callsign}</p>
                      <p className="text-green-700">{controller.frequency} MHz</p>
                      <p className="text-green-600 text-sm">Rating: {controller.rating}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeAtis.length > 0 && icao && (
              <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
                <h2 className="text-2xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Info className="w-6 h-6 text-blue-600" />
                  ATIS Information
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {activeAtis.map((atis) => (
                    <div key={atis.callsign} 
                         className="bg-gradient-to-br from-blue-50/90 to-indigo-50/90 p-4 rounded-lg border border-blue-100 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-blue-800 text-lg">{atis.callsign}</p>
                        <p className="text-blue-700">{atis.frequency} MHz</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-blue-800 font-medium">Information {atis.atis_code}</p>
                        {atis.text_atis.map((line, index) => (
                          <p key={index} className="text-blue-700 text-sm">{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
              <h2 className="text-2xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-blue-600" />
                Live Flight Map
              </h2>
              <FlightMap 
                pilots={filteredPilots}
                selectedFlight={filters.callsign}
                onFlightSelect={(callsign) => setFilters(prev => ({ ...prev, callsign }))}
              />
            </div>

            <div className="backdrop-blur-sm bg-white/80 rounded-xl shadow-lg p-6 border border-blue-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-semibold text-blue-900 flex items-center gap-2">
                  <Plane className="w-6 h-6 text-blue-600" />
                  {airlineCode ? `${airlineCode} Flights` : `Flights at ${icao}`}
                </h2>
                {icao && (
                  <div className="flex flex-col md:flex-row gap-4">
                    <input
                      type="text"
                      value={filters.callsign}
                      onChange={(e) => setFilters(prev => ({ ...prev, callsign: e.target.value }))}
                      placeholder="Filter by callsign"
                      className="px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                    />
                    <input
                      type="text"
                      value={filters.aircraftType}
                      onChange={(e) => setFilters(prev => ({ ...prev, aircraftType: e.target.value }))}
                      placeholder="Filter by aircraft type"
                      className="px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                    />
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterOptions['status'] }))}
                      className="px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                    >
                      <option value="all">All Flights</option>
                      <option value="departed">Departures</option>
                      <option value="arrived">Arrivals</option>
                    </select>
                  </div>
                )}
              </div>

              {filteredPilots.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-blue-50/80 backdrop-blur-sm">
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Callsign</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Aircraft</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">From</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">To</th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider cursor-pointer hover:bg-blue-100/80 transition-colors"
                          onClick={handleTimeSort}
                        >
                          {filters.status === 'departed' ? 'Departure Time' : 
                           filters.status === 'arrived' ? 'Arrival Time' : 
                           'Time'}
                          {sortConfig.key === 'time' && (
                            <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Route</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/80 backdrop-blur-sm divide-y divide-blue-100">
                      {filteredPilots.map((pilot) => {
                        const status = getFlightStatus(pilot);
                        const statusColors = {
                          departing: 'text-yellow-600',
                          departed: 'text-blue-600',
                          arriving: 'text-yellow-600',
                          arrived: 'text-green-600'
                        };
                        return (
                          <tr key={pilot.callsign} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-900">{pilot.callsign}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-blue-800">{pilot.flight_plan?.aircraft}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-blue-800">{pilot.flight_plan?.departure}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-blue-800">{pilot.flight_plan?.arrival}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-blue-800">
                              {getTimeDisplay(pilot)}
                            </td>
                            <td className="px-6 py-4 text-blue-800 truncate max-w-xs" title={pilot.flight_plan?.route}>
                              {pilot.flight_plan?.route || 'N/A'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap font-medium ${statusColors[status]}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-blue-500">
                  {airlineCode || icao ? 'No flights found matching your criteria' : 'Enter an ICAO code or airline code to see flights'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;