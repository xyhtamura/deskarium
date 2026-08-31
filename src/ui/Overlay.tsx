/* Debug overlay.
   Subscribes to the 2Hz snapshot, never to the tank. Toggled with `d`
   during development, same as iris-vibecoded. */

import { useTankSnapshot } from '../store';

export default function Overlay() {
  const s = useTankSnapshot();

  return (
    <div className="pointer-events-none absolute bottom-1 left-1 font-mono text-[11px] leading-tight text-[#9fb6bd]/70">
      <div>
        {s.fps} fps · {s.cells} cells
      </div>
      <div>
        rms {s.rms.toFixed(3)} · floor {s.floor.toFixed(3)} · lvl {s.level.toFixed(2)}
      </div>
      <div>
        bright {s.bright.toFixed(2)} · flux {s.flux.toFixed(3)} ·{' '}
        {s.speaking ? 'speaking' : `quiet ${(s.silenceMs / 1000).toFixed(0)}s`}
      </div>
    </div>
  );
}
