import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal, effect, computed } from '@jarvis/reactive';
import type { Renderer } from '@jarvis/renderer';
import type { Router } from '@jarvis/router';
import { JarvisButton, JarvisInputText } from '@jarvis/primeng';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { AuthPageHeaderComponent } from '../../components/auth-page-header/auth-page-header.component.ts';
import type { PasswordPolicyCheck } from '../../models/auth.models.ts';

/**
 * ResetPasswordPage: Secure Password Creation & Policy Enforcement
 */
export class ResetPasswordPage implements OnInit, OnDestroy {
  router?: Router;
  readonly authService: AuthenticationService;

  readonly newPassword = signal<string>('StarkNew@2026');
  readonly confirmPassword = signal<string>('StarkNew@2026');
  readonly showPassword = signal<boolean>(false);
  readonly statusError = signal<string | null>(null);
  readonly statusSuccess = signal<string | null>(null);

  // Reactive Policy Checklist
  readonly policyCheck = computed<PasswordPolicyCheck>(() => {
    return this.authService.validatePasswordPolicy(this.newPassword(), this.confirmPassword());
  });

  readonly isPolicySatisfied = computed<boolean>(() => {
    const p = this.policyCheck();
    return (
      p.minLength &&
      p.hasUppercase &&
      p.hasLowercase &&
      p.hasNumber &&
      p.hasSpecialChar &&
      p.passwordsMatch
    );
  });

  private cleanupFns: Array<() => void> = [];

  constructor(authService?: AuthenticationService) {
    this.authService = authService || new AuthenticationService();
  }

  onInit(): void {}

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  async handleReset(): Promise<boolean> {
    if (this.authService.isLoading()) return false;

    this.statusError.set(null);
    this.statusSuccess.set(null);

    if (!this.isPolicySatisfied()) {
      this.statusError.set('Please fulfill all security requirements before updating your password.');
      return false;
    }

    const result = await this.authService.resetPassword(this.newPassword());
    if (result.success) {
      this.statusSuccess.set(result.message);
      return true;
    } else {
      this.statusError.set(result.message);
      return false;
    }
  }

  navigateToLogin(): void {
    if (this.router) {
      this.router.navigate(['login']);
    }
  }

