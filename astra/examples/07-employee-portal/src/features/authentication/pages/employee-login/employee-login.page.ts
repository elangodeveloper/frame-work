import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal, effect, type Signal } from '@jarvis/reactive';
import type { Renderer } from '@jarvis/renderer';
import type { Router } from '@jarvis/router';
import {
  JarvisButton,
  JarvisInputText,
  JarvisCheckbox,
  JarvisDialog,
} from '@jarvis/primeng';
import {
  AuthenticationService,
  ENTERPRISE_DIRECTORY,
  type EnterpriseDirectoryUser,
} from '../../services/authentication.service.ts';
import { OrganizationConfigService } from '../../services/organization-config.service.ts';
import { AuthPageHeaderComponent } from '../../components/auth-page-header/auth-page-header.component.ts';

/**
 * EmployeeLoginPage: Primary Enterprise Sign-In Screen
 * Built with Object-Oriented Composition, PrimeNG v20 adapter, and JARVIS Signals.
 */
export class EmployeeLoginPage implements OnInit, OnDestroy {
  router?: Router;
  readonly authService: AuthenticationService;
  readonly orgConfig: OrganizationConfigService;

  // Reactive Form State Signals
  readonly identifier = signal<string>('stark@jarvis.ai');
  readonly password = signal<string>('Password@2026');
  readonly showPassword = signal<boolean>(false);
  readonly rememberMe = signal<boolean>(true);

  // Validation & Feedback Signals
  readonly identifierTouched = signal<boolean>(false);
  readonly passwordTouched = signal<boolean>(false);
  readonly failedAttempts = signal<number>(0);
  readonly isShaking = signal<boolean>(false);
  readonly identifierError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly helpModalVisible = signal<boolean>(false);

  // Quick Directory Presets
  readonly directoryUsers: EnterpriseDirectoryUser[] = ENTERPRISE_DIRECTORY;

  private cleanupFns: Array<() => void> = [];

  constructor(authService?: AuthenticationService, orgConfig?: OrganizationConfigService) {
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
  }

  onInit(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.currentUser();
      this.formSuccess.set(`Active workspace session restored for ${user?.name || 'Employee'}.`);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  validateIdentifier(): boolean {
    const val = this.identifier().trim();
    if (!val) {
      this.identifierError.set('Employee ID or corporate email is required.');
      return false;
    }
    if (val.length < 3) {
      this.identifierError.set('Identifier must be at least 3 characters.');
      return false;
    }
    if (val.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      this.identifierError.set('Please enter a valid corporate email format (e.g. user@jarvis.ai).');
      return false;
    }
    this.identifierError.set(null);
    return true;
  }

  validatePassword(): boolean {
    const val = this.password();
    if (!val) {
      this.passwordError.set('Password is required.');
      return false;
    }
    if (val.length < 6) {
      this.passwordError.set('Password must be at least 6 characters.');
      return false;
    }
    this.passwordError.set(null);
    return true;
  }

  triggerShake(): void {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 450);
  }

  fillQuickUser(user: EnterpriseDirectoryUser): void {
    this.identifier.set(user.email);
    this.password.set(user.password);
    this.identifierTouched.set(true);
    this.passwordTouched.set(true);
    this.identifierError.set(null);
    this.passwordError.set(null);
    this.formError.set(null);
  }

