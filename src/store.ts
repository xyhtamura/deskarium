/* Display snapshot bridge.
   ---------------------------------------------------------------
   The tank mutates 30x a second. React must never see that. The loop
   publishes a small immutable snapshot twice a second and the overlay
   subscribes to it — so React renders 2 times a second, not 30. */

import { useSyncExternalStore } from 'react';

export interface Snapshot {
  fps: number;
  cells: number;
  rms: number;
  floor: number;
  level: number;
  centroid: number;
  bright: number;
  flux: number;
  speaking: boolean;
  silenceMs: number;
}

let snapshot: Snapshot = {
  fps: 0,
  cells: 0,
  rms: 0,
  floor: 0,
  level: 0,
  centroid: 0,
  bright: 0,
  flux: 0,
  speaking: false,
  silenceMs: 0,
};

const subscribers = new Set<() => void>();

export function publish(next: Snapshot): void {
  snapshot = next;
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

export function useTankSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
