import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, tap } from 'rxjs';

import { CircleService } from '../../services/circle.service';
import { Circle, CircleSearchFilters } from '../../models/circle.model';
import { DiscordLinkPipe } from '../../pipes/discord-link.pipe';

@Component({
  selector: 'app-circles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FormsModule,
    DiscordLinkPipe
  ],
  templateUrl: './circles.component.html',
  styleUrl: './circles.component.scss'
})
export class CirclesComponent implements OnInit, OnDestroy {
  protected Math = Math;
  circles: Circle[] = [];
  totalCircles = 0;
  loading = false;
  private isFirstLoad = true;
  
  filters: CircleSearchFilters = {
    page: 0,
    pageSize: 100,
    sortBy: 'rank',
    sortOrder: 'asc'
  };

  searchTerm = '';
  // searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private searchTimer: any;

  constructor(
    private circleService: CircleService,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    console.log('CirclesComponent initialized');
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      console.log('Route params changed:', params);
      
      // Parse page
      const pageParam = params['page'];
      this.filters.page = pageParam ? +pageParam : 0;
      
      // Parse pageSize
      const pageSizeParam = params['pageSize'];
      this.filters.pageSize = pageSizeParam ? +pageSizeParam : 100;
      
      // Handle query/name
      // Priority: query > name > nothing
      if (params['query']) {
        this.filters.query = params['query'];
        this.filters.name = undefined;
      } else if (params['name']) {
        this.filters.name = params['name'];
        this.filters.query = undefined;
      } else {
        this.filters.query = undefined;
        this.filters.name = undefined;
      }
      
      this.searchTerm = this.filters.query || this.filters.name || '';
      console.log('Filters updated:', this.filters);
      this.loadCircles();
    });
  }

  ngOnDestroy(): void {
    console.log('CirclesComponent destroyed');
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.circleService.listScrollPosition = window.scrollY;
  }

  loadCircles(): void {
    this.loading = true;
    console.log('Loading circles with filters:', this.filters);
    this.circleService.searchCircles(this.filters).subscribe({
      next: (result) => {
        this.circles = result.items;
        this.totalCircles = result.total;
        this.loading = false;

        if (this.isFirstLoad && this.circleService.listScrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo(0, this.circleService.listScrollPosition);
          }, 0);
        }
        this.isFirstLoad = false;
      },
      error: (err) => {
        console.error('Error loading circles', err);
        this.loading = false;
      }
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    console.log('Search input:', value);
    
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.ngZone.runOutsideAngular(() => {
      this.searchTimer = window.setTimeout(() => {
        this.ngZone.run(() => {
          console.log('Search timer fired:', value);
          const query = value && value.trim() ? value.trim() : null;
          
          this.updateQueryParams({ 
            query: query, 
            name: null, 
            page: 0 
          });
        });
      }, 300);
    });
  }

  onPageChange(event: PageEvent): void {
    this.updateQueryParams({
      page: event.pageIndex,
      pageSize: event.pageSize
    });
  }

  private updateQueryParams(params: any): void {
    const currentParams = this.route.snapshot.queryParams;
    const allParams = { ...currentParams, ...params };
    
    // Remove nulls/undefined/empty strings
    const finalParams: any = {};
    Object.keys(allParams).forEach(key => {
      if (allParams[key] !== null && allParams[key] !== undefined && allParams[key] !== '') {
        finalParams[key] = allParams[key];
      }
    });
    
    // Remove page if 0
    if (finalParams['page'] == 0) delete finalParams['page'];

    console.log('Navigating to /circles with:', finalParams);
    this.router.navigate(['/circles'], {
      queryParams: finalParams
    }).then(success => {
      console.log('Navigation success:', success);
    }).catch(err => {
      console.error('Navigation error:', err);
    });
  }
}