  async handleSignIn(): Promise<boolean> {
    // Prevent concurrent submissions
    if (this.authService.isLoading()) {
      return false;
    }

    this.identifierTouched.set(true);
    this.passwordTouched.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    const isIdValid = this.validateIdentifier();
    const isPassValid = this.validatePassword();

    if (!isIdValid || !isPassValid) {
      this.formError.set('Please resolve the highlighted field errors to proceed.');
      this.triggerShake();
      return false;
    }

    const idVal = this.identifier().trim();
    const passVal = this.password();
    const result = await this.authService.login(idVal, passVal, this.rememberMe());

    if (result.success) {
      this.failedAttempts.set(0);
      if (result.requiresMfa) {
        this.formSuccess.set('Primary authentication verified. Redirecting to Multi-Factor Verification...');
        if (this.router) {
          setTimeout(() => this.router?.navigate(['verify-identity']), 400);
        }
        return true;
      }

      this.formSuccess.set(`Access authorized. Welcome, ${result.user?.name}!`);
      if (this.router) {
        setTimeout(() => this.router?.navigate(['dashboard']), 450);
      }
      return true;
    } else {
      this.failedAttempts.update((n) => n + 1);
      const attempts = this.failedAttempts();
      if (attempts >= 2) {
        this.formError.set(`${result.message || 'Authentication failed'}. Attempt ${attempts} of 5. Consecutive failures will trigger security suspension.`);
      } else {
        this.formError.set(result.message || 'Authentication failed. Please verify credentials.');
      }
      this.identifierError.set('Invalid credentials.');
      this.passwordError.set('Invalid credentials.');
      this.triggerShake();
      return false;
    }
  }

  async handleSsoSignIn(): Promise<void> {
    if (this.authService.isLoading()) return;
    this.formError.set(null);
    this.formSuccess.set('Initiating federated SAML handshake with Enterprise Identity Provider...');
    // Demo SSO logs in first user as identity provider assertion
    setTimeout(async () => {
      await this.authService.login('stark@jarvis.ai', 'Password@2026', this.rememberMe());
      if (this.router) {
        this.router.navigate(['workspace']);
      }
    }, 600);
  }

  openHelpModal(): void {
    this.helpModalVisible.set(true);
  }

  closeHelpModal(): void {
    this.helpModalVisible.set(false);
  }

  navigateToForgotPassword(): void {
    if (this.router) {
      this.router.navigate(['forgot-password']);
    }
  }

