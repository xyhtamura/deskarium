/* Audio thresholds, per device.
   ---------------------------------------------------------------
   The numbers this file holds used to be constants compiled into the
   engine, inherited from `iris-vibecoded` and measured on one machine.
   That is fine until the tank meets a second microphone. Gain, room
   tone and distance move `features.level` bodily, and every threshold
   in fish.ts is an absolute position on that scale — so a hot mic puts
   ordinary speech above the startle line, where talking to the tank
   scatters the shoal and never calls it, and a quiet one puts a shout
   below the speech floor, where nothing happens at all.

   Neither case is a tuning error that a better default fixes. The
   right value is a property of the room and the hardware, so it has to
   be settable on the device, with the meter running, by the person
   standing in front of it. See `menu.ts`.

   Two thresholds and a gain, following hunitsura's min/max model:

     gain    how far above the noise floor counts as full scale
     quiet   above this, a sound is someone rather than the room
     loud    above this, an onset is a threat rather than a snack

   `quiet` and `loud` also bound the middle band that means "a held
   sound, not a bang" — the one that summons. Widening that band is
   what makes the tank easier to call and harder to startle, which is
   the adjustment most rooms want. */

export interface Settings {
  /** features.level = (rms - floor) / gain, clamped. Smaller is hotter. */
  gain: number;
  /** Level above which a sound is deliberate. */
  quiet: number;
  /** Level above which an onset is a threat. */
  loud: number;
}

export const DEFAULTS: Settings = {
  gain: 0.14,
  quiet: 0.18,
  loud: 0.62,
};

export const LIMITS: Record<keyof Settings, { min: number; max: number; step: number }> = {
  gain: { min: 0.02, max: 0.6, step: 0.005 },
  quiet: { min: 0.02, max: 0.9, step: 0.01 },
  loud: { min: 0.1, max: 1, step: 0.01 },
};

export const settings: Settings = { ...DEFAULTS };

const KEY = 'deskarium.settings';

export function clampSetting(k: keyof Settings, v: number): number {
  const l = LIMITS[k];
  return Math.min(l.max, Math.max(l.min, v));
}

/** `quiet` below `loud` is an invariant, not a preference: the band
    between them is what a held sound lives in, and inverting them
    would silently delete the summon. */
function order(): void {
  if (settings.quiet >= settings.loud) {
    settings.quiet = clampSetting('quiet', settings.loud - LIMITS.quiet.step);
  }
}

export function setSetting(k: keyof Settings, v: number): void {
  settings[k] = clampSetting(k, v);
  order();
  save();
}

export function resetSetting(k: keyof Settings): void {
  settings[k] = DEFAULTS[k];
  order();
  save();
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A kiosk with storage disabled still runs; it just forgets.
  }
}

/** Read once at boot. Unknown or malformed values fall back to the
    default for that key alone, so one bad number cannot wipe the rest. */
export function loadSettings(): void {
  let raw: unknown;
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return;
    raw = JSON.parse(s);
  } catch {
    return;
  }
  if (!raw || typeof raw !== 'object') return;
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) settings[k] = clampSetting(k, v);
  }
  order();
}
