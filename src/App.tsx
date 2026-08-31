import { useCallback, useEffect, useRef, useState } from 'react';
import { startLoop } from './engine/loop';
import { initAudio } from './audio/engine';
import { bindKeys } from './input/keys';
import { cycleOverride } from './engine/daylight';
import Boot from './ui/Boot';
import Overlay from './ui/Overlay';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [booted, setBooted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read by the frame loop each frame; kept in a ref so toggling it
  // never re-renders anything.
  const readoutRef = useRef(true);
  const [overlay, setOverlay] = useState(false);

  const wake = useCallback(async () => {
    if (booted || starting) return;
    setStarting(true);
    setError(null);
    try {
      const rig = await initAudio();
      // A refused microphone leaves the tank deaf, not stopped.
      if (rig.micError) setError('no microphone: ' + rig.micError);
      setBooted(true);
    } catch (err) {
      setError('audio failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setStarting(false);
    }
  }, [booted, starting]);

  // Panel buttons. C wakes, R cycles the palette; the rest are reserved.
  useEffect(() => {
    return bindKeys((button) => {
      if (button === 'C') void wake();
      // Cycling on the device beats waiting until 03:00 to find out
      // whether the night bank is legible on the panel.
      if (button === 'R') cycleOverride();
    });
  }, [wake]);

  // Development toggles, not part of the panel control surface.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'd') setOverlay((v) => !v);
      if (e.key === 'r') readoutRef.current = !readoutRef.current;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The simulation. Started once, torn down on unmount. startLoop
  // guards against StrictMode's double mount on its own.
  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startLoop(canvas, { showReadout: () => readoutRef.current });
  }, [booted]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#061218]">
      <canvas ref={canvasRef} className={booted ? '' : 'invisible'} />
      {!booted && <Boot error={error} starting={starting} onWake={wake} />}
      {booted && error && (
        <div className="pointer-events-none absolute right-1 bottom-1 font-mono text-[11px] text-[#d98a5a]/80">
          {error}
        </div>
      )}
      {booted && overlay && <Overlay />}
    </div>
  );
}