  render(r: Renderer): any {
    const root = r.createElement('section');
    r.setAttribute(root, 'class', 'employee-login-screen');
    r.setAttribute(root, 'aria-labelledby', 'auth-heading');

    // Page Header
    const headerComponent = new AuthPageHeaderComponent();
    headerComponent.title.set('Welcome back');
    headerComponent.subtitle.set('Access your employee workspace.');
    headerComponent.badge.set('SECURE IDENTITY GATEWAY');
    const headerNode = headerComponent.render(r);
    r.appendChild(root, headerNode);

    // 1-Click Demo Profiles Presets
    const presetsBox = r.createElement('div');
    r.setAttribute(presetsBox, 'class', 'quick-presets-container');
    const presetsLabel = r.createElement('span');
    r.setAttribute(presetsLabel, 'class', 'presets-label');
    presetsLabel.textContent = '1-Click Employee Profiles:';
    r.appendChild(presetsBox, presetsLabel);

    const presetGrid = r.createElement('div');
    r.setAttribute(presetGrid, 'class', 'preset-grid');
    for (const u of this.directoryUsers) {
      const pBtn = r.createElement('button');
      r.setAttribute(pBtn, 'type', 'button');
      r.setAttribute(pBtn, 'class', 'preset-chip');
      const mfaTag = u.requiresMfa ? '<span class="mfa-chip">MFA</span>' : '';
      pBtn.innerHTML = `
        <div class="preset-name">${u.name} ${mfaTag}</div>
        <div class="preset-dept">${u.department}</div>
      `;
      r.listen(pBtn, 'click', () => this.fillQuickUser(u));
      r.appendChild(presetGrid, pBtn);
    }
    r.appendChild(presetsBox, presetGrid);
    r.appendChild(root, presetsBox);

    // Dynamic Alert Notification Banners
    const alertBox = r.createElement('div');
    r.setAttribute(alertBox, 'role', 'status');
    r.setAttribute(alertBox, 'aria-live', 'polite');
    const alertSub = effect(() => {
      const err = this.formError();
      const succ = this.formSuccess();
      if (err) {
        r.setAttribute(alertBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--danger');
        alertBox.innerHTML = `<i class="pi pi-exclamation-triangle" aria-hidden="true"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(alertBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--success');
        alertBox.innerHTML = `<i class="pi pi-check-circle" aria-hidden="true"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(alertBox, 'class', 'jarvis-sr-only');
        alertBox.innerHTML = '';
      }
    });
    this.cleanupFns.push(alertSub);
    r.appendChild(root, alertBox);

    // Authentication Form
    const form = r.createElement('form');
    r.setAttribute(form, 'id', 'employee-login-form');
    r.setAttribute(form, 'novalidate', 'true');
    r.listen(form, 'submit', (e: Event) => {
      e.preventDefault();
      this.handleSignIn();
    });

    const shakeSub = effect(() => {
      const shaking = this.isShaking();
      r.setAttribute(form, 'class', shaking ? 'jarvis-form--shake' : '');
    });
    this.cleanupFns.push(shakeSub);

    // Lockout Warning Notice
    const lockoutNotice = r.createElement('div');
    r.setAttribute(lockoutNotice, 'class', 'jarvis-sr-only');
    const lockoutSub = effect(() => {
      const attempts = this.failedAttempts();
      if (attempts >= 2) {
        r.setAttribute(lockoutNotice, 'class', 'auth-lockout-notice');
        lockoutNotice.innerHTML = `
          <i class="pi pi-shield text-amber-600"></i>
          <span>Security Alert: Account will freeze after 5 failed attempts (${attempts}/5 used).</span>
        `;
      } else {
        r.setAttribute(lockoutNotice, 'class', 'jarvis-sr-only');
        lockoutNotice.innerHTML = '';
      }
    });
    this.cleanupFns.push(lockoutSub);
    r.appendChild(form, lockoutNotice);

    // 1. Employee Identifier Field
    const idGroup = r.createElement('div');
    r.setAttribute(idGroup, 'class', 'jarvis-form-group');
    const idLabel = r.createElement('label');
    r.setAttribute(idLabel, 'class', 'jarvis-form-label');
    r.setAttribute(idLabel, 'for', 'employee-identifier-input');
    idLabel.textContent = this.orgConfig.identifierLabel;
    r.appendChild(idGroup, idLabel);

    const idInput = new JarvisInputText(r, {
      value: this.identifier,
      placeholder: this.orgConfig.config().identifierPlaceholder,
      invalid: () => Boolean(this.identifierError()),
    });
    r.setAttribute(idInput.getElement(), 'id', 'employee-identifier-input');
    r.setAttribute(idInput.getElement(), 'autocomplete', 'username');
    r.setAttribute(idInput.getElement(), 'aria-required', 'true');
    r.setAttribute(idInput.getElement(), 'aria-describedby', 'id-error-desc');
    idInput.valueChange.subscribe((v) => {
      this.identifier.set(v);
      if (this.identifierError()) this.identifierError.set(null);
    });
    idInput.blur.subscribe(() => {
      this.identifierTouched.set(true);
      if (this.identifierTouched()) this.validateIdentifier();
    });
    r.appendChild(idGroup, idInput.getElement());

    const idErrorEl = r.createElement('div');
    r.setAttribute(idErrorEl, 'id', 'id-error-desc');
    r.setAttribute(idErrorEl, 'class', 'jarvis-sr-only');
    r.setAttribute(idErrorEl, 'role', 'alert');
    const idErrSub = effect(() => {
      const err = this.identifierError();
      if (err) {
        r.setAttribute(idErrorEl, 'class', 'jarvis-form-error');
        idErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(idErrorEl, 'class', 'jarvis-sr-only');
        idErrorEl.innerHTML = '';
      }
    });
    this.cleanupFns.push(idErrSub);
    r.appendChild(idGroup, idErrorEl);
    r.appendChild(form, idGroup);

    // 2. Password Field with Visibility Toggle
    const passGroup = r.createElement('div');
    r.setAttribute(passGroup, 'class', 'jarvis-form-group');
    const passLabel = r.createElement('label');
    r.setAttribute(passLabel, 'class', 'jarvis-form-label');
    r.setAttribute(passLabel, 'for', 'employee-password-input');
    passLabel.textContent = 'Security Password';
    r.appendChild(passGroup, passLabel);

    const passWrapper = r.createElement('div');
    r.setAttribute(passWrapper, 'class', 'jarvis-password-wrapper');

    const passInput = new JarvisInputText(r, {
      value: this.password,
      placeholder: 'Enter your password',
      type: 'password',
      invalid: () => Boolean(this.passwordError()),
    });
    r.setAttribute(passInput.getElement(), 'id', 'employee-password-input');
    r.setAttribute(passInput.getElement(), 'autocomplete', 'current-password');
    r.setAttribute(passInput.getElement(), 'aria-required', 'true');
    r.setAttribute(passInput.getElement(), 'aria-describedby', 'pass-error-desc');
    passInput.valueChange.subscribe((v) => {
      this.password.set(v);
      if (this.passwordError()) this.passwordError.set(null);
    });
    passInput.blur.subscribe(() => {
      this.passwordTouched.set(true);
      if (this.passwordTouched()) this.validatePassword();
    });
    r.appendChild(passWrapper, passInput.getElement());

    // Password Visibility Toggle Button
    const toggleBtn = r.createElement('button');
    r.setAttribute(toggleBtn, 'type', 'button');
    r.setAttribute(toggleBtn, 'class', 'jarvis-password-toggle');
    r.setAttribute(toggleBtn, 'aria-label', 'Toggle password visibility');
    const passToggleSub = effect(() => {
      const isVisible = this.showPassword();
      const inputEl = passInput.getElement();
      r.setAttribute(inputEl, 'type', isVisible ? 'text' : 'password');
      toggleBtn.innerHTML = isVisible
        ? '<i class="pi pi-eye-slash" aria-hidden="true"></i> <span>Hide</span>'
        : '<i class="pi pi-eye" aria-hidden="true"></i> <span>Show</span>';
    });
    this.cleanupFns.push(passToggleSub);
    r.listen(toggleBtn, 'click', () => this.togglePasswordVisibility());
    r.appendChild(passWrapper, toggleBtn);
    r.appendChild(passGroup, passWrapper);

    const passErrorEl = r.createElement('div');
    r.setAttribute(passErrorEl, 'id', 'pass-error-desc');
    r.setAttribute(passErrorEl, 'class', 'jarvis-sr-only');
    r.setAttribute(passErrorEl, 'role', 'alert');
    const passErrSub = effect(() => {
      const err = this.passwordError();
      if (err) {
        r.setAttribute(passErrorEl, 'class', 'jarvis-form-error');
        passErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(passErrorEl, 'class', 'jarvis-sr-only');
        passErrorEl.innerHTML = '';
      }
    });
    this.cleanupFns.push(passErrSub);
    r.appendChild(passGroup, passErrorEl);
    r.appendChild(form, passGroup);

    // 3. Auxiliary Row: Remember Device & Forgot Password Link
    const auxRow = r.createElement('div');
    r.setAttribute(auxRow, 'class', 'auth-aux-row');

    const rememberCheckbox = new JarvisCheckbox(r, {
      label: 'Remember this device',
      checked: this.rememberMe,
    });
    rememberCheckbox.checkedChange.subscribe((val) => this.rememberMe.set(val));
    r.appendChild(auxRow, rememberCheckbox.getElement());

    const forgotBtn = r.createElement('button');
    r.setAttribute(forgotBtn, 'type', 'button');
    r.setAttribute(forgotBtn, 'class', 'forgot-password-link');
    forgotBtn.textContent = 'Forgot password?';
    r.listen(forgotBtn, 'click', () => this.navigateToForgotPassword());
    r.appendChild(auxRow, forgotBtn);
    r.appendChild(form, auxRow);

    // 4. Primary Submit Button (PrimeNG Button)
    const submitBtn = new JarvisButton(r, {
      label: 'Sign In to Workspace',
      icon: 'pi pi-arrow-right',
      severity: 'primary',
      loading: this.authService.isLoading,
      disabled: this.authService.isLoading,
      class: 'w-full submit-button-primary',
    });
    r.setAttribute(submitBtn.getElement(), 'id', 'btn-sign-in');
    submitBtn.clicked.subscribe(() => this.handleSignIn());
    r.appendChild(form, submitBtn.getElement());

    // 5. Divider
    const divider = r.createElement('div');
    r.setAttribute(divider, 'class', 'jarvis-divider');
    divider.textContent = 'OR SECURE SSO';
    r.appendChild(form, divider);

    // 6. Enterprise SSO Button
    if (this.orgConfig.config().ssoEnabled) {
      const ssoBtn = new JarvisButton(r, {
        label: this.orgConfig.config().ssoProviderName,
        icon: 'pi pi-id-card',
        variant: 'outlined',
        disabled: this.authService.isLoading,
        class: 'w-full sso-button',
      });
      r.setAttribute(ssoBtn.getElement(), 'id', 'btn-sso');
      ssoBtn.clicked.subscribe(() => this.handleSsoSignIn());
      r.appendChild(form, ssoBtn.getElement());
    }

    r.appendChild(root, form);

    // 7. Footer Links & Help
    const footerNav = r.createElement('footer');
    r.setAttribute(footerNav, 'class', 'auth-footer-nav');

    const helpBtn = r.createElement('button');
    r.setAttribute(helpBtn, 'type', 'button');
    r.setAttribute(helpBtn, 'class', 'auth-footer-link help-link');
    helpBtn.innerHTML = '<i class="pi pi-question-circle"></i> <span>Need help signing in?</span>';
    r.listen(helpBtn, 'click', () => this.openHelpModal());
    r.appendChild(footerNav, helpBtn);

    const legalLinks = r.createElement('div');
    r.setAttribute(legalLinks, 'class', 'legal-links');
    legalLinks.innerHTML = `
      <a href="${this.orgConfig.config().privacyPolicyUrl}" target="_blank" rel="noopener" class="auth-footer-link">Privacy Policy</a>
      <span class="bullet" aria-hidden="true">·</span>
      <a href="${this.orgConfig.config().termsOfServiceUrl}" target="_blank" rel="noopener" class="auth-footer-link">Terms</a>
      <span class="bullet" aria-hidden="true">·</span>
      <span class="auth-compliance-tag">${this.orgConfig.config().version}</span>
    `;
    r.appendChild(footerNav, legalLinks);
    r.appendChild(root, footerNav);

    // 8. Help & Support Dialog (PrimeNG Dialog)
    const dialog = new JarvisDialog(r, {
      header: 'Enterprise Access & Support',
      visible: this.helpModalVisible,
      width: '420px',
      modal: true,
      closable: true,
    });
    dialog.visibleChange.subscribe((v) => this.helpModalVisible.set(v));

    const dialogContent = r.createElement('div');
    r.setAttribute(dialogContent, 'class', 'space-y-4 text-xs');
    dialogContent.innerHTML = `
      <p class="text-slate-600 leading-relaxed">
        If you encounter difficulties accessing your JARVIS employee workspace, please verify that your security token is active or contact your organization identity administrator.
      </p>
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
        <div class="font-semibold text-slate-800">Support Desk Contacts</div>
        <div>Email: <a href="mailto:${this.orgConfig.config().supportEmail}" class="text-emerald-600 font-medium">${this.orgConfig.config().supportEmail}</a></div>
        <div>Phone: <span class="font-mono text-slate-700">${this.orgConfig.config().supportPhone}</span></div>
      </div>
      <p class="text-slate-500 text-[11px]">
        Reference Ticket ID: <span class="font-mono text-slate-700">JARVIS-SEC-${Math.floor(1000 + Math.random() * 9000)}</span>
      </p>
    `;
    r.appendChild(dialog.getElement(), dialogContent);
    r.appendChild(root, dialog.getElement());

    return root;
  }

  onDestroy(): void {
    for (const cleanup of this.cleanupFns) {
      try {
        if (typeof cleanup === 'function') {
          cleanup();
        } else if (cleanup && typeof (cleanup as any).destroy === 'function') {
          (cleanup as any).destroy();
        }
      } catch (e) {
        console.error('[EmployeeLoginPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-employee-login-page',
  templateUrl: './employee-login.page.html',
  styleUrl: './employee-login.page.css',
})(EmployeeLoginPage);
