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
    <div class="character-select-dialog">
      <h2 mat-dialog-title>Select Uma</h2>

      <mat-dialog-content class="dialog-content">
        <div class="search-section">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Characters</mat-label>
            <input
              matInput
              [formControl]="searchControl"
              placeholder="Search by name..."
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>

        <div class="characters-list">
          <div
            *ngFor="let character of filteredCharacters | async"
            class="character-item"
            (click)="selectCharacter(character)"
          >
            <div class="character-image">
              <img
                [src]="getCharacterImagePath(character.image)"
                [alt]="character.name"
                class="character-avatar"
                loading="lazy"
              />
            </div>
            <div class="character-name">{{ character.name }}</div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-stroked-button color="primary" (click)="close()">Cancel</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .character-select-dialog {
        min-width: 500px;
        max-width: 90vw;
        max-height: 80vh;
        background: #1a1a1a;
        color: #fff;
      }

      .dialog-content {
        max-height: 60vh;
        overflow-y: auto;
        
        /* Custom scrollbar styling */
        &::-webkit-scrollbar {
          width: 8px;
        }
        
        &::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          
          &:hover {
            background: rgba(255, 255, 255, 0.5);
          }
        }
      }

      .search-section {
        margin-top: 5px;
        margin-bottom: 16px;
      }

      .characters-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
        padding: 8px 0;
      }

      .character-name {
        color: var(--text-primary);
        font-size: 12px;
        text-align: center;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        height: 3.2em; /* Increased height for proper 2-line display */
        margin-top: 8px;
        padding: 0 4px;
        box-sizing: border-box;
      }

      .character-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        cursor: pointer;
        border: 2px solid var(--border-primary);
        padding: 12px 8px 8px 8px;
        transition: ease-in-out background-color 0.2s, border-color 0.2s, transform 0.2s;
        border-radius: 8px;
        height: 150px; /* Increased height to accommodate larger text area */
        box-sizing: border-box;

        &:hover {
          background-color: rgba(0, 0, 0, 0.1);
          border-color: var(--accent-primary);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 2px 4px var(--accent-primary);
          transform: translateY(-2px);
        }
      }

      .character-image {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        overflow: hidden;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
      }

      .character-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }

      .search-field {
        width: 100%;
      }

      .dialog-actions {
        padding: 16px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.02);
        
        button {
          min-width: 100px;
          font-weight: 500;
          border-radius: 8px;
          
          &:hover {
            background: rgba(255, 255, 255, 0.08);
          }
        }
      }

      mat-dialog-content {
        margin: 1rem;
      }

      /* Remove input background */
      ::ng-deep .mat-mdc-form-field {
        .mat-mdc-text-field-wrapper {
          background-color: transparent !important;
        }
        
        .mdc-text-field--outlined {
          background-color: transparent !important;
        }
        
        .mdc-text-field {
          background-color: transparent !important;
        }
        
        .mat-mdc-form-field-focus-overlay {
          background-color: transparent !important;
        }
      }
      
      ::ng-deep .mat-mdc-dialog-title {
        color: #fff;
        font-weight: 600;
        font-size: 20px;
        margin-bottom: 16px;
      }

      /* Mobile responsive styles */
      @media (max-width: 768px) {
        .character-select-dialog {
          min-width: 90vw;
          max-width: 95vw;
          margin: 16px;
        }

        .characters-list {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
        }

        .character-item {
          height: 130px;
          padding: 8px 4px 4px 4px;
        }

        .character-image {
          width: 64px;
          height: 64px;
        }

        .character-name {
          font-size: 11px;
          height: 2.8em;
          margin-top: 6px;
          line-height: 1.25;
        }

        mat-dialog-content {
          margin: 0.5rem;
        }

        .dialog-actions {
          padding: 12px 16px;
        }
      }

      @media (max-width: 480px) {
        .character-select-dialog {
          min-width: 95vw;
          max-width: 98vw;
          margin: 8px;
        }

        .characters-list {
          grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
          gap: 6px;
        }

        .character-item {
          height: 120px;
          padding: 6px 3px 3px 3px;
        }

        .character-image {
          width: 56px;
          height: 56px;
        }

        .character-name {
          font-size: 10px;
          height: 2.6em;
          margin-top: 4px;
          line-height: 1.2;
        }
      }
    `,
  ],
})
export class CharacterSelectDialogComponent implements OnInit {
  searchControl = new FormControl('');
  characters: Character[] = [];
  filteredCharacters!: Observable<Character[]>;

  constructor(
    private characterService: CharacterService,
    private dialogRef: MatDialogRef<CharacterSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    this.characterService
      .getReleasedCharacters()
      .subscribe((characters: Character[]) => {
        this.characters = characters; // <-- FIX: assign to this.characters
        if (!environment.production) {
          console.log('Released characters loaded for dialog:', characters.length);
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
    this.dialogRef.close(character);
  }

  close() {
    this.dialogRef.close();
  }

  getCharacterImagePath(imageName: string): string {
    return `assets/images/character_stand/${imageName}`;
  }
}
