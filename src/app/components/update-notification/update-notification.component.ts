import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Increment this number whenever you want to show the update notification again
export const CURRENT_UPDATE_VERSION = 1;

export interface ChangeItem {
    text: string;
    link?: string; // Internal route link
}

export interface ChangeCategory {
    category: 'major' | 'minor' | 'bugfix';
    label: string;
    icon: string;
    color: string;
    items: ChangeItem[];
}

export interface UpdateEntry {
    title: string;
    date?: string;
    categories: ChangeCategory[];
}

// Define your updates here - newest first
export const UPDATE_LOG: UpdateEntry[] = [
    {
        title: 'January 2026 Update',
        date: '2026-01-04',
        categories: [
            {
                category: 'major',
                label: 'Major Changes',
                icon: 'star',
                color: '#ffc107',
                items: [
                    {
                        text: 'New statistic for Team Trials, including new filters for scenarios',
                        link: '/tools/statistics'
                    },
                ]
            },
            {
                category: 'minor',
                label: 'Minor Changes',
                icon: 'add_circle',
                color: '#64b5f6',
                items: [
                    {
                        text: 'Added filter for total star count in inheritance',
                        link: '/database?filters=eyJic3MiOjl9'
                    },
                    { text: 'Improved active filter chip display' },
                    { text: 'Made filter UI more compact and responsive' },
                    { text: 'Improved mobile filtering for statistics page' },
                ]
            },
            {
                category: 'bugfix',
                label: 'Bug Fixes',
                icon: 'bug_report',
                color: '#4caf50',
                items: [
                    { text: 'Fixed filter changes not updating results immediately' },
                    { text: 'Fixed number inputs only updating on blur instead whiles typing' },
                    { text: 'Fixed min white count not being saved in URL/shareable links' },
                    { text: 'Fixed main white filter chip not being removable via active filters' },
                    { text: 'Fixed active filter chips vertical alignment issues' },
                    { text: 'Fixed filter state not syncing properly between components' },
                    { text: 'Fixed min main white count filter not being applied to result count query' },
                    { text: 'Fixed result count cache returning stale counts for different filter combinations' },
                    { text: 'Fixed optional white factor filtering breaking search with non-affinity sort orders' },
                    { text: 'Fixed sort being ignored when using optional white factor scoring' },
                ]
            }
        ]
    }
];

