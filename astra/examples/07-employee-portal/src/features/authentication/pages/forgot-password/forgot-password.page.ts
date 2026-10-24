import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal, effect } from '@jarvis/reactive';
import type { Renderer } from '@jarvis/renderer';
import type { Router } from '@jarvis/router';
import { JarvisButton, JarvisInputText } from '@jarvis/primeng';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { OrganizationConfigService } from '../../services/organization-config.service.ts';
import { AuthPageHeaderComponent } from '../../components/auth-page-header/auth-page-header.component.ts';

/**
 * ForgotPasswordPage: Self-Service Password Recovery
 * Generic confirmation prevents account enumeration security vulnerabilities.
 */
export class ForgotPasswordPage implements OnInit, OnDestroy {
  router?: Router;
  readonly authService: AuthenticationService;
  readonly orgConfig: OrganizationConfigService;

  readonly identifier = signal<string>('');
  readonly identifierError = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly isSubmitted = signal<boolean>(false);

  private cleanupFns: Array<() => void> = [];

  constructor(authService?: AuthenticationService, orgConfig?: OrganizationConfigService) {
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
  }

  onInit(): void {}

  async handleRequestReset(): Promise<boolean> {
    if (this.authService.isLoading()) return false;

    this.identifierError.set(null);
    this.statusMessage.set(null);

    const idVal = this.identifier().trim();
    if (!idVal) {
      this.identifierError.set('Employee identifier is required to dispatch instructions.');
      return false;
    }

    const result = await this.authService.requestPasswordReset(idVal);
    this.isSubmitted.set(true);
    this.statusMessage.set(result.message);
    return true;
  }

  navigateToLogin(): void {
    if (this.router) {
      this.router.navigate(['login']);
    }
  }

  render(r: Renderer): any {
    const root = r.createElement('section');
    r.setAttribute(root, 'class', 'forgot-password-screen');
    r.setAttribute(root, 'aria-labelledby', 'forgot-password-heading');

    const header = new AuthPageHeaderComponent();
    header.title.set('Reset your password');
    header.subtitle.set('Self-service identity verification and credential recovery.');
    header.badge.set('CREDENTIAL RECOVERY');
    header.icon.set('pi pi-key');
    r.appendChild(root, header.render(r));

    // Information Callout
    const infoCallout = r.createElement('div');
    r.setAttribute(infoCallout, 'class', 'jarvis-alert-banner jarvis-alert-banner--info');
    infoCallout.innerHTML = `
      <i class="pi pi-info-circle" aria-hidden="true"></i>
      <span>Enter your corporate email or employee ID. A secure cryptographic reset link will be dispatched if the account is active.</span>
    `;
    r.appendChild(root, infoCallout);

    // Form
    const form = r.createElement('form');
    r.setAttribute(form, 'novalidate', 'true');
    r.listen(form, 'submit', (e: Event) => {
      e.preventDefault();
      this.handleRequestReset();
    });

    const formGroup = r.createElement('div');
    r.setAttribute(formGroup, 'class', 'jarvis-form-group');
    const label = r.createElement('label');
    r.setAttribute(label, 'class', 'jarvis-form-label');
    r.setAttribute(label, 'for', 'recovery-identifier-input');
    label.textContent = this.orgConfig.identifierLabel;
    r.appendChild(formGroup, label);

    const input = new JarvisInputText(r, {
      value: this.identifier,
      placeholder: 'e.g. stark@jarvis.ai',
      invalid: () => Boolean(this.identifierError()),
    });
    r.setAttribute(input.getElement(), 'id', 'recovery-identifier-input');
    r.setAttribute(input.getElement(), 'autocomplete', 'email');
    input.valueChange.subscribe((v) => {
      this.identifier.set(v);
      if (this.identifierError()) this.identifierError.set(null);
    });
    r.appendChild(formGroup, input.getElement());

    const errorEl = r.createElement('div');
    r.setAttribute(errorEl, 'class', 'jarvis-sr-only');
    const errSub = effect(() => {
      const err = this.identifierError();
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

    // Status Banner after submission
    const statusBox = r.createElement('div');
    const statusSub = effect(() => {
      const msg = this.statusMessage();
      if (msg) {
        r.setAttribute(statusBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--success mt-4');
        statusBox.innerHTML = `<i class="pi pi-check-circle" aria-hidden="true"></i> <span>${msg}</span>`;
      } else {
        r.setAttribute(statusBox, 'class', 'jarvis-sr-only');
        statusBox.innerHTML = '';
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);

    // Submit button
    const submitBtn = new JarvisButton(r, {
      label: 'Dispatch Recovery Link',
      icon: 'pi pi-send',
      severity: 'primary',
      loading: this.authService.isLoading,
      class: 'w-full submit-button-primary mt-2',
    });
    submitBtn.clicked.subscribe(() => this.handleRequestReset());
    r.appendChild(form, submitBtn.getElement());

    // Back to Login link
    const backBtn = new JarvisButton(r, {
      label: 'Back to Sign In',
      icon: 'pi pi-arrow-left',
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
        console.error('[ForgotPasswordPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-forgot-password-page',
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.css',
})(ForgotPasswordPage);
