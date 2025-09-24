import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'trainerIdFormat',
  standalone: true
})
export class TrainerIdFormatPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    
    // Remove any existing spaces and format with gaps every 3 characters
    const cleanValue = value.replace(/\s/g, '');
    return cleanValue.replace(/(.{3})/g, '$1 ').trim();
  }
}
