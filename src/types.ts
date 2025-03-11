export interface VatsimData {
  general: {
    version: number;
    reload: number;
    update: string;
    update_timestamp: string;
    connected_clients: number;
    unique_users: number;
  };
  pilots: Pilot[];
  controllers: Controller[];
  atis: Atis[];
  servers: Server[];
  prefiles: Pilot[];
  facilities: Facility[];
}

export interface Pilot {
  cid: number;
  name: string;
  callsign: string;
  server: string;
  pilot_rating: number;
  military_rating: number;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  transponder: string;
  heading: number;
  qnh_i_hg: number;
  qnh_mb: number;
  flight_plan: FlightPlan | null;
  logon_time: string;
  last_updated: string;
  destination_lat?: number;
  destination_lon?: number;
}

export interface FlightPlan {
  flight_rules: string;
  aircraft: string;
  aircraft_faa: string;
  aircraft_short: string;
  departure: string;
  arrival: string;
  alternate: string;
  cruise_tas: string;
  altitude: string;
  deptime: string;
  enroute_time: string;
  fuel_time: string;
  remarks: string;
  route: string;
  revision_id: number;
  assigned_transponder: string;
}

export interface Controller {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: number;
  rating: number;
  server: string;
  visual_range: number;
  text_atis: string[] | null;
  last_updated: string;
  logon_time: string;
}

export interface Atis {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: number;
  rating: number;
  server: string;
  visual_range: number;
  atis_code: string;
  text_atis: string[];
  last_updated: string;
  logon_time: string;
}

export interface Server {
  ident: string;
  hostname_or_ip: string;
  location: string;
  name: string;
  clients_connection_allowed: boolean;
  client_connections_allowed: boolean;
  is_sweatbox: boolean;
}

export interface Facility {
  id: number;
  short: string;
  long: string;
}

export interface FilterOptions {
  callsign: string;
  aircraftType: string;
  status: 'all' | 'departed' | 'arrived';
}

export type FlightStatus = 'departing' | 'departed' | 'arriving' | 'arrived';

export interface Metar {
  raw: string;
  station: string;
  time: string;
  wind: string;
  visibility: string;
  conditions: string;
  clouds: string;
  temperature: string;
  dewpoint: string;
  pressure: string;
  flightCategory?: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
}