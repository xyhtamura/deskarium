/* Audio graph.
   ---------------------------------------------------------------
   Two rules carried over from iris-vibecoded, both load-bearing:

   1. The microphone analyser is NEVER connected to destination.
      There is no feedback path from mic to speaker at all.
   2. Our own output runs through a second analyser on the way to
      the speakers, so the tank can react to the sounds it makes
      and so the mic threshold can be ducked by our known output.

   initAudio() must be called from inside a user gesture — the
   AudioContext starts suspended. On this hardware the gesture is a
   keypress, which counts as user activation in Chromium. */

export interface AudioRig {
  ctx: AudioContext;
  stream: MediaStream | null;
  /** Null when the microphone was refused. The tank still runs. */
  mic: AnalyserNode | null;
  micError: string | null;
  out: GainNode;
  outAnalyser: AnalyserNode;
}

let rig: AudioRig | null = null;

export function getRig(): AudioRig | null {
  return rig;
}

export async function initAudio(): Promise<AudioRig> {
  if (rig) return rig;

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  await ctx.resume();
  unlockAudio(ctx);

  // A refused microphone is not fatal. The tank is a screensaver first —
  // it has to be watchable in silence anyway, so it runs deaf rather than
  // not at all, and says so.
  let stream: MediaStream | null = null;
  let mic: AnalyserNode | null = null;
  let micError: string | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const micSrc = ctx.createMediaStreamSource(stream);
    mic = ctx.createAnalyser();
    mic.fftSize = 1024;
    mic.smoothingTimeConstant = 0.5;
    micSrc.connect(mic);
    // deliberately not connected onward: no path from mic to speaker
  } catch (err) {
    micError = err instanceof Error ? err.message : String(err);
  }

  const out = ctx.createGain();
  out.gain.value = 0.6;
  const outAnalyser = ctx.createAnalyser();
  outAnalyser.fftSize = 1024;
  outAnalyser.smoothingTimeConstant = 0.6;
  out.connect(outAnalyser);
  outAnalyser.connect(ctx.destination);

  rig = { ctx, stream, mic, micError, out, outAnalyser };
  return rig;
}

/** A one-sample silent buffer inside the gesture flips the audio session on. */
function unlockAudio(ctx: AudioContext): void {
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* non-fatal */
  }
}
