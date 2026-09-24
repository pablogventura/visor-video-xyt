import { useSyncExternalStore } from 'react';
import { viewerStore } from './viewerStore';

export function useViewerStore() {
  return useSyncExternalStore(
    (listener) => viewerStore.subscribe(listener),
    () => viewerStore.getState(),
    () => viewerStore.getState(),
  );
}
