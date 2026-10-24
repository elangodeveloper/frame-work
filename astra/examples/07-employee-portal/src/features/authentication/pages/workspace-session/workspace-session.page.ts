import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal, effect } from '@jarvis/reactive';
import type { Renderer } from '@jarvis/renderer';
import type { Router } from '@jarvis/router';
import { JarvisButton } from '@jarvis/primeng';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { AuthPageHeaderComponent } from '../../components/auth-page-header/auth-page-header.component.ts';

/**
 * WorkspaceSessionPage: Active Employee Workspace Session & Identity Overview
 */
export class WorkspaceSessionPage implements OnInit, OnDestroy {
  router?: Router;
  readonly authService: AuthenticationService;

  readonly sessionPurged = signal<boolean>(false);
  private cleanupFns: Array<() => void> = [];

  constructor(authService?: AuthenticationService) {
    this.authService = authService || new AuthenticationService();
  }

  onInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.authService.restoreSession();
    }
  }

  handleLogout(): void {
    this.authService.logout();
    this.sessionPurged.set(true);
    if (this.router) {
      setTimeout(() => this.router?.navigate(['login']), 400);
    }
  }

  navigateToResetPassword(): void {
    if (this.router) {
      this.router.navigate(['reset-password']);
    }
  }

  navigateToLogin(): void {
    if (this.router) {
      this.router.navigate(['login']);
    }
  }

  render(r: Renderer): any {
    const root = r.createElement('section');
    r.setAttribute(root, 'class', 'workspace-session-screen');
    r.setAttribute(root, 'aria-labelledby', 'workspace-heading');

    const header = new AuthPageHeaderComponent();
    header.title.set('Employee Workspace');
    header.subtitle.set('Authorized corporate identity session active.');
    header.badge.set('IDENTITY VERIFIED · ACTIVE SESSION');
    header.icon.set('pi pi-check-circle');
    r.appendChild(root, header.render(r));

    const contentBox = r.createElement('div');
    r.setAttribute(contentBox, 'class', 'space-y-5');

    // User Profile Card
    const profileCard = r.createElement('div');
    r.setAttribute(profileCard, 'class', 'workspace-profile-card');

    const profSub = effect(() => {
      const user = this.authService.currentUser();
      const session = this.authService.sessionInfo();

      if (user && session) {
        profileCard.innerHTML = `
          <div class="profile-header">
            <img src="${user.avatar}" alt="${user.name}" class="profile-avatar" />
            <div>
              <div class="profile-name-row">
                <h2 class="profile-name">${user.name}</h2>
                <span class="profile-clearance">${user.clearanceLevel}</span>
              </div>
              <div class="profile-role">${user.role} · ${user.department}</div>
              <div class="profile-id font-mono">ID: ${user.id} | Email: ${user.email}</div>
            </div>
          </div>

          <div class="session-meta-grid">
            <div class="meta-item">
              <span class="meta-label">TOKEN SIGNATURE</span>
              <span class="meta-val font-mono">${session.token.substring(0, 22)}...</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">DEVICE FINGERPRINT</span>
              <span class="meta-val font-mono">${session.deviceFingerprint}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">LOGIN TIMESTAMP</span>
              <span class="meta-val font-mono">${new Date(session.loginTime).toLocaleTimeString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">STORAGE ENGINE</span>
              <span class="meta-val text-emerald-600 font-semibold">${session.rememberMe ? 'LocalStorage (Persistent)' : 'SessionStorage (Ephemeral)'}</span>
            </div>
          </div>
        `;
      } else {
        profileCard.innerHTML = `
          <div class="p-6 text-center text-slate-500">
            <i class="pi pi-shield text-3xl mb-2 text-slate-400"></i>
            <p>No active session found. Please authenticate to view workspace.</p>
          </div>
        `;
      }
    });
    this.cleanupFns.push(profSub);
    r.appendChild(contentBox, profileCard);

    // Workspace Quick Tools Grid
    const toolsSection = r.createElement('div');
    r.setAttribute(toolsSection, 'class', 'workspace-tools-section');
    toolsSection.innerHTML = `
      <h3 class="tools-heading">Authorized Applications & Pipelines:</h3>
      <div class="tools-grid">
        <div class="tool-tile">
          <i class="pi pi-code text-cyan-600"></i>
          <span class="tool-name">Core Framework Monorepo</span>
          <span class="tool-sub">Git Access Granted</span>
        </div>
        <div class="tool-tile">
          <i class="pi pi-server text-emerald-600"></i>
          <span class="tool-name">Cloud Dev Workstations</span>
          <span class="tool-sub">Cluster Active</span>
        </div>
        <div class="tool-tile">
          <i class="pi pi-users text-indigo-600"></i>
          <span class="tool-name">Enterprise Personnel</span>
          <span class="tool-sub">Directory Lookup</span>
        </div>
        <div class="tool-tile">
          <i class="pi pi-key text-amber-600"></i>
          <span class="tool-name">Security Key Vault</span>
          <span class="tool-sub">Audit Synchronized</span>
        </div>
      </div>
    `;
    r.appendChild(contentBox, toolsSection);

    // Actions Row
    const actionRow = r.createElement('div');
    r.setAttribute(actionRow, 'class', 'workspace-actions');

    const logoutBtn = new JarvisButton(r, {
      label: 'Sign Out & Terminate Session',
      icon: 'pi pi-power-off',
      severity: 'danger',
      class: 'w-full',
    });
    logoutBtn.clicked.subscribe(() => this.handleLogout());
    r.appendChild(actionRow, logoutBtn.getElement());

    const changePassBtn = new JarvisButton(r, {
      label: 'Change Security Password',
      icon: 'pi pi-lock',
      variant: 'outlined',
      class: 'w-full mt-2',
    });
    changePassBtn.clicked.subscribe(() => this.navigateToResetPassword());
    r.appendChild(actionRow, changePassBtn.getElement());

    r.appendChild(contentBox, actionRow);
    r.appendChild(root, contentBox);

    return root;
  }

  onDestroy(): void {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error('[WorkspaceSessionPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-workspace-session-page',
  templateUrl: './workspace-session.page.html',
  styleUrl: './workspace-session.page.css',
})(WorkspaceSessionPage);
