import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Observable, startWith, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CharacterService } from '../../services/character.service';
import { Character } from '../../models/character.model';
@Component({
  selector: 'app-character-select-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
  ],
  template: `
    <div class="select-dialog" [class.mode-include]="mode === 'include'" [class.mode-exclude]="mode === 'exclude'">
      <div class="select-header">
        <mat-icon class="select-header-icon">{{ mode === 'exclude' ? 'person_remove' : mode === 'include' ? 'person_add' : 'person_search' }}</mat-icon>
        <span class="select-header-title">{{ multiSelect ? (mode === 'exclude' ? 'Exclude Characters' : mode === 'include' ? 'Include Characters' : 'Select Characters') : 'Select Character' }}</span>
        <span class="selected-count" *ngIf="multiSelect && selectedCharacters.length > 0">
          {{ selectedCharacters.length }} selected
        </span>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-dialog-content class="select-body">
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            [formControl]="searchControl"
            placeholder="Search by name..."
            class="search-input"
          />
          <mat-icon *ngIf="searchControl.value" class="clear-icon" (click)="searchControl.setValue('')">close</mat-icon>
        </div>
        <div class="character-grid">
          <div
            *ngFor="let character of filteredCharacters | async"
            class="char-card"
            [class.selected]="isSelected(character)"
            (click)="selectCharacter(character)"
          >
            <div class="char-avatar">
              <img
                [src]="getCharacterImagePath(character.image)"
                [alt]="character.name"
                loading="lazy"
              />
              <div class="check-overlay" *ngIf="multiSelect && isSelected(character)">
                <mat-icon>{{ mode === 'exclude' ? 'close' : 'check' }}</mat-icon>
              </div>
            </div>
            <span class="char-name">{{ character.name }}</span>
          </div>
        </div>
      </mat-dialog-content>
      <div class="select-footer" *ngIf="multiSelect">
        <button class="confirm-btn" (click)="confirmSelection()" [disabled]="selectedCharacters.length === 0">
          <mat-icon>check</mat-icon>
          Add {{ selectedCharacters.length }} Character{{ selectedCharacters.length !== 1 ? 's' : '' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .select-dialog {
        display: flex;
        flex-direction: column;
        max-height: 80vh;
        background: #141414;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
        color: #e0e0e0;
        width: 100%;
      }
      .select-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: #1a1a1a;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
        .select-header-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #64b5f6;
        }
        .select-header-title {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }
        .close-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
          ::ng-deep .mat-mdc-button-touch-target {
            width: 32px;
            height: 32px;
          }
          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            margin: 0;
          }
          &:hover {
            color: rgba(255, 255, 255, 0.8);
            background: rgba(255, 255, 255, 0.06);
          }
        }
      }
      .select-body {
        padding: 12px !important;
        margin: 0;
        background: #141414;
        overflow-y: auto;
        flex: 1;
        max-height: none;
        &::-webkit-scrollbar {
          width: 6px;
        }
        
        &::-webkit-scrollbar-track {
          background: transparent;
        }
        
        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 3px;
          
          &:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        }
      }
      .search-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        margin-bottom: 16px;
        transition: all 0.2s;
        &:focus-within {
          border-color: rgba(100, 181, 246, 0.4);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.08);
        }
        .search-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: rgba(255, 255, 255, 0.3);
          flex-shrink: 0;
        }
        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          padding: 4px 0;
          &::placeholder {
            color: rgba(255, 255, 255, 0.25);
          }
        }
        .clear-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          flex-shrink: 0;
          &:hover {
            color: rgba(255, 255, 255, 0.6);
          }
        }
      }
      .character-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 4px;
      }
      .char-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        padding: 8px 4px 6px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        &:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(100, 181, 246, 0.3);
          .char-avatar img {
            transform: scale(1.15);
          }
        }
        &.selected {
          background: rgba(100, 181, 246, 0.08);
          border-color: rgba(100, 181, 246, 0.4);
          .char-avatar {
            border-color: rgba(100, 181, 246, 0.6);
          }
          .char-name {
            color: rgba(255, 255, 255, 0.9);
          }
        }
        &:active {
          transform: scale(0.97);
        }
        .char-avatar {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
          position: relative;
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.2s ease;
          }
          .check-overlay {
            position: absolute;
            inset: 0;
            background: rgba(33, 150, 243, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            mat-icon {
              font-size: 24px;
              width: 24px;
              height: 24px;
              color: white;
            }
          }
        }
        .char-name {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          line-height: 1.3;
          word-break: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
      }
      @media (max-width: 600px) {
        .select-dialog {
          min-width: auto;
          max-width: 100%;
          max-height: calc(100vh - 48px);
          border-radius: 12px;
        }
        .select-body {
          padding: 8px !important;
        }
        .character-grid {
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 2px;
        }
        .char-card {
          padding: 6px 2px 5px;
          .char-avatar {
            width: 62px;
            height: 62px;
          }
          .char-name {
            font-size: 11px;
          }
        }
        .search-bar {
          margin-bottom: 10px;
        }
      }
      // Include mode theming
      .select-dialog.mode-include {
        .select-header {
          border-bottom-color: rgba(129, 199, 132, 0.2);
          .select-header-icon {
            color: #81c784;
          }
        }
        .selected-count {
          color: #81c784;
          background: rgba(129, 199, 132, 0.1);
        }
        .char-card.selected {
          background: rgba(129, 199, 132, 0.08);
          border-color: rgba(129, 199, 132, 0.4);
          .char-avatar {
            border-color: rgba(129, 199, 132, 0.6);
          }
        }
        .char-card:hover {
          border-color: rgba(129, 199, 132, 0.3);
        }
        .check-overlay {
          background: rgba(76, 175, 80, 0.5) !important;
        }
        .confirm-btn {
          background: #4caf50;
          &:hover {
            background: #43a047;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
          }
        }
        .search-bar:focus-within {
          border-color: rgba(129, 199, 132, 0.4);
          box-shadow: 0 0 0 3px rgba(129, 199, 132, 0.08);
        }
      }
      // Exclude mode theming
      .select-dialog.mode-exclude {
        .select-header {
          border-bottom-color: rgba(239, 83, 80, 0.2);
          .select-header-icon {
            color: #ef5350;
          }
        }
        .selected-count {
          color: #ef9a9a;
          background: rgba(244, 67, 54, 0.1);
        }
        .char-card.selected {
          background: rgba(244, 67, 54, 0.08);
          border-color: rgba(239, 83, 80, 0.4);
          .char-avatar {
            border-color: rgba(239, 83, 80, 0.6);
          }
        }
        .char-card:hover {
          border-color: rgba(239, 83, 80, 0.3);
        }
        .check-overlay {
          background: rgba(244, 67, 54, 0.5) !important;
        }
        .confirm-btn {
          background: #f44336;
          &:hover {
            background: #e53935;
            box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
          }
        }
        .search-bar:focus-within {
          border-color: rgba(239, 83, 80, 0.4);
          box-shadow: 0 0 0 3px rgba(239, 83, 80, 0.08);
        }
      }
      .selected-count {
        font-size: 12px;
        font-weight: 600;
        color: #64b5f6;
        background: rgba(100, 181, 246, 0.1);
        padding: 3px 10px;
        border-radius: 12px;
        margin-right: auto;
      }
      .select-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 12px 18px;
        background: #1a1a1a;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }
      .confirm-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 20px;
        border: none;
        border-radius: 8px;
        background: #2196f3;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
        &:hover {
          background: #1e88e5;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }
        &:disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
          box-shadow: none;
        }
      }
    `,
  ],
})
export class CharacterSelectDialogComponent implements OnInit {
  searchControl = new FormControl('');
  characters: Character[] = [];
  filteredCharacters!: Observable<Character[]>;
  multiSelect = false;
  selectedCharacters: Character[] = [];
  existingIds: number[] = [];
  mode: 'include' | 'exclude' | 'target' = 'target';
  constructor(
    private characterService: CharacterService,
    private dialogRef: MatDialogRef<CharacterSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.multiSelect = data.multiSelect || false;
      this.existingIds = data.existingIds || [];
      this.mode = data.mode || 'target';
    }
  }
  ngOnInit() {
    this.characterService
      .getReleasedCharacters()
      .subscribe((characters: Character[]) => {
        this.characters = characters; // <-- FIX: assign to this.characters
        if (!environment.production) {
        }
      });
    // Setup search filtering
    this.filteredCharacters = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterCharacters(value || ''))
    );
  }
  private _filterCharacters(value: string): Character[] {
    const filterValue = value.toLowerCase();
    return this.characters.filter(
      (character) =>
        character.name.toLowerCase().includes(filterValue) ||
        character.id.toString().includes(filterValue)
    );
  }
  selectCharacter(character: Character) {
    if (this.multiSelect) {
      const idx = this.selectedCharacters.findIndex(c => c.id === character.id);
      if (idx >= 0) {
        this.selectedCharacters.splice(idx, 1);
      } else {
        this.selectedCharacters.push(character);
      }
    } else {
      this.dialogRef.close(character);
    }
  }
  confirmSelection() {
    this.dialogRef.close(this.selectedCharacters);
  }
  isSelected(character: Character): boolean {
    return this.selectedCharacters.some(c => c.id === character.id) ||
           this.existingIds.includes(character.id);
  }
  close() {
    this.dialogRef.close();
  }
  getCharacterImagePath(imageName: string): string {
    return `assets/images/character_stand/${imageName}`;
  }
}
