import axios from 'axios';
import { decode } from 'html-entities';
import { VatsimData, Metar } from './types';

const VATSIM_API = 'https://data.vatsim.net/v3/vatsim-data.json';
const METAR_API = 'https://metar.vatsim.net/metar.php';

export const fetchVatsimData = async (): Promise<VatsimData> => {
  const response = await axios.get(VATSIM_API);
  return response.data;
};

const determineFlightCategory = (visibility: string, clouds: string): Metar['flightCategory'] => {
  let visibilityInMiles = 10;
  if (visibility === 'CAVOK') {
    visibilityInMiles = 10;
  } else if (/^\d{4}$/.test(visibility)) {
    visibilityInMiles = parseInt(visibility) * 0.000621371;
  } else if (/^\d+SM$/.test(visibility)) {
    visibilityInMiles = parseInt(visibility);
  }

  let ceiling = Infinity;
  const cloudLayers = clouds.split(' ');
  for (const layer of cloudLayers) {
    if (/(BKN|OVC)\d{3}/.test(layer)) {
      const height = parseInt(layer.slice(-3)) * 100;
      ceiling = Math.min(ceiling, height);
    }
  }

  if (visibilityInMiles < 1 || ceiling < 500) {
    return 'LIFR';
  } else if (visibilityInMiles < 3 || ceiling < 1000) {
    return 'IFR';
  } else if (visibilityInMiles < 5 || ceiling < 3000) {
    return 'MVFR';
  } else {
    return 'VFR';
  }
};

export const fetchMetar = async (icao: string): Promise<Metar | null> => {
  try {
    const response = await axios.get(METAR_API, {
      params: {
        id: icao,
        decode: true
      }
    });
    
    const rawMetar = response.data;
    if (!rawMetar || typeof rawMetar !== 'string') return null;

    const metarData: Metar = {
      raw: rawMetar,
      station: '',
      time: '',
      wind: '',
      visibility: '',
      conditions: '',
      clouds: '',
      temperature: '',
      dewpoint: '',
      pressure: ''
    };

    const parts = rawMetar.split(' ').filter(Boolean);
    
    if (parts.length < 2) return null;
    
    metarData.station = parts[0];
    
    parts.forEach((part, index) => {
      if (index === 0) return;
      
      if (/^\d{6}Z$/.test(part)) {
        metarData.time = part;
      }
      else if (/^(VRB|\d{3})\d{2}(G\d{2})?KT$/.test(part)) {
        metarData.wind = part;
      }
      else if (/^\d{4}$/.test(part) || part === 'CAVOK') {
        metarData.visibility = part;
      }
      else if (/^[+-]?(RA|SN|BR|FG|DZ|TS|SH|HZ|FU|DU|SA|PY)/.test(part)) {
        metarData.conditions += (metarData.conditions ? ' ' : '') + part;
      }
      else if (/(FEW|SCT|BKN|OVC|CLR|SKC|NSC|NCD)\d{3}?/.test(part)) {
        metarData.clouds += (metarData.clouds ? ' ' : '') + part;
      }
      else if (/^M?\d{2}\/M?\d{2}$/.test(part)) {
        const [temp, dew] = part.split('/');
        metarData.temperature = temp;
        metarData.dewpoint = dew;
      }
      else if (/^[AQ]\d{4}/.test(part)) {
        metarData.pressure = part;
      }
    });

    metarData.flightCategory = determineFlightCategory(metarData.visibility, metarData.clouds);

    return metarData;
  } catch (error) {
    console.error('Error fetching METAR:', error);
    return null;
  }
};