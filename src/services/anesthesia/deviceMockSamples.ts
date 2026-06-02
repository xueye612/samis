import type { AbnormalSimulationType } from '@/services/anesthesia/deviceSimulationMode';
import { pickAbnormalSimulationType } from '@/services/anesthesia/deviceSimulationMode';

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

export interface MonitorSample {
  hr: number;
  pulse: number;
  sbp: number;
  dbp: number;
  map_value: number;
  spo2: number;
  temperature: number;
  respiration: number;
  bis: number;
  etco2?: number;
}

export interface VentilatorSample {
  vent_mode: string;
  tidal_volume: number;
  respiratory_rate: number;
  fio2: number;
  peep: number;
  peak_pressure: number;
  plateau_pressure: number;
  minute_volume: number;
  etco2: number;
  airway_pressure: number;
}

const MODES = ['VCV', 'PCV', 'SIMV', 'PSV'];

function buildNormalMonitorSample(): MonitorSample {
  const hr = randomBetween(65, 95);
  const sbp = randomBetween(100, 135);
  const dbp = randomBetween(60, 85);
  return {
    hr,
    pulse: hr,
    sbp,
    dbp,
    map_value: Math.round((sbp + dbp * 2) / 3),
    spo2: randomBetween(96, 100),
    temperature: randomBetween(360, 372) / 10,
    respiration: randomBetween(12, 18),
    bis: randomBetween(45, 60),
    etco2: randomBetween(35, 45),
  };
}

function applyAbnormalType(sample: MonitorSample, type: AbnormalSimulationType): MonitorSample {
  switch (type) {
    case 'hypotension':
      sample.sbp = randomBetween(78, 89);
      sample.dbp = randomBetween(45, 55);
      break;
    case 'hypertension':
      sample.sbp = randomBetween(150, 170);
      sample.dbp = randomBetween(95, 105);
      break;
    case 'tachycardia':
      sample.hr = randomBetween(110, 130);
      sample.pulse = sample.hr;
      break;
    case 'hypoxia':
      sample.spo2 = randomBetween(88, 93);
      break;
    case 'etco2':
      sample.etco2 = randomBetween(48, 55);
      sample.respiration = randomBetween(18, 24);
      break;
    default:
      break;
  }
  sample.map_value = Math.round((sample.sbp + sample.dbp * 2) / 3);
  return sample;
}

export function buildMonitorSample(options?: {
  abnormal?: boolean;
  abnormalType?: AbnormalSimulationType;
  rescueChaos?: boolean;
}): MonitorSample {
  if (options?.abnormal) {
    const sample = buildNormalMonitorSample();
    return applyAbnormalType(sample, options.abnormalType ?? pickAbnormalSimulationType());
  }
  if (options?.rescueChaos && Math.random() < 0.15) {
    const sample = buildNormalMonitorSample();
    return applyAbnormalType(sample, pickAbnormalSimulationType());
  }
  return buildNormalMonitorSample();
}

export function buildVentilatorSample(options?: {
  abnormal?: boolean;
  abnormalType?: AbnormalSimulationType;
  rescueChaos?: boolean;
}): VentilatorSample {
  const monitor = buildMonitorSample(options);
  return {
    vent_mode: MODES[randomBetween(0, MODES.length - 1)],
    tidal_volume: randomBetween(420, 560),
    respiratory_rate: monitor.respiration,
    fio2: randomBetween(40, 60),
    peep: randomBetween(3, 7),
    peak_pressure: randomBetween(16, 28),
    plateau_pressure: randomBetween(12, 20),
    minute_volume: randomBetween(50, 80) / 10,
    etco2: monitor.etco2 ?? randomBetween(35, 45),
    airway_pressure: randomBetween(12, 24),
  };
}
