import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
// Increment this number whenever you want to show the update notification again
export const CURRENT_UPDATE_VERSION = 5;
export interface ChangeItem {
    text: string;
    link?: string; // Internal route link
}
export interface ChangeCategory {
    category: 'major' | 'improvement' | 'minor' | 'bugfix';
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
        title: '🐴 Easter Update 🐇 Part 1',
        date: '2026-04-01',
        categories: [
            {
                category: 'major',
                label: 'Major Changes',
                icon: 'star',
                color: '#ffc107',
                items: [
                    { text: 'User logins - sign in to save and sync your data' },
                    {
                        text: 'Profile page - view your trainer stats, veterans, and more',
                        link: '/profile'
                    },
                    {
                        text: 'Veteran browser - browse, filter, and inspect your trained characters',
                        link: '/profile'
                    },
                ]
            },
            {
                category: 'improvement',
                label: 'Improvements',
                icon: 'upgrade',
                color: '#ff9800',
                items: [
                    { text: 'Search for parents with specific run races in the inheritance database' },
                    {
                        text: 'Spark splitting - click a parent to view their individual sparks',
                        link: '/database'
                    },
                ]
            },
            {
                category: 'minor',
                label: 'Minor Changes',
                icon: 'add_circle',
                color: '#64b5f6',
                items: [
                    { text: 'Infinite scroll replaces pagination in the veteran browser' },
                    { text: 'Updated rank badge color scheme' },
                    { text: 'Consistent race grade colors across all dialogs' },
                    { text: 'Added export instructions for veteran data upload' },
                    { text: 'Various layout and styling improvements' },
                ]
            },
        ]
    },
    {
        title: 'Timeline Improvements & Predictions',
        date: '2026-03-01',
        categories: [
            {
                category: 'improvement',
                label: 'Improvements',
                icon: 'upgrade',
                color: '#ff9800',
                items: [
                    { text: 'Improved the timeline\'s prediction algorithm to provide much stabler output for future event dates based on recent official announcements.' },
                    { text: 'Added layout adjustments to better account for uneven prediction gaps like dead weeks.' }
                ]
            }
        ]
    },
    {
        title: 'February 2026 Update',
        date: '2026-02-15',
        categories: [
            {
                category: 'major',
                label: 'Major Changes',
                icon: 'star',
                color: '#ffc107',
                items: [
                    {
                        text: 'New Trainer Rankings page - monthly, all-time, and recent gain leaderboards',
                        link: '/rankings'
                    },
                ]
            },
            {
                category: 'improvement',
                label: 'Improvements',
                icon: 'upgrade',
                color: '#ff9800',
                items: [
                    {
                        text: 'Added include/exclude character filters for main parents and grandparents',
                        link: '/database'
                    },
                    { text: 'Adjusted selection dialogs to match site design' },
                    { text: 'Improved mobile responsive layout for inheritance filters' },
                    {
                        text: 'Circle calendar view, daily gain graph, and row display mode',
                        link: '/circles'
                    },
                ]
            },
            {
                category: 'minor',
                label: 'Minor Changes',
                icon: 'add_circle',
                color: '#64b5f6',
                items: [
                    { text: 'Rankings support sorting by various metrics across all-time and recent gains tabs' },
                    { text: 'Rankings show circle affiliation with link to club page' },
                    { text: 'Responsive mobile layout with compact number formatting for rankings' },
                    { text: 'Include prior circle fans in progression data' },
                    {
                        text: 'Max followers indicator in inheritance database',
                        link: '/database'
                    },
                ]
            },
        ]
    },
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
    <div class="update-dialog-container">
      <div class="dialog-header">
        <mat-icon class="header-icon">auto_awesome</mat-icon>
        <span class="header-title">{{ updates[0]?.title || fallbackTitle }}</span>
        <span class="header-date" *ngIf="updates[0]?.date">{{ formatDate(updates[0].date!) }}</span>
        <button class="close-btn" (click)="dismiss()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="discord-banner">
        <mat-icon class="discord-icon">forum</mat-icon>
        <span>Have feedback or found a bug? Join our Discord!</span>
        <a href="https://discord.uma.moe/" target="_blank" class="discord-link">
          <mat-icon>open_in_new</mat-icon>
          Join
        </a>
      </div>
      <div class="dialog-body">
        <div class="category-section" *ngFor="let cat of updates[0]?.categories">
          <div class="category-label">
            <mat-icon [style.color]="cat.color">{{ cat.icon }}</mat-icon>
            <span>{{ cat.label }}</span>
          </div>
          
          <div class="category-items" [style.background]="getCategoryBg(cat.color, 0.04)" 
               [style.borderColor]="getCategoryBg(cat.color, 0.08)">
            <div class="item-row" *ngFor="let item of cat.items">
              <mat-icon class="item-icon" [style.color]="cat.color">
                {{ cat.category === 'bugfix' ? 'check_circle' : cat.category === 'major' ? 'star' : cat.category === 'improvement' ? 'upgrade' : 'add_circle' }}
              </mat-icon>
              <span>{{ item.text }}</span>
              <a *ngIf="item.link" [href]="item.link" (click)="dismiss()" class="item-link">
                <mat-icon>arrow_outward</mat-icon>
              </a>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="dismiss-btn" (click)="dismiss()">
          Dismiss
        </button>
      </div>
    </div>
  `,
    styles: [`
    .update-dialog-container {
      background: #1e1e1e;
      border-radius: 12px;
      width: 580px;
      max-width: calc(100vw - 16px);
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      box-sizing: border-box;
      @media (max-width: 640px) {
        width: calc(100vw - 16px);
      }
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 12px 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      .header-icon {
        color: #ffc107;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .header-title {
        font-size: 15px;
        font-weight: 600;
        color: #fff;
        flex: 1;
      }
      .header-date {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        background: rgba(255, 255, 255, 0.06);
        padding: 3px 8px;
        border-radius: 4px;
      }
      .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: all 0.15s;
        padding: 0;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
        &:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
      }
    }
    .discord-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: rgba(88, 101, 242, 0.08);
      border-bottom: 1px solid rgba(88, 101, 242, 0.15);
      flex-shrink: 0;
      .discord-icon {
        color: #5865F2;
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
      span {
        flex: 1;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      .discord-link {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        background: #5865F2;
        color: #fff;
        border-radius: 6px;
        text-decoration: none;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.15s;
        flex-shrink: 0;
        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
        
        &:hover {
          background: #4752c4;
        }
      }
      @media (max-width: 480px) {
        flex-wrap: wrap;
        span {
          flex-basis: calc(100% - 26px);
        }
        .discord-link {
          margin-left: 26px;
        }
      }
    }
    .dialog-body {
      padding: 12px 16px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      &::-webkit-scrollbar {
        width: 4px;
      }
      
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
        
        &:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      }
    }
    .category-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .category-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }
    .category-items {
      border-radius: 8px;
      padding: 4px 8px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
    }
    .item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 6px;
      border-radius: 6px;
      transition: background 0.15s;
      min-width: 0;
      &:hover {
        background: rgba(255, 255, 255, 0.04);
      }
      .item-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        flex-shrink: 0;
      }
      span {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        flex: 1;
        line-height: 1.35;
        min-width: 0;
        word-break: break-word;
      }
      .item-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        background: rgba(100, 181, 246, 0.12);
        color: #64b5f6;
        text-decoration: none;
        transition: all 0.15s;
        flex-shrink: 0;
        mat-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
        }
        &:hover {
          background: rgba(100, 181, 246, 0.22);
          transform: translate(1px, -1px);
        }
      }
    }
    .dialog-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: center;
      flex-shrink: 0;
      .dismiss-btn {
        height: 32px;
        padding: 0 28px;
        border-radius: 16px;
        border: none;
        background: rgba(100, 181, 246, 0.15);
        color: #64b5f6;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        &:hover {
          background: rgba(100, 181, 246, 0.25);
        }
      }
    }
  `]
})
export class UpdateNotificationComponent implements OnInit {
    updates = UPDATE_LOG;
    fallbackTitle = "What's New";
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
