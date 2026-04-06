import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '../../services/auth.service';
import { LinkedAccount, Identity, User, ApiKey } from '../../models/auth.model';
import { getCharacterById } from '../../data/character.data';
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    LocaleNumberPipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  user: User | null = null;
  accounts: LinkedAccount[] = [];
  identities: Identity[] = [];
  loadingAccounts = true;
  loadingIdentities = true;

  // Link form
  newAccountId = '';
  linking = false;
  linkError = '';
  linkSuccess = '';

  // Verify state per account
  verifying: Record<string, boolean> = {};
  verifyError: Record<string, string> = {};
  verifyCooldown: Record<string, number> = {};
  copiedToken = '';

  // API Keys
  apiKeys: ApiKey[] = [];
  loadingApiKeys = true;
  newKeyName = '';
  creatingKey = false;
  apiKeyError = '';
  newlyCreatedKey: string | null = null;
  copiedApiKey = false;

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(u => this.user = u);
    this.loadAccounts();
    this.loadIdentities();
    this.loadApiKeys();
  }

  loadAccounts(): void {
    this.loadingAccounts = true;
    this.authService.getLinkedAccounts().subscribe({
      next: accounts => {
        this.accounts = accounts;
        this.loadingAccounts = false;
      },
      error: () => {
        this.accounts = [];
        this.loadingAccounts = false;
      }
    });
  }

  loadIdentities(): void {
    this.loadingIdentities = true;
    this.authService.getIdentities().subscribe({
      next: ids => {
        this.identities = ids;
        this.loadingIdentities = false;
      },
      error: () => {
        this.identities = [];
        this.loadingIdentities = false;
      }
    });
  }

  linkAccount(): void {
    const id = this.newAccountId.trim();
    if (!id) return;
    this.linking = true;
    this.linkError = '';
    this.linkSuccess = '';
    this.authService.linkAccount(id).subscribe({
      next: (account) => {
        this.newAccountId = '';
        this.linking = false;
        this.linkSuccess = `Account ${account?.account_id || id} linked! Follow the verification steps below.`;
        this.loadAccounts();
      },
      error: err => {
        console.error('Link account error:', err.status, err.error);
        this.linkError = err.error?.message || err.error?.error
          || (err.status === 0 ? 'Network error — is the backend running?' : `Request failed (${err.status})`);
        this.linking = false;
      }
    });
  }

  verifyAccount(accountId: string): void {
    if (this.verifyCooldown[accountId]) return;
    this.verifying[accountId] = true;
    this.verifyError[accountId] = '';
    this.authService.verifyAccount(accountId).subscribe({
      next: (res: any) => {
        this.verifying[accountId] = false;
        this.startCooldown(accountId);
        if (res?.status === 'timeout') {
          this.verifyError[accountId] = res.message || 'Verification timed out. Make sure the token is in your profile comment and try again.';
        } else if (res?.status && res.status !== 'verified') {
          this.verifyError[accountId] = res.message || 'Verification was not successful. Please try again.';
        } else {
          this.loadAccounts();
        }
      },
      error: err => {
        this.verifyError[accountId] = err.error?.message || err.error?.error || 'Verification failed';
        this.verifying[accountId] = false;
        this.startCooldown(accountId);
      }
    });
  }

  private startCooldown(accountId: string): void {
    this.verifyCooldown[accountId] = 30;
    const interval = setInterval(() => {
      this.verifyCooldown[accountId]--;
      if (this.verifyCooldown[accountId] <= 0) {
        delete this.verifyCooldown[accountId];
        clearInterval(interval);
      }
    }, 1000);
  }

  unlinkAccount(accountId: string): void {
    this.authService.unlinkAccount(accountId).subscribe({
      next: () => this.loadAccounts(),
      error: () => {}
    });
  }

  disconnectIdentity(provider: string): void {
    this.authService.disconnectProvider(provider).subscribe({
      next: () => this.loadIdentities(),
      error: () => {}
    });
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'google': return 'mail';
      case 'discord': return 'forum';
      default: return 'link';
    }
  }

  getProviderLabel(provider: string): string {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  hasProvider(provider: string): boolean {
    return this.identities.some(id => id.provider === provider);
  }

  copyToken(token: string): void {
    navigator.clipboard.writeText(token);
    this.copiedToken = token;
    setTimeout(() => this.copiedToken = '', 2000);
  }

  getUmaImage(umaId: number | undefined): string | null {
    if (!umaId) return null;
    const char = getCharacterById(umaId);
    return char ? `assets/images/character_stand/${char.image}` : null;
  }

  // --- API Keys ---

  loadApiKeys(): void {
    this.loadingApiKeys = true;
    this.authService.getApiKeys().subscribe({
      next: keys => {
        this.apiKeys = keys;
        this.loadingApiKeys = false;
      },
      error: () => {
        this.apiKeys = [];
        this.loadingApiKeys = false;
      }
    });
  }

  createApiKey(): void {
    const name = this.newKeyName.trim();
    if (!name) return;
    this.creatingKey = true;
    this.apiKeyError = '';
    this.newlyCreatedKey = null;
    this.authService.createApiKey(name).subscribe({
      next: key => {
        this.newlyCreatedKey = key.key || null;
        this.newKeyName = '';
        this.creatingKey = false;
        this.loadApiKeys();
      },
      error: err => {
        this.apiKeyError = err.error?.message || err.error?.error || `Request failed (${err.status})`;
        this.creatingKey = false;
      }
    });
  }

  revokeApiKey(key: ApiKey): void {
    this.authService.revokeApiKey(key.id).subscribe({
      next: () => this.loadApiKeys(),
      error: () => {}
    });
  }

  copyApiKey(key: string): void {
    navigator.clipboard.writeText(key);
    this.copiedApiKey = true;
    setTimeout(() => this.copiedApiKey = false, 2000);
  }
}
