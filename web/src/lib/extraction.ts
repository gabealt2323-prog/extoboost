import { api } from './api';

interface ExtractionResult {
  apiKey: string | null;
  code: string | null;
  unlocked: boolean;
  unlockedUntil: string | null;
}

class KeyExtractor {
  private apiKey: string | null = null;
  private code: string | null = null;
  private unlocked: boolean = false;
  private unlockedUntil: string | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(result: ExtractionResult) => void> = [];

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('ks:apikey', ((e: CustomEvent) => {
      this.apiKey = e.detail.apiKey;
      localStorage.setItem('ks_apiKey', e.detail.apiKey);
      this.notify();
    }) as EventListener);

    window.addEventListener('ks:code', ((e: CustomEvent) => {
      this.code = e.detail.code;
      this.notify();
    }) as EventListener);

    window.addEventListener('ks:unlocked', ((e: CustomEvent) => {
      this.unlocked = true;
      this.unlockedUntil = e.detail.unlockedUntil;
      this.stopPolling();
      this.notify();
    }) as EventListener);

    this.restoreFromStorage();
  }

  private restoreFromStorage() {
    const stored = localStorage.getItem('ks_apiKey');
    if (stored) this.apiKey = stored;
  }

  private notify() {
    const result = this.getResult();
    this.listeners.forEach((fn) => fn(result));
  }

  getResult(): ExtractionResult {
    return {
      apiKey: this.apiKey,
      code: this.code,
      unlocked: this.unlocked,
      unlockedUntil: this.unlockedUntil,
    };
  }

  startPolling(intervalMs: number = 5000) {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      try {
        const status = await api.getValidationStatus();
        if (status.unlocked) {
          this.unlocked = true;
          this.unlockedUntil = status.unlockedUntil;
          if (status.code) this.code = status.code;
          this.stopPolling();
          this.notify();
        }
      } catch {
        // continue polling
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(fn: (result: ExtractionResult) => void) {
    this.listeners.push(fn);
    fn(this.getResult());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  getApiKey(): string | null {
    return this.apiKey || localStorage.getItem('ks_apiKey');
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}

export const keyExtractor = typeof window !== 'undefined' ? new KeyExtractor() : null;

export function extractApiKey(): string | null {
  return keyExtractor?.getApiKey() ?? null;
}

export function pollValidation(callback: (result: ExtractionResult) => void) {
  return keyExtractor?.subscribe(callback) ?? (() => {});
}