@Component({
    selector: 'app-update-notification',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    template: `
    <div class="update-popup-container">
      <div class="popup-header">
        <mat-icon class="header-icon">auto_awesome</mat-icon>
        <h2>What's New</h2>
        <span class="header-date" *ngIf="updates[0]?.date">{{ formatDate(updates[0].date!) }}</span>
      </div>

      <div class="discord-notice">
        <div class="discord-content">
          <mat-icon class="discord-icon">forum</mat-icon>
          <p>
            Have feedback or found a bug? Join our Discord!
          </p>
        </div>
        <a href="https://discord.uma.moe/" target="_blank" class="discord-button">
          <mat-icon>open_in_new</mat-icon>
          Join Discord
        </a>
      </div>

      <div class="popup-content">
        <div class="category-section" *ngFor="let cat of updates[0]?.categories">
          <div class="category-header" [style.borderColor]="getCategoryBg(cat.color, 0.3)">
            <mat-icon [style.color]="cat.color">{{ cat.icon }}</mat-icon>
            <span>{{ cat.label }}</span>
          </div>
          
          <div class="feature-list" [style.background]="getCategoryBg(cat.color, 0.05)" 
               [style.borderColor]="getCategoryBg(cat.color, 0.1)">
            <div class="feature-item" *ngFor="let item of cat.items">
              <mat-icon class="feature-icon" [style.color]="cat.color">
                {{ cat.category === 'bugfix' ? 'check_circle' : cat.category === 'major' ? 'star' : 'add_circle' }}
              </mat-icon>
              <span>{{ item.text }}</span>
              <a *ngIf="item.link" [href]="item.link" (click)="dismiss()" class="feature-link">
                <mat-icon>arrow_outward</mat-icon>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="popup-actions">
        <button mat-flat-button class="btn-dismiss" (click)="dismiss()">
          Dismiss
        </button>
      </div>
    </div>
  `,
    styles: [`
    .update-popup-container {
      background: #1e1e1e;
      padding: 1.25rem 1.5rem;
      color: #e0e0e0;
      position: relative;
      border-radius: 8px;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12);
      max-height: 85vh;
      max-width: min(620px, calc(100vw - 32px));
      width: 100%;
      display: flex;
      flex-direction: column;

      // Accent gradient border at the top
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #ffc107, #64b5f6, #4caf50);
        opacity: 0.9;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      
      // Responsive adjustments
      @media (max-width: 640px) {
        padding: 1rem;
        border-radius: 12px;
        
        &::after {
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
        }
      }
    }

    .popup-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;

      .header-icon {
        color: #ffc107;
        font-size: 1.5rem;
        width: 1.5rem;
        height: 1.5rem;
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #fff;
        flex: 1;
      }

      .header-date {
        font-size: 0.8rem;
        color: #9e9e9e;
        background: rgba(255, 255, 255, 0.08);
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
      }
    }

    .popup-content {
      margin-bottom: 1rem;
      overflow-y: auto;
      flex: 1;
      padding-right: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;

      // Custom scrollbar
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        
        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }

    .category-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #bdbdbd;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      mat-icon {
        font-size: 1.1rem;
        width: 1.1rem;
        height: 1.1rem;
      }
    }

    .feature-list {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .feature-icon {
        font-size: 0.9rem;
        width: 0.9rem;
        height: 0.9rem;
        flex-shrink: 0;
      }

      span {
        font-size: 0.85rem;
        font-weight: 500;
        color: #f5f5f5;
        flex: 1;
        line-height: 1.35;
      }

      .feature-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 5px;
        background: rgba(100, 181, 246, 0.15);
        color: #64b5f6;
        text-decoration: none;
        transition: all 0.2s;
        flex-shrink: 0;

        mat-icon {
          font-size: 0.85rem;
          width: 0.85rem;
          height: 0.85rem;
        }

        &:hover {
          background: rgba(100, 181, 246, 0.25);
          transform: translate(2px, -2px);
        }
      }
    }

    .discord-notice {
      display: flex;
      gap: 1rem;
      padding: 0.85rem 1rem;
      background: rgba(88, 101, 242, 0.12);
      border-radius: 8px;
      border: 1px solid rgba(88, 101, 242, 0.25);
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      flex-shrink: 0;
      flex-wrap: wrap;

      @media (max-width: 480px) {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }

      .discord-content {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .discord-icon {
        color: #5865F2;
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: #e0e0e0;
        line-height: 1.4;
      }

      .discord-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: #5865F2;
        color: #fff;
        border-radius: 6px;
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s;
        flex-shrink: 0;

        mat-icon {
          font-size: 1rem;
          width: 1rem;
          height: 1rem;
        }
        
        &:hover {
          background: #4752c4;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(88, 101, 242, 0.4);
        }
      }
    }

    .popup-actions {
      display: flex;
      justify-content: center;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);

      .btn-dismiss {
        min-width: 120px;
        height: 36px;
        border-radius: 18px;
        font-weight: 600;
        font-size: 0.8rem;
        background: linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%);
        color: #fff;
        border: none;
        transition: all 0.2s;
        box-shadow: 0 3px 10px rgba(100, 181, 246, 0.3);

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(100, 181, 246, 0.4);
          filter: brightness(1.1);
        }
      }
    }
  `]
})
export class UpdateNotificationComponent implements OnInit {
    updates = UPDATE_LOG;

    constructor(private dialogRef: MatDialogRef<UpdateNotificationComponent>) { }

    ngOnInit() { }

    formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    getCategoryBg(color: string, opacity: number = 0.15): string {
        // Convert hex color to rgba with specified opacity
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    dismiss() {
        // Save the current version to localStorage
        localStorage.setItem('lastSeenUpdateVersion', CURRENT_UPDATE_VERSION.toString());
        this.dialogRef.close();
    }
}
