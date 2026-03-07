import {
  Component, Input, OnChanges, OnInit, OnDestroy,
  SimpleChanges, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { AnimationSchedulerService } from './animation-scheduler.service';
// Shared formatter — one instance for all components in the app.
const sharedFmt = new Intl.NumberFormat('en-US');
/**
 * Renders a number that smoothly counts from its previous value to the new one.
 * All instances share a single RAF loop via AnimationSchedulerService so that
 * animating hundreds of numbers simultaneously stays cheap.
 */
@Component({
  selector: 'app-animated-number',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline; }
    @keyframes num-flash {
      0%   { color: inherit; }
      15%  { color: #64b5f6; text-shadow: 0 0 8px rgba(100, 181, 246, 0.7); }
      60%  { color: #90caf9; text-shadow: none; }
      100% { color: inherit; }
    }
    :host.flashing {
      animation: num-flash 0.8s ease-out forwards;
    }
  `]
})
export class AnimatedNumberComponent implements OnInit, OnChanges, OnDestroy {
  /** The numeric value to display */
  @Input() value: number = 0;
  /** Text inserted before the number, e.g. "#" or "Rank #" */
  @Input() prefix: string = '';
  /** Text appended after the number, e.g. " Fans" */
  @Input() suffix: string = '';
  /** Prepend "+" for positive values */
  @Input() sign: boolean = false;
  /** Animation duration in ms */
  @Input() duration: number = 650;
  private from: number = 0;
  private to: number = 0;
  private current: number = 0;
  private startTime: number | null = null;
  private animating = false;
  private initialized = false;
  // Bound tick function — stable reference required for register/unregister.
  private readonly tick = (ts: number): void => {
    if (this.startTime === null) this.startTime = ts;
    const t = Math.min((ts - this.startTime) / this.duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    this.current = Math.round(this.from + (this.to - this.from) * eased);
    this.el.nativeElement.textContent = this.format(this.current);
    if (t >= 1) {
      this.current = this.to;
      this.el.nativeElement.textContent = this.format(this.current);
      this.el.nativeElement.classList.remove('flashing');
      this.stopAnimation();
    }
  };
  constructor(
    private el: ElementRef<HTMLElement>,
    private scheduler: AnimationSchedulerService
  ) {}
  ngOnInit(): void {
    if (!this.initialized) {
      this.from = this.to = this.current = Math.round(this.value ?? 0);
      this.el.nativeElement.textContent = this.format(this.current);
      this.initialized = true;
    }
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) return;
    if (!this.initialized) return; // ngOnInit handles first render
    const next = Math.round(changes['value'].currentValue ?? 0);
    if (next === this.to) return;
    this.from = this.current;
    this.to = next;
    this.startTime = null;
    // Trigger color flash
    const host = this.el.nativeElement;
    host.classList.remove('flashing');
    void host.offsetWidth; // force reflow to restart animation
    host.classList.add('flashing');
    if (!this.animating) {
      this.animating = true;
      this.scheduler.register(this.tick);
    }
  }
  ngOnDestroy(): void {
    this.stopAnimation();
  }
  private stopAnimation(): void {
    if (this.animating) {
      this.scheduler.unregister(this.tick);
      this.animating = false;
    }
  }
  private format(n: number): string {
    const abs = Math.abs(n);
    const formatted = sharedFmt.format(abs);
    let out = '';
    if (this.sign) {
      out = (n >= 0 ? '+' : '-') + formatted;
    } else {
      out = (n < 0 ? '-' : '') + formatted;
    }
    return this.prefix + out + this.suffix;
  }
}
