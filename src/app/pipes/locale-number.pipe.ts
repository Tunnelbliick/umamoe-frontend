import { Pipe, PipeTransform } from '@angular/core';

const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

@Pipe({
  name: 'localeNumber',
  standalone: true
})
export class LocaleNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, digits?: string): string {
    if (value === null || value === undefined) return '';
    if (digits === 'compact') {
      return compactFmt.format(value);
    }
    const options: Intl.NumberFormatOptions = {};
    if (digits) {
      // Parse Angular-style digit format: 'minInt.minFrac-maxFrac'
      const match = digits.match(/^(\d+)\.(\d+)-(\d+)$/);
      if (match) {
        options.minimumFractionDigits = parseInt(match[2], 10);
        options.maximumFractionDigits = parseInt(match[3], 10);
      }
    } else {
      options.maximumFractionDigits = 0;
    }
    return value.toLocaleString(undefined, options);
  }
}
