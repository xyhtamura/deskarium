/* Gesture gate.
   The AudioContext starts suspended and getUserMedia needs a user
   gesture. A keypress counts as user activation in Chromium, so the
   C button is the wake action — no pointer is needed anywhere.

   Colours are read out of the palette rather than written here, so
   retuning a bank cannot leave the boot screen behind on the old one.
   The pre-mount background in index.css is the one copy that cannot
   be sourced this way — it has to exist before any of this runs. */

import { PALETTE, BANK, BANK_BG, A } from '../render/palette';

const DARK = {
  bg: '#061218',
  title: '#7fd8e8',
  sub: '#9fb6bd',
};

const LIGHT = {
  bg: BANK_BG.day,
  title: PALETTE[BANK.day + A.FISH].fg,
  sub: PALETTE[BANK.day + A.UI].fg,
};

interface BootProps {
  error: string | null;
  starting: boolean;
  onWake?: () => void;
  light?: boolean;
}

export default function Boot({ error, starting, onWake, light }: BootProps) {
  const c = light ? LIGHT : DARK;

  return (
    <div
      onClick={onWake}
      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 font-mono"
      style={{ background: c.bg }}
    >
      <div className="text-2xl tracking-[0.3em]" style={{ color: c.title }}>
        DESKARIUM
      </div>
      <div className="text-base" style={{ color: c.sub }}>
        {starting ? 'opening microphone…' : 'press C, space, or click to begin'}
      </div>
      {error && (
        <div className="max-w-[80%] text-center text-sm text-[#d98a5a]">{error}</div>
      )}
    </div>
  );
}
