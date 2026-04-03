import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { LinkedAccount } from '../../models/auth.model';
import { getCharacterById } from '../../data/character.data';
@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent {
  isChristmas$ = this.themeService.isChristmas$;
  user$ = this.authService.user$;
  isLoggedIn$ = this.authService.isLoggedIn$;
  userMenuOpen = false;
  linkedAccounts: LinkedAccount[] = [];
  accountsLoaded = false;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    public authService: AuthService
  ) {}

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
    if (this.userMenuOpen && !this.accountsLoaded) {
      this.authService.getLinkedAccounts().subscribe({
        next: (accounts) => {
          this.linkedAccounts = accounts.filter(a => a.verification_status === 'verified');
          this.accountsLoaded = true;
        },
        error: () => { this.accountsLoaded = true; }
      });
    }
  }

  getUmaImage(account: LinkedAccount): string | null {
    if (!account.representative_uma_id) return null;
    const char = getCharacterById(account.representative_uma_id);
    return char ? `assets/images/character_stand/${char.image}` : null;
  }

  @HostListener('document:click')
  closeUserMenu() {
    this.userMenuOpen = false;
  }
  toggleTheme() {
    this.themeService.toggleChristmasTheme();
  }
  onLogoError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = 'assets/logo.png';
  }
}
