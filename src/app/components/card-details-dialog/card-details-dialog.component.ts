import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PrecomputedCardData } from '../../models/precomputed-tierlist.model';
import { CardHoverMenuComponent } from '../card-hover-menu/card-hover-menu.component';

@Component({
  selector: 'app-card-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    CardHoverMenuComponent
  ],
  template: `
    <div mat-dialog-content class="dialog-content">
      <app-card-hover-menu
        [card]="data.card"
        [isVisible]="true"
        [position]="{ x: 0, y: 0 }">
      </app-card-hover-menu>
    </div>
  `,
  styleUrls: ['./card-details-dialog.component.scss']
})
export class CardDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CardDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { card: PrecomputedCardData }
  ) {}
}
