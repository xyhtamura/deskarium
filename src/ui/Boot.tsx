/* Gesture gate.
   The AudioContext starts suspended and getUserMedia needs a user
   gesture. A keypress counts as user activation in Chromium, so the
   C button is the wake action — no pointer is needed anywhere. */

interface BootProps {
  error: string | null;
  starting: boolean;
  onWake?: () => void;
}

export default function Boot({ error, starting, onWake }: BootProps) {
  return (
    <div
      onClick={onWake}
      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 bg-[#061218] font-mono"
    >
      <div className="text-2xl tracking-[0.3em] text-[#7fd8e8]">DESKARIUM</div>
      <div className="text-base text-[#9fb6bd]">
        {starting ? 'opening microphone…' : 'press C, space, or click to begin'}
      </div>
      {error && (
        <div className="max-w-[80%] text-center text-sm text-[#d98a5a]">{error}</div>
      )}
    </div>
  );
}
