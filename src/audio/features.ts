/* Per-frame audio features — the instrument tier.
   ---------------------------------------------------------------
   Everything here updates once per animation frame, so the latency
   from sound to picture is one frame (~33ms). That is what makes
   the tank feel played rather than watched.

   rmsOf() and the asymmetric noise-floor tracker are taken from
   iris-vibecoded, where they were tuned on this same hardware. The
   floor drops fast and rises slow, which absorbs fan noise and room
   tone without any calibration step. */

const TD = new Uint8Array(1024);
const FD = new Uint8Array(512);
const PREV_FD = new Float32Array(512);

/** Bins above this are mostly hiss at 48kHz; ignore them for centroid. */
const SPECTRAL_BINS = 200;

export interface Features {
  /** Raw mic RMS, 0..1. */
  rms: number;
  /** Tracked noise floor. */
  floor: number;
  /** rms above the floor, scaled to a usable 0..1 drive signal. */
  level: number;
  /** Spectral centroid, 0..1 across the analysed band. Raw. */
  centroid: number;
  /** Centroid remapped over a log frequency range, 0..1. Use this one:
      raw centroid crowds all of speech into the bottom fifth. */
  bright: number;
  /** Positive spectral flux, 0..1. Rises on attacks. */
  flux: number;
  /** True on the frame an onset fires. */
  onset: boolean;
}

export const features: Features = {
  rms: 0,
  floor: 0.015,
  level: 0,
  centroid: 0,
  bright: 0,
  flux: 0,
  onset: false,
};

/* `bright` spans this range, log-spaced. A low hum lands near 0.15, ordinary
   speech near 0.65, an "sss" at the top — which spreads a voice across the
   whole tank instead of bunching it against the left edge. */
const LOW_HZ = 200;
const HIGH_HZ = 4000;
const OCTAVES = Math.log2(HIGH_HZ / LOW_HZ);

/** RMS of an analyser's time-domain data. From iris-vibecoded. */
export function rmsOf(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(TD);
  let sum = 0;
  for (let i = 0; i < TD.length; i++) {
    const v = (TD[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / TD.length);
}

const ONSET_FLUX = 0.055;
const ONSET_REFRACTORY_MS = 120;
let lastOnsetAt = -1e9;

/** Scales `level`: how far above the floor counts as "full". */
const LEVEL_SPAN = 0.14;

export function updateFeatures(mic: AnalyserNode | null, now: number): void {
  features.onset = false;
  if (!mic) return;

  const rms = rmsOf(mic);
  features.rms = rms;

  // asymmetric tracker: fall to a quieter room quickly, rise reluctantly
  if (rms < features.floor) features.floor += (rms - features.floor) * 0.05;
  else features.floor += (rms - features.floor) * 0.0025;

  features.level = clamp01((rms - features.floor) / LEVEL_SPAN);

  mic.getByteFrequencyData(FD);

  let weighted = 0;
  let total = 0;
  let flux = 0;
  for (let i = 0; i < SPECTRAL_BINS; i++) {
    const v = FD[i];
    weighted += i * v;
    total += v;
    const d = v - PREV_FD[i];
    if (d > 0) flux += d;
    PREV_FD[i] = v;
  }

  features.centroid = total > 0 ? weighted / total / SPECTRAL_BINS : 0;
  features.flux = clamp01(flux / (255 * SPECTRAL_BINS) * 8);

  const binHz = mic.context.sampleRate / mic.fftSize;
  const hz = Math.max(LOW_HZ, features.centroid * SPECTRAL_BINS * binHz);
  features.bright = clamp01(Math.log2(hz / LOW_HZ) / OCTAVES);

  if (features.flux > ONSET_FLUX && now - lastOnsetAt > ONSET_REFRACTORY_MS) {
    features.onset = true;
    lastOnsetAt = now;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
