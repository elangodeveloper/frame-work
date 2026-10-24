import { Component, type OnInit, type OnDestroy } from '../../packages/core/src/index.ts';
import { signal, computed, effect, type Signal } from '../../packages/reactive/src/index.ts';
import { FormControl, FormGroup } from '../../packages/forms/src/index.ts';
import { AuthService, DUMMY_USERS, type User, type StoredSession } from './auth.service.ts';

export class LoginComponent implements OnInit, OnDestroy {
  readonly authService: AuthService;

  // Reactive Form Controls
  readonly emailControl = new FormControl<string>('stark@jarvis.ai', [
    (val) => (!val || !val.includes('@') ? 'Valid email required' : null)
  ]);
  readonly passwordControl = new FormControl<string>('password123', [
    (val) => (!val || val.length < 6 ? 'Password must be at least 6 characters' : null)
  ]);
  readonly rememberMe = signal<boolean>(true);

  // UI state signals
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Quick user presets
  readonly quickUsers = DUMMY_USERS;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  onInit(): void {
    // Check if session was already restored
    if (this.authService.isAuthenticated()) {
      const user = this.authService.currentUser();
      this.successMessage.set('Active session restored from LocalStorage for ' + (user?.name || 'User') + '.');
    }
  }

  fillDummy(email: string, pass: string): void {
    this.emailControl.setValue(email);
    this.passwordControl.setValue(pass);
    this.errorMessage.set(null);
  }

  async handleLogin(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.emailControl.markAsTouched();
    this.passwordControl.markAsTouched();

    if (this.emailControl.invalid) {
      this.errorMessage.set(this.emailControl.errors()[0]);
      return;
    }
    if (this.passwordControl.invalid) {
      this.errorMessage.set(this.passwordControl.errors()[0]);
      return;
    }

    this.isLoading.set(true);

    // Simulate authenticating against neural network / backend
    await new Promise((res) => setTimeout(res, 400));

    const res = this.authService.login(
      this.emailControl.value(),
      this.passwordControl.value(),
      this.rememberMe()
    );

    this.isLoading.set(false);

    if (res.success) {
      const user = this.authService.currentUser();
      this.successMessage.set('Welcome back, ' + (user?.name || '') + '! Session saved to LocalStorage.');
    } else {
      this.errorMessage.set(res.message || 'Authentication failed.');
    }
  }

  handleLogout(): void {
    this.authService.logout();
    this.successMessage.set(null);
    this.errorMessage.set('Session terminated. LocalStorage cleared.');
  }

  onDestroy(): void {
    // Lifecycle cleanup
  }
}

Component({
  selector: 'jarvis-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})(LoginComponent);
