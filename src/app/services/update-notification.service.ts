import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UpdateNotificationComponent, CURRENT_UPDATE_VERSION } from '../components/update-notification/update-notification.component';
@Injectable({
  providedIn: 'root'
})
export class UpdateNotificationService {
  private readonly STORAGE_KEY = 'lastSeenUpdateVersion';
  constructor(private dialog: MatDialog) {}
  /**
   * Check if user needs to see the update notification and show it if necessary.
   * Call this from your app component or main layout on init.
   */
  checkAndShowUpdate(): void {
    const lastSeenVersion = this.getLastSeenVersion();
    
    if (lastSeenVersion < CURRENT_UPDATE_VERSION) {
      this.showUpdateDialog();
    }
  }
  /**
   * Force show the update dialog regardless of version.
   * Useful for a "What's New" menu item.
   */
  showUpdateDialog(): void {
    this.dialog.open(UpdateNotificationComponent, {
      panelClass: 'update-notification-dialog',
      maxWidth: '95vw',
      autoFocus: false
    });
  }
  /**
   * Get the last version the user has seen.
   */
  getLastSeenVersion(): number {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }
  /**
   * Mark the current version as seen.
   */
  markAsSeen(): void {
    localStorage.setItem(this.STORAGE_KEY, CURRENT_UPDATE_VERSION.toString());
  }
  /**
   * Reset to show the notification again (for testing).
   */
  reset(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
  /**
   * Check if there's a new update available.
   */
  hasNewUpdate(): boolean {
    return this.getLastSeenVersion() < CURRENT_UPDATE_VERSION;
  }
}
