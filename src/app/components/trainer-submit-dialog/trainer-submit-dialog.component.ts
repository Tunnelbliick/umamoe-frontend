import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
export interface TrainerSubmissionConfig {
  title: string;
  subtitle: string;
  submitEndpoint?: string; // Optional endpoint for custom submission
  onSubmit?: (trainerId: string) => Promise<boolean>; // Custom submit handler
}
@Component({
  selector: 'app-trainer-submit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="select-dialog">
      <div class="select-header">
        <mat-icon class="select-header-icon">share</mat-icon>
        <span class="select-header-title">{{ config.title }}</span>
        <button mat-icon-button class="close-btn" (click)="close()" [disabled]="isSubmitting">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-dialog-content class="select-body">
        <form [formGroup]="submissionForm" class="trainer-form">
          <div class="form-group">
            <div class="label-row">
              <label class="input-label">Trainer ID</label>
              <span class="digit-count mono" [class.complete]="getDigitCount() === 12">{{ getDigitCount() }} / 12</span>
            </div>
            <div class="custom-input-wrapper" [class.has-error]="submissionForm.get('trainerId')?.touched && submissionForm.get('trainerId')?.invalid">
              <mat-icon class="input-prefix-icon">badge</mat-icon>
              <input
                formControlName="trainerId"
                placeholder="123 456 789 012"
                (input)="formatTrainerId($event)"
                maxlength="15"
                autocomplete="off"
                inputmode="numeric"
                pattern="[0-9]*"
                class="custom-input"
              />
            </div>
          </div>
          <!-- Validation messages -->
          <div class="validation-messages" *ngIf="submissionForm.get('trainerId')?.touched">
            <div *ngIf="submissionForm.get('trainerId')?.hasError('required')" 
                 class="validation-error">
              <mat-icon>error_outline</mat-icon>
              <span>Trainer ID is required</span>
            </div>
            <div *ngIf="submissionForm.get('trainerId')?.hasError('pattern') && !submissionForm.get('trainerId')?.hasError('required')" 
                 class="validation-error">
              <mat-icon>error_outline</mat-icon>
              <span>Please enter a valid 12-digit trainer ID</span>
            </div>
          </div>
          <div class="input-help">
            <mat-icon class="help-icon">info_outline</mat-icon>
            <span>Find your Trainer ID in your in-game profile settings</span>
          </div>
        </form>
      </mat-dialog-content>
      <div class="dialog-actions">
        <button mat-stroked-button (click)="close()" class="cancel-btn" [disabled]="isSubmitting">
          Cancel
        </button>
        <button
          mat-raised-button
          color="primary"
          (click)="submit()"
          [disabled]="!isFormValid() || isSubmitting"
          class="submit-btn"
        >
          <mat-spinner diameter="16" *ngIf="isSubmitting" class="submit-spinner"></mat-spinner>
          <mat-icon *ngIf="!isSubmitting">send</mat-icon>
          <span>{{ isSubmitting ? 'Submitting...' : 'Submit' }}</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./trainer-submit-dialog.component.scss'],
})
export class TrainerSubmitDialogComponent implements OnInit {
  submissionForm: FormGroup;
  isSubmitting = false;
  config: TrainerSubmissionConfig;
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<TrainerSubmitDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TrainerSubmissionConfig
  ) {
    this.config = data || {
      title: 'Share Trainer ID',
      subtitle: 'Help the community grow'
    };
    this.submissionForm = this.fb.group({
      trainerId: ['', [
        Validators.required,
        Validators.pattern(/^[0-9]{12}$/)
      ]]
    });
  }
  ngOnInit() {
    // Focus the input field when dialog opens
    setTimeout(() => {
      const input = document.querySelector('.custom-input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  }
  getDigitCount(): number {
    const val = this.submissionForm.get('trainerId')?.value || '';
    return val.replace(/\D/g, '').length;
  }
  formatTrainerId(event: any) {
    let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Limit to 12 digits
    if (value.length > 12) {
      value = value.slice(0, 12);
    }
    
    // Update form control with the raw numeric value (no spaces)
    this.submissionForm.get('trainerId')?.setValue(value, { emitEvent: false });
    
    // Update display value with spaces for better readability
    let displayValue = '';
    if (value.length > 0) {
      // Format as XXX XXX XXX XXX (groups of 3)
      for (let i = 0; i < value.length; i += 3) {
        if (i > 0) displayValue += ' ';
        displayValue += value.slice(i, i + 3);
      }
    }
    
    event.target.value = displayValue;
  }
  isFormValid(): boolean {
    return this.submissionForm.valid;
  }
  async submit() {
    if (!this.isFormValid() || this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    const trainerId = this.submissionForm.get('trainerId')?.value.replace(/\s/g, '');
    try {
      let success = false;
      if (this.config.onSubmit) {
        // Use custom submit handler
        success = await this.config.onSubmit(trainerId);
      } else {
        // Default API submission to /api/v2/submit
        try {
          const response = await this.http.post('/api/tasks/submit', { 
            trainer_id: trainerId 
          }).toPromise();
          
          success = true;
          this.snackBar.open('Trainer ID submitted successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        } catch (apiError: any) {
          console.error('API submission failed:', apiError);
          if (apiError.status === 409) {
            this.snackBar.open('This trainer ID has already been submitted.', 'Close', {
              duration: 4000,
              panelClass: ['warning-snackbar']
            });
          } else if (apiError.status === 400) {
            this.snackBar.open('Invalid trainer ID format. Please check your input.', 'Close', {
              duration: 4000,
              panelClass: ['error-snackbar']
            });
          } else {
            this.snackBar.open('Failed to submit trainer ID. Please try again.', 'Close', {
              duration: 3000,
              panelClass: ['error-snackbar']
            });
          }
          success = false;
        }
      }
      if (success) {
        this.dialogRef.close({ trainerId });
      }
    } catch (error) {
      console.error('Error submitting trainer ID:', error);
      this.snackBar.open('An unexpected error occurred. Please try again.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isSubmitting = false;
    }
  }
  async reportUnavailable() {
    if (this.isSubmitting) {
      return;
    }
    const trainerId = this.submissionForm.get('trainerId')?.value.replace(/\s/g, '') || '';
    
    // If no trainer ID entered, close dialog immediately
    if (!trainerId) {
      this.snackBar.open('Reported as unavailable. Processing in background.', 'Close', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
      this.dialogRef.close({ unavailable: true });
      return;
    }
    this.isSubmitting = true;
    try {
      if (this.config.onSubmit) {
        // Use custom submit handler - let it handle the unavailable flag
        await this.config.onSubmit(trainerId);
      } else {
        // Post to API with unavailable flag
        this.http.post('/api/task/submit', { 
          trainer_id: trainerId,
          status: 'unavailable'
        }).toPromise().catch(error => {
          // Ignore errors for background processing
        });
      }
      this.snackBar.open('Reported as unavailable. Processing in background.', 'Close', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
      
      // Close immediately - process in background
      this.dialogRef.close({ trainerId, unavailable: true });
    } catch (error) {
      // Still close the dialog - this is background processing
      this.snackBar.open('Reported as unavailable. Processing in background.', 'Close', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
      this.dialogRef.close({ unavailable: true });
    } finally {
      this.isSubmitting = false;
    }
  }
  close() {
    this.dialogRef.close();
  }
}
