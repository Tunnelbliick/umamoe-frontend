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
    <div class="modern-dialog-container">
      <div class="dialog-header">
        <div class="header-icon-wrapper">
          <mat-icon class="header-icon">face</mat-icon>
        </div>
        <div class="header-text">
          <h2>Select Uma</h2>
          <p>Choose a character to filter by</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="search-section">
          <mat-form-field appearance="fill" class="modern-input">
            <mat-label>Search Characters</mat-label>
            <input
              matInput
              [formControl]="searchControl"
              placeholder="Search by name..."
            />
            <mat-icon matSuffix class="input-icon">search</mat-icon>
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

      <div class="dialog-actions">
        <button mat-stroked-button class="cancel-btn" (click)="close()">Cancel</button>
      </div>
    </div>
  `,
  styles: [
    `
      // Modern dark theme dialog styling
      .modern-dialog-container {
        width: 100%;
        min-width: 500px;
        max-width: 90vw;
        max-height: 85vh;
        background: #121212;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.8);
        color: #e0e0e0;
        display: flex;
        flex-direction: column;

        .dialog-header {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px;
          background: #1e1e1e;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;

          &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #2196f3, #81c784);
          }

          .header-icon-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #2196f3, #81c784);
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);

            .header-icon {
              font-size: 24px;
              width: 24px;
              height: 24px;
              color: white;
            }
          }

          .header-text {
            flex: 1;

            h2 {
              margin: 0 0 4px 0;
              font-size: 18px;
              font-weight: 600;
              color: #ffffff;
            }

            p {
              margin: 0;
              font-size: 14px;
              color: rgba(255, 255, 255, 0.6);
            }
          }
        }

        .dialog-content {
          padding: 24px !important;
          background: #121212;
          overflow-y: auto;
          flex: 1;
          margin: 0;
          max-height: none; // Let flexbox handle height

          /* Custom scrollbar styling */
          &::-webkit-scrollbar {
            width: 8px;
          }
          
          &::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }
          
          &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            
            &:hover {
              background: rgba(255, 255, 255, 0.3);
            }
          }
        }

        .search-section {
          margin-bottom: 20px;

          .modern-input {
            width: 100%;
            
            ::ng-deep .mat-mdc-text-field-wrapper {
              background-color: #1e1e1e !important;
              border-radius: 8px;
              padding: 0 12px;
            }

            ::ng-deep .mat-mdc-form-field-flex {
              align-items: center;
              padding: 0 12px;
            }

            ::ng-deep .mat-mdc-form-field-underline {
              display: none;
            }
            
            ::ng-deep .mdc-line-ripple {
              display: none;
            }

            .input-icon {
              color: rgba(255, 255, 255, 0.5);
            }
          }
        }

        .characters-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 12px;
          padding-bottom: 8px;
        }

        .character-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          background: #1e1e1e;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px 8px;
          border-radius: 12px;
          transition: all 0.2s ease;
          height: 100%;

          &:hover {
            background: #2a2a2a;
            border-color: rgba(33, 150, 243, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }

          .character-image {
            width: 72px;
            height: 72px;
            border-radius: 12px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.2);
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

            .character-avatar {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
          }

          .character-name {
            color: #e0e0e0;
            font-size: 12px;
            font-weight: 500;
            text-align: center;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        }

        .dialog-actions {
          padding: 16px 24px;
          background: #121212;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: flex-end;
          flex-shrink: 0;
          
          button {
            height: 40px;
            padding: 0 24px;
            border-radius: 8px;
            font-weight: 500;
            
            &.cancel-btn {
              color: rgba(255, 255, 255, 0.7);
              border-color: rgba(255, 255, 255, 0.2);
              
              &:hover {
                background: rgba(255, 255, 255, 0.05);
                color: #ffffff;
              }
            }
          }
        }
      }

      // Mobile responsive
      @media (max-width: 600px) {
        .modern-dialog-container {
          min-width: auto;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          margin: 16px;

          .dialog-header {
            padding: 16px 20px;

            .header-icon-wrapper {
              width: 40px;
              height: 40px;
              
              .header-icon {
                font-size: 20px;
                width: 20px;
                height: 20px;
              }
            }

            .header-text {
              h2 { font-size: 16px; }
              p { font-size: 13px; }
            }
          }

          .dialog-content {
            padding: 16px !important;
          }

          .characters-list {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
            gap: 8px;
          }

          .character-item {
            padding: 10px 6px;
            
            .character-image {
              width: 60px;
              height: 60px;
            }
            
            .character-name {
              font-size: 11px;
            }
          }
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
