/* Utterance-level gate — the screensaver tier.
   ---------------------------------------------------------------
   Slow counterpart to features.ts. Where that answers "how loud right
   now", this answers "is someone talking" and "how long has it been
   quiet", which is what drives the slow mood swings: schooling,
   scattering, and the drift into night.

   Thresholds are iris-vibecoded's, measured on this hardware. */

import { features } from './features';

export const VAD_CONFIG = {
  /** RMS above the tracked floor that counts as voice. */
  speechDelta: 0.012,
  /** Silence that ends an utterance. */
  silenceMs: 1100,
  /** Shorter than this is a cough or a click, not speech. */
  minSpeechMs: 350,
  /** Quiet for this long and the tank goes to night. */
  nightAfterMs: 90_000,
};

export interface VadState {
  speaking: boolean;
  /** Continuous voiced time in the current utterance. */
  speechMs: number;
  /** Time since voice was last heard. */
  silenceMs: number;
  /** Set for one frame when an utterance of real length ends. */
  utteranceEnded: boolean;
}

export const vad: VadState = {
  speaking: false,
  speechMs: 0,
  silenceMs: 0,
  utteranceEnded: false,
};

export function updateVad(dt: number): void {
  vad.utteranceEnded = false;

  const voiced = features.rms > features.floor + VAD_CONFIG.speechDelta;

  if (voiced) {
    vad.silenceMs = 0;
    vad.speechMs += dt;
    if (!vad.speaking && vad.speechMs >= VAD_CONFIG.minSpeechMs) vad.speaking = true;
  } else {
    vad.silenceMs += dt;
    if (vad.speaking && vad.silenceMs > VAD_CONFIG.silenceMs) {
      vad.speaking = false;
      vad.utteranceEnded = vad.speechMs >= VAD_CONFIG.minSpeechMs;
      vad.speechMs = 0;
    }
    if (!vad.speaking) vad.speechMs = 0;
  }
}
