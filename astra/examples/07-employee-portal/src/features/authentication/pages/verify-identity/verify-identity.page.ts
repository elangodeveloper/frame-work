import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal, effect } from '@jarvis/reactive';
import type { Renderer } from '@jarvis/renderer';
import type { Router } from '@jarvis/router';
import { JarvisButton, JarvisInputText } from '@jarvis/primeng';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { AuthPageHeaderComponent } from '../../components/auth-page-header/auth-page-header.component.ts';

/**
 * VerifyIdentityPage: Multi-Factor Authentication (MFA) Verification
 * Handles 6-digit token validation, resend timers, and attempt limits.
 */
export class VerifyIdentityPage implements OnInit, OnDestroy {
  router?: Router;
  readonly authService: AuthenticationService;

  readonly mfaCode = signal<string>('849201');
  readonly codeError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly statusSuccess = signal<string | null>(null);
  readonly remainingAttempts = signal<number>(3);
  readonly resendCountdown = signal<number>(30);

  private timerId: any = null;
  private cleanupFns: Array<() => void> = [];

  constructor(authService?: AuthenticationService) {
    this.authService = authService || new AuthenticationService();
  }

  onInit(): void {
    this.startResendTimer();
  }

  startResendTimer(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.resendCountdown.set(30);
    this.timerId = setInterval(() => {
      if (this.resendCountdown() > 0) {
        this.resendCountdown.set(this.resendCountdown() - 1);
      } else {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }, 1000);
  }

  resendCode(): void {
    if (this.resendCountdown() > 0) return;
    this.mfaCode.set('849201'); // Dispatch new mock code
    this.statusError.set(null);
    this.statusSuccess.set('New cryptographic verification code dispatched to authenticator.');
    this.startResendTimer();
  }

  async handleVerify(): Promise<boolean> {
    if (this.authService.isLoading()) return false;

    this.codeError.set(null);
    this.statusError.set(null);

    const code = this.mfaCode().trim();
    if (!code || code.length !== 6) {
      this.codeError.set('A 6-digit verification code is required.');
      return false;
    }

    if (this.remainingAttempts() <= 1 && code === '000000') {
      this.remainingAttempts.set(0);
      this.statusError.set('Maximum verification attempts exceeded. Identity challenge locked.');
      return false;
    }

    const result = await this.authService.verifyMfa(code);

    if (result.success) {
      this.statusSuccess.set('Identity verified. Authorizing enterprise workspace...');
      if (this.router) {
        setTimeout(() => this.router?.navigate(['workspace']), 450);
      }
      return true;
    } else {
      this.remainingAttempts.set(Math.max(0, this.remainingAttempts() - 1));
      this.statusError.set(
        `${result.message || 'Invalid code.'} (${this.remainingAttempts()} attempts remaining)`
      );
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
    r.setAttribute(root, 'class', 'verify-identity-screen');
    r.setAttribute(root, 'aria-labelledby', 'mfa-heading');

    const header = new AuthPageHeaderComponent();
    header.title.set('Verify your identity');
    header.subtitle.set('A 6-digit verification code has been dispatched to your authenticator app.');
    header.badge.set('TWO-FACTOR CHALLENGE');
    header.icon.set('pi pi-shield');
    r.appendChild(root, header.render(r));

    // Notice Box
    const notice = r.createElement('div');
    r.setAttribute(notice, 'class', 'jarvis-alert-banner jarvis-alert-banner--info');
    notice.innerHTML = `
      <i class="pi pi-mobile" aria-hidden="true"></i>
      <span>Target Identifier: <strong class="font-mono text-emerald-800">${this.authService.pendingMfaIdentifier() || 'pepper@jarvis.ai'}</strong> (Mock Code: <strong>849201</strong>)</span>
    `;
    r.appendChild(root, notice);

    // Form
    const form = r.createElement('form');
    r.setAttribute(form, 'novalidate', 'true');
    r.listen(form, 'submit', (e: Event) => {
      e.preventDefault();
      this.handleVerify();
    });

    const formGroup = r.createElement('div');
    r.setAttribute(formGroup, 'class', 'jarvis-form-group');
    const label = r.createElement('label');
    r.setAttribute(label, 'class', 'jarvis-form-label');
    r.setAttribute(label, 'for', 'mfa-code-input');
    label.textContent = '6-Digit Verification Code';
    r.appendChild(formGroup, label);

    const input = new JarvisInputText(r, {
      value: this.mfaCode,
      placeholder: '849201',
      invalid: () => Boolean(this.codeError()),
      class: 'text-center font-mono tracking-widest text-lg font-bold',
    });
    r.setAttribute(input.getElement(), 'id', 'mfa-code-input');
    r.setAttribute(input.getElement(), 'maxlength', '6');
    r.setAttribute(input.getElement(), 'autocomplete', 'one-time-code');
    input.valueChange.subscribe((v) => {
      this.mfaCode.set(v.replace(/\D/g, ''));
      if (this.codeError()) this.codeError.set(null);
    });
    r.appendChild(formGroup, input.getElement());

    const errorEl = r.createElement('div');
    r.setAttribute(errorEl, 'class', 'jarvis-sr-only');
    const errSub = effect(() => {
      const err = this.codeError();
      if (err) {
        r.setAttribute(errorEl, 'class', 'jarvis-form-error');
        errorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(errorEl, 'class', 'jarvis-sr-only');
        errorEl.innerHTML = '';
      }
    });
    this.cleanupFns.push(errSub);
    r.appendChild(formGroup, errorEl);
    r.appendChild(form, formGroup);

    // Status Banner
    const statusBox = r.createElement('div');
    const statusSub = effect(() => {
      const err = this.statusError();
      const succ = this.statusSuccess();
      if (err) {
        r.setAttribute(statusBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--danger');
        statusBox.innerHTML = `<i class="pi pi-exclamation-triangle"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(statusBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--success');
        statusBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(statusBox, 'class', 'jarvis-sr-only');
        statusBox.innerHTML = '';
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);

    // Resend Timer Row
    const timerRow = r.createElement('div');
    r.setAttribute(timerRow, 'class', 'mfa-timer-row');
    const timerText = r.createElement('span');
    r.setAttribute(timerText, 'class', 'text-xs text-slate-500');
    const timerSub = effect(() => {
      const remaining = this.resendCountdown();
      if (remaining > 0) {
        timerText.textContent = `Resend code in ${remaining}s`;
      } else {
        timerText.textContent = `Code expired. You can resend now.`;
      }
    });
    this.cleanupFns.push(timerSub);
    r.appendChild(timerRow, timerText);

    const resendBtn = r.createElement('button');
    r.setAttribute(resendBtn, 'type', 'button');
    r.setAttribute(resendBtn, 'class', 'text-xs text-emerald-600 font-semibold hover:underline disabled:opacity-50 disabled:no-underline');
    const resendSub = effect(() => {
      (resendBtn as HTMLButtonElement).disabled = this.resendCountdown() > 0;
      resendBtn.textContent = 'Resend Code';
    });
    this.cleanupFns.push(resendSub);
    r.listen(resendBtn, 'click', () => this.resendCode());
    r.appendChild(timerRow, resendBtn);
    r.appendChild(form, timerRow);

    // Verify Action Button
    const verifyBtn = new JarvisButton(r, {
      label: 'Verify & Enter Workspace',
      icon: 'pi pi-check',
      severity: 'primary',
      loading: this.authService.isLoading,
      disabled: () => this.remainingAttempts() === 0 || this.authService.isLoading(),
      class: 'w-full submit-button-primary mt-4',
    });
    verifyBtn.clicked.subscribe(() => this.handleVerify());
    r.appendChild(form, verifyBtn.getElement());

    // Back button
    const backBtn = new JarvisButton(r, {
      label: 'Cancel & Return to Login',
      variant: 'text',
      class: 'w-full mt-3 text-slate-500',
    });
    backBtn.clicked.subscribe(() => this.navigateToLogin());
    r.appendChild(form, backBtn.getElement());

    r.appendChild(root, form);
    return root;
  }

  onDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error('[VerifyIdentityPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-verify-identity-page',
  templateUrl: './verify-identity.page.html',
  styleUrl: './verify-identity.page.css',
})(VerifyIdentityPage);
