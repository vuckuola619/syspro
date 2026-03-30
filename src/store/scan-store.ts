import { create } from 'zustand'

export interface ScanState {
  junkMb: number;
  junkCount: number;
  registryIssues: number;
  privacyIssues: number;
  diskHealthScore: number;
  lastScanned: Record<string, number>;
  setJunkResults: (mb: number, count: number) => void;
  setRegistryResults: (issues: number) => void;
  setPrivacyResults: (issues: number) => void;
  setDiskHealth: (score: number) => void;
  clearResults: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  junkMb: 0,
  junkCount: 0,
  registryIssues: 0,
  privacyIssues: 0,
  diskHealthScore: 100,
  lastScanned: {},
  setJunkResults: (mb, count) => set((state) => ({ junkMb: mb, junkCount: count, lastScanned: { ...state.lastScanned, junk: Date.now() } })),
  setRegistryResults: (issues) => set((state) => ({ registryIssues: issues, lastScanned: { ...state.lastScanned, registry: Date.now() } })),
  setPrivacyResults: (issues) => set((state) => ({ privacyIssues: issues, lastScanned: { ...state.lastScanned, privacy: Date.now() } })),
  setDiskHealth: (score) => set((state) => ({ diskHealthScore: score, lastScanned: { ...state.lastScanned, disk: Date.now() } })),
  clearResults: () => set({ junkMb: 0, junkCount: 0, registryIssues: 0, privacyIssues: 0, lastScanned: {} }),
}))