  render(r: Renderer): any {
    const root = r.createElement('section');
    r.setAttribute(root, 'class', 'reset-password-screen');
    r.setAttribute(root, 'aria-labelledby', 'reset-heading');

    const header = new AuthPageHeaderComponent();
    header.title.set('Set new password');
    header.subtitle.set('Choose a strong password compliant with corporate security guidelines.');
    header.badge.set('SECURITY CREDENTIALS');
    header.icon.set('pi pi-lock');
    r.appendChild(root, header.render(r));

    const form = r.createElement('form');
    r.setAttribute(form, 'novalidate', 'true');
    r.listen(form, 'submit', (e: Event) => {
      e.preventDefault();
      this.handleReset();
    });

    // 1. New Password Field
    const passGroup = r.createElement('div');
    r.setAttribute(passGroup, 'class', 'jarvis-form-group');
    const passLabel = r.createElement('label');
    r.setAttribute(passLabel, 'class', 'jarvis-form-label');
    r.setAttribute(passLabel, 'for', 'new-password-input');
    passLabel.textContent = 'New Password';
    r.appendChild(passGroup, passLabel);

    const passWrapper = r.createElement('div');
    r.setAttribute(passWrapper, 'class', 'jarvis-password-wrapper');

    const passInput = new JarvisInputText(r, {
      value: this.newPassword,
      placeholder: 'Enter new password',
      type: 'password',
    });
    r.setAttribute(passInput.getElement(), 'id', 'new-password-input');
    passInput.valueChange.subscribe((v) => this.newPassword.set(v));
    r.appendChild(passWrapper, passInput.getElement());

    const toggleBtn = r.createElement('button');
    r.setAttribute(toggleBtn, 'type', 'button');
    r.setAttribute(toggleBtn, 'class', 'jarvis-password-toggle');
    r.setAttribute(toggleBtn, 'aria-label', 'Toggle password visibility');
    const passSub = effect(() => {
      const show = this.showPassword();
      r.setAttribute(passInput.getElement(), 'type', show ? 'text' : 'password');
      toggleBtn.innerHTML = show
        ? '<i class="pi pi-eye-slash"></i> <span>Hide</span>'
        : '<i class="pi pi-eye"></i> <span>Show</span>';
    });
    this.cleanupFns.push(passSub);
    r.listen(toggleBtn, 'click', () => this.togglePasswordVisibility());
    r.appendChild(passWrapper, toggleBtn);
    r.appendChild(passGroup, passWrapper);
    r.appendChild(form, passGroup);

    // 2. Confirm Password Field
    const confirmGroup = r.createElement('div');
    r.setAttribute(confirmGroup, 'class', 'jarvis-form-group');
    const confirmLabel = r.createElement('label');
    r.setAttribute(confirmLabel, 'class', 'jarvis-form-label');
    r.setAttribute(confirmLabel, 'for', 'confirm-password-input');
    confirmLabel.textContent = 'Confirm New Password';
    r.appendChild(confirmGroup, confirmLabel);

    const confirmInput = new JarvisInputText(r, {
      value: this.confirmPassword,
      placeholder: 'Repeat new password',
      type: 'password',
    });
    r.setAttribute(confirmInput.getElement(), 'id', 'confirm-password-input');
    confirmInput.valueChange.subscribe((v) => this.confirmPassword.set(v));
    r.appendChild(confirmGroup, confirmInput.getElement());
    r.appendChild(form, confirmGroup);

    // 3. Interactive Policy Guidance Checklist
    const policyBox = r.createElement('div');
    r.setAttribute(policyBox, 'class', 'password-policy-box');
    const policyHeader = r.createElement('div');
    r.setAttribute(policyHeader, 'class', 'policy-header');
    policyHeader.textContent = 'Enterprise Password Policy Checklist:';
    r.appendChild(policyBox, policyHeader);

    const rules = [
      { key: 'minLength', text: 'At least 8 characters long' },
      { key: 'hasUppercase', text: 'Contains uppercase letter (A-Z)' },
      { key: 'hasNumber', text: 'Contains a number (0-9)' },
      { key: 'hasSpecialChar', text: 'Contains special character (!@#$%...)' },
      { key: 'passwordsMatch', text: 'Passwords match identically' },
    ];

    const ruleElements: HTMLElement[] = [];
    for (const rule of rules) {
      const item = r.createElement('div');
      r.setAttribute(item, 'class', 'jarvis-policy-rule');
      r.appendChild(policyBox, item);
      ruleElements.push(item);
    }

    const policySub = effect(() => {
      const state = this.policyCheck();
      rules.forEach((rule, idx) => {
        const isMet = (state as any)[rule.key];
        const el = ruleElements[idx];
        if (isMet) {
          el.className = 'jarvis-policy-rule jarvis-policy-rule--met';
          el.innerHTML = `<i class="pi pi-check text-emerald-600"></i> <span>${rule.text}</span>`;
        } else {
          el.className = 'jarvis-policy-rule';
          el.innerHTML = `<i class="pi pi-circle text-slate-400"></i> <span>${rule.text}</span>`;
        }
      });
    });
    this.cleanupFns.push(policySub);
    r.appendChild(form, policyBox);

    // Status Banner
    const statusBox = r.createElement('div');
    const statusSub = effect(() => {
      const err = this.statusError();
      const succ = this.statusSuccess();
      if (err) {
        r.setAttribute(statusBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--danger mt-3');
        statusBox.innerHTML = `<i class="pi pi-exclamation-triangle"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(statusBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--success mt-3');
        statusBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(statusBox, 'class', 'jarvis-sr-only');
        statusBox.innerHTML = '';
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);

    // Submit Button
    const submitBtn = new JarvisButton(r, {
      label: 'Update Password & Continue',
      icon: 'pi pi-lock-open',
      severity: 'primary',
      loading: this.authService.isLoading,
      disabled: () => !this.isPolicySatisfied() || this.authService.isLoading(),
      class: 'w-full submit-button-primary mt-4',
    });
    submitBtn.clicked.subscribe(() => this.handleReset());
    r.appendChild(form, submitBtn.getElement());

    // Back button
    const backBtn = new JarvisButton(r, {
      label: 'Proceed to Sign In',
      variant: 'text',
      class: 'w-full mt-3 text-slate-600',
    });
    backBtn.clicked.subscribe(() => this.navigateToLogin());
    r.appendChild(form, backBtn.getElement());

    r.appendChild(root, form);
    return root;
  }

  onDestroy(): void {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error('[ResetPasswordPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-reset-password-page',
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.css',
})(ResetPasswordPage);
