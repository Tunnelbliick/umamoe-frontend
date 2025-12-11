import { Pipe, PipeTransform } from '@angular/core';
import { FactorService, SparkInfo } from '../services/factor.service';

@Pipe({
  name: 'resolveSparks',
  standalone: true
})
export class ResolveSparksPipe implements PipeTransform {
  constructor(private factorService: FactorService) {}

  transform(sparkIds: number[] | undefined | null): SparkInfo[] {
    if (!sparkIds || sparkIds.length === 0) {
      return [];
    }
    return this.factorService.resolveSparks(sparkIds);
  }
}
