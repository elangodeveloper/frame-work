import { Component } from '@jarvis/core';
import { authService } from '../../../core/services/auth.service.ts';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  readonly isAuthenticated = authService.isAuthenticated;

  toggleAuth() {
    if (this.isAuthenticated()) {
      authService.logout();
    } else {
      authService.login();
    }
  }
}
