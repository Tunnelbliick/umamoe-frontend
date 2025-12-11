import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-christmas-update-popup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './christmas-update-popup.component.html',
  styleUrls: ['./christmas-update-popup.component.scss']
})
export class ChristmasUpdatePopupComponent {
  private readonly STORAGE_KEY = 'christmas_update_2025_seen';

  constructor(
    private themeService: ThemeService,
    private dialogRef: MatDialogRef<ChristmasUpdatePopupComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  dontShowAgain(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.dialogRef.close();
  }

  disableTheme(): void {
    this.themeService.setChristmasTheme(false);
  }
}
