import { create } from 'zustand';

interface ConnectivityState {
  /** A request failed to reach the server, or the browser went offline. */
  unreachable: boolean;
  set(unreachable: boolean): void;
}

export const useConnectivity = create<ConnectivityState>((set) => ({
  unreachable: false,
  set: (unreachable) => set((s) => (s.unreachable === unreachable ? s : { unreachable })),
}));
