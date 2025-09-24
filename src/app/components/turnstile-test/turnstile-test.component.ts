import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TurnstileService } from '../../services/turnstile.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-turnstile-test',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Turnstile Test</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Test Cloudflare Turnstile integration</p>
        
        <div class="test-status">
          <p><strong>Turnstile Ready:</strong> {{ turnstileReady ? 'Yes' : 'No' }}</p>
          <p><strong>Last Token:</strong> {{ lastToken || 'None' }}</p>
          <p><strong>Test Result:</strong> {{ testResult || 'Not tested' }}</p>
        </div>

        <div class="test-actions">
          <button mat-raised-button color="primary" (click)="generateToken()" [disabled]="!turnstileReady">
            Generate Token
          </button>
          
          <button mat-raised-button color="accent" (click)="testApiCall()" [disabled]="!lastToken">
            Test API Call
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .test-status {
      margin: 16px 0;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    
    .test-actions {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }
    
    .test-actions button {
      flex: 1;
    }
  `]
})
export class TurnstileTestComponent implements OnInit {
  turnstileReady = false;
  lastToken: string | null = null;
  testResult: string | null = null;

  constructor(
    private turnstileService: TurnstileService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // Check if Turnstile is ready
    this.turnstileService.waitForReady().subscribe({
      next: (ready) => {
        this.turnstileReady = ready;
        console.log('Turnstile is ready');
      },
      error: (error) => {
        console.error('Turnstile failed to load:', error);
        this.testResult = 'Failed to load Turnstile';
      }
    });
  }

  generateToken() {
    this.testResult = 'Generating token...';
    
    this.turnstileService.generateTokenWithRetry().subscribe({
      next: (token) => {
        this.lastToken = token.substring(0, 50) + '...';
        this.testResult = 'Token generated successfully';
        console.log('Generated token:', token);
      },
      error: (error) => {
        this.testResult = 'Failed to generate token: ' + error;
        console.error('Token generation failed:', error);
      }
    });
  }

  testApiCall() {
    if (!this.lastToken) return;

    this.testResult = 'Testing API call...';
    
    // Make a test POST request that should include the Turnstile token
    this.http.post(`${environment.apiUrl}/api/stats/visit`, {
      pageUrl: '/test',
      visitorId: 'test-visitor'
    }).subscribe({
      next: (response) => {
        this.testResult = 'API call successful: ' + JSON.stringify(response);
        console.log('API test successful:', response);
      },
      error: (error) => {
        this.testResult = 'API call failed: ' + (error.error?.message || error.message);
        console.error('API test failed:', error);
      }
    });
  }
}
