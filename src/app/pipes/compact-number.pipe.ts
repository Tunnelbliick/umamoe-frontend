import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'compactNumber',
  standalone: true
})
export class CompactNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, prefix: string = ''): string {
    if (value === null || value === undefined) return '-';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : prefix;
    if (abs >= 1_000_000_000) {
      return sign + (abs / 1_000_000_000).toFixed(2) + 'B';
    }
    if (abs >= 1_000_000) {
      return sign + (abs / 1_000_000).toFixed(1) + 'M';
    }
    if (abs >= 10_000) {
      return sign + (abs / 1_000).toFixed(1) + 'K';
    }
    return sign + abs.toLocaleString();
  }
}
