import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { RateLimitPopupComponent } from '../components/rate-limit-popup/rate-limit-popup.component';
@Injectable({
  providedIn: 'root'
})
export class RateLimitService {
  private dialogRef: MatDialogRef<RateLimitPopupComponent> | null = null;
  private lastShownTime = 0;
  private readonly COOLDOWN_MS = 10000; // Don't show popup more than once every 10 seconds
  constructor(private dialog: MatDialog) {}
  /**
   * Shows the rate limit popup if not already showing and cooldown has passed
   * @param retryAfter Optional retry-after header value in seconds
   */
  showRateLimitPopup(retryAfter?: number): void {
    const now = Date.now();
    
    // Don't show if already showing or if we recently showed it
    if (this.dialogRef || (now - this.lastShownTime < this.COOLDOWN_MS)) {
      return;
    }
    this.lastShownTime = now;
    
    this.dialogRef = this.dialog.open(RateLimitPopupComponent, {
      data: { retryAfter },
      panelClass: 'rate-limit-dialog',
      disableClose: false,
      autoFocus: false
    });
    this.dialogRef.afterClosed().subscribe(() => {
      this.dialogRef = null;
    });
  }
  /**
   * Closes the rate limit popup if it's open
   */
  closePopup(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = null;
    }
  }
}
