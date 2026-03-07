import { Injectable, NgZone, OnDestroy } from '@angular/core';
/**
 * Singleton RAF scheduler.
 * All AnimatedNumberComponents register a tick callback here so that only
 * ONE requestAnimationFrame loop runs regardless of how many components are
 * animating simultaneously.
 */
@Injectable({ providedIn: 'root' })
export class AnimationSchedulerService implements OnDestroy {
  private callbacks = new Set<(ts: number) => void>();
  private rafId: number | null = null;
  constructor(private ngZone: NgZone) {}
  register(cb: (ts: number) => void): void {
    this.callbacks.add(cb);
    if (this.rafId === null) {
      this.ngZone.runOutsideAngular(() => this.loop());
    }
  }
  unregister(cb: (ts: number) => void): void {
    this.callbacks.delete(cb);
    if (this.callbacks.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  private loop(): void {
    this.rafId = requestAnimationFrame((ts) => {
      this.rafId = null;
      if (this.callbacks.size === 0) return;
      // Snapshot so callbacks can safely unregister themselves mid-loop
      for (const cb of Array.from(this.callbacks)) {
        cb(ts);
      }
      if (this.callbacks.size > 0) {
        this.loop();
      }
    });
  }
  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
