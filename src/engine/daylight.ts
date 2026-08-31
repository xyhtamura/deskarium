/* What hour it is.
   ---------------------------------------------------------------
   The palette used to be driven by how long the room had been quiet,
   which was a metaphor — silence standing in for dusk. A window looks
   out at the actual light outside, so it now reads the clock instead.

   Silence keeps everything else it had: the fish still drift off, the
   crab still comes out, everything still slows down. Those are
   behaviours, and they were doing the real work. Only the colour moved
   to the clock.

   The override exists because the alternative is waiting until 03:00
   to find out whether the night bank is legible on the panel. It is
   bound to the R button, so it can be cycled on the device with no
   keyboard attached. */

import type { Mood } from '../render/palette';
import { MOODS } from '../render/palette';

let override: Mood | null = null;

export function getOverride(): Mood | null {
  return override;
}

export function setOverride(mood: Mood | null): void {
  override = mood;
}

/** auto -> dawn -> day -> dusk -> night -> auto */
export function cycleOverride(): Mood | null {
  if (override === null) override = MOODS[0];
  else {
    const next = MOODS.indexOf(override) + 1;
    override = next >= MOODS.length ? null : MOODS[next];
  }
  return override;
}

/* Boundaries are deliberately blunt. Real civil twilight moves with the
   date and the latitude, and none of that would be visible in four
   palettes — it would just be an almanac nobody can see. */
export function moodForHour(hour: number): Mood {
  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'night';
}

export function currentMood(now: Date = new Date()): Mood {
  if (override) return override;
  return moodForHour(now.getHours() + now.getMinutes() / 60);
}
