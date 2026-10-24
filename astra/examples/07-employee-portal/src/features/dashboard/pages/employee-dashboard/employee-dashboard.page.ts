/**
 * JARVIS Employee Dashboard Page
 * Enterprise dashboard featuring executive KPIs, interactive workspace projects
 * data table, PrimeNG search filter with fine-grained reactive signals,
 * and a profile preferences dialog with PrimeNG input fields and error handling.
 */

import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';
import { signal, computed, effect, type Signal } from '@jarvis/reactive';
import type { Router } from '@jarvis/router';
import { JarvisButton, JarvisInputText, JarvisDialog } from '@jarvis/primeng';
import { AuthenticationService } from '../../../authentication/services/authentication.service.ts';
import { DashboardService } from '../../services/dashboard.service.ts';
import type { DashboardProject, ProjectStatus } from '../../models/dashboard.models.ts';

export class EmployeeDashboardPage implements OnInit, OnDestroy {
  readonly authService: AuthenticationService;
  readonly dashboardService: DashboardService;
  readonly router: Router | null;

  // Profile Edit Modal State
  readonly isProfileModalOpen: Signal<boolean> = signal(false);
  readonly editDisplayName: Signal<string> = signal('');
  readonly editPhone: Signal<string> = signal('');
  readonly editOffice: Signal<string> = signal('');
  readonly isProfileSubmitted: Signal<boolean> = signal(false);
  readonly profileSaveSuccess: Signal<string | null> = signal(null);

  // Profile Form Field Validations
  readonly nameError = computed(() => {
    if (!this.isProfileSubmitted()) return null;
    const val = this.editDisplayName().trim();
    if (!val) return 'Display name is required.';
    if (val.length < 3) return 'Display name must be at least 3 characters.';
    return null;
  });

  readonly phoneError = computed(() => {
    if (!this.isProfileSubmitted()) return null;
    const val = this.editPhone().trim();
    if (!val) return 'Emergency contact phone is required.';
    if (val.length < 8) return 'Phone must be at least 8 digits.';
    return null;
  });

  private cleanupFns: Array<() => void> = [];

  constructor(
    authService?: AuthenticationService,
    dashboardService?: DashboardService,
    router?: Router
  ) {
    this.authService = authService || new AuthenticationService();
    this.dashboardService = dashboardService || new DashboardService();
    this.router = router || null;
  }

  onInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.editDisplayName.set(user.name);
      this.editPhone.set('+1 (212) 555-0199');
      this.editOffice.set('Stark Tower, Executive Enclave 90');
    }
  }

  handleSearchInput(query: string): void {
    this.dashboardService.setSearchQuery(query);
  }

  handleFilterStatus(status: ProjectStatus | 'ALL'): void {
    this.dashboardService.setStatusFilter(status);
  }

  openProfileModal(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.editDisplayName.set(user.name);
    }
    this.isProfileSubmitted.set(false);
    this.profileSaveSuccess.set(null);
    this.isProfileModalOpen.set(true);
  }

  closeProfileModal(): void {
    this.isProfileModalOpen.set(false);
    this.isProfileSubmitted.set(false);
    this.profileSaveSuccess.set(null);
  }

  saveProfileChanges(): boolean {
    this.isProfileSubmitted.set(true);

    if (this.nameError() || this.phoneError()) {
      return false;
    }

    // Update currentUser name in authService if available
    const user = this.authService.currentUser();
    if (user) {
      this.authService.currentUser.set({
        ...user,
        name: this.editDisplayName().trim(),
      });
    }

    this.profileSaveSuccess.set('Profile and security contact updated successfully.');
    setTimeout(() => {
      this.closeProfileModal();
    }, 800);
    return true;
  }

  handleLogout(): void {
    this.authService.logout();
    if (this.router) {
      this.router.navigate(['login']);
    }
  }

  navigateToPasswordReset(): void {
    if (this.router) {
      this.router.navigate(['reset-password']);
    }
  }

  render(r: Renderer): any {
    const root = r.createElement('section');
    r.setAttribute(root, 'class', 'employee-dashboard');
    r.setAttribute(root, 'aria-labelledby', 'dashboard-heading');

    // 1. Top Identity Header Bar
    const topBar = r.createElement('header');
    r.setAttribute(topBar, 'class', 'dashboard-topbar');

    const identityBlock = r.createElement('div');
    r.setAttribute(identityBlock, 'class', 'employee-identity-block');

    const avatarWrap = r.createElement('div');
    r.setAttribute(avatarWrap, 'class', 'avatar-wrapper');
    const avatarImg = r.createElement('img');
    r.setAttribute(avatarImg, 'class', 'employee-avatar');
    const statusDot = r.createElement('span');
    r.setAttribute(statusDot, 'class', 'avatar-status-dot');
    r.appendChild(avatarWrap, avatarImg);
    r.appendChild(avatarWrap, statusDot);
    r.appendChild(identityBlock, avatarWrap);

    const userTextCol = r.createElement('div');
    const nameRow = r.createElement('div');
    r.setAttribute(nameRow, 'class', 'employee-name-row');
    const nameEl = r.createElement('h1');
    r.setAttribute(nameEl, 'id', 'dashboard-heading');
    r.setAttribute(nameEl, 'class', 'employee-name');
    const clearanceBadge = r.createElement('span');
    r.setAttribute(clearanceBadge, 'class', 'clearance-badge font-mono');
    r.appendChild(nameRow, nameEl);
    r.appendChild(nameRow, clearanceBadge);

    const metaRow = r.createElement('div');
    r.setAttribute(metaRow, 'class', 'employee-meta-row');
    r.appendChild(userTextCol, nameRow);
    r.appendChild(userTextCol, metaRow);
    r.appendChild(identityBlock, userTextCol);
    r.appendChild(topBar, identityBlock);

    // Sync User Identity Reactively
    const userEffect = effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        r.setAttribute(avatarImg, 'src', user.avatar);
        r.setAttribute(avatarImg, 'alt', user.name);
        nameEl.textContent = `${user.name} — Employee Workspace`;
        clearanceBadge.textContent = user.clearanceLevel;
        metaRow.innerHTML = `
          <span class="employee-role font-medium">${user.role}</span>
          <span class="meta-separator" aria-hidden="true">·</span>
          <span class="employee-dept">${user.department}</span>
          <span class="meta-separator" aria-hidden="true">·</span>
          <span class="employee-id font-mono text-emerald-700 font-semibold">${user.id}</span>
        `;
      } else {
        r.setAttribute(avatarImg, 'src', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');
        r.setAttribute(avatarImg, 'alt', 'Employee Profile');
        nameEl.textContent = 'Authorized Employee Workspace';
        clearanceBadge.textContent = 'LEVEL 5';
        metaRow.innerHTML = `<span class="employee-role">Identity Active</span>`;
      }
    });
    this.cleanupFns.push(userEffect);

    // Header Action Buttons
    const actionsBlock = r.createElement('div');
    r.setAttribute(actionsBlock, 'class', 'dashboard-actions');

    const editBtn = new JarvisButton(r, {
      label: 'Profile Settings',
      icon: 'pi pi-user-edit',
      variant: 'outlined',
      size: 'small',
      class: 'btn-profile-edit',
    });
    editBtn.clicked.subscribe(() => this.openProfileModal());
    r.appendChild(actionsBlock, editBtn.getElement());

    const logoutBtn = new JarvisButton(r, {
      label: 'Sign Out',
      icon: 'pi pi-power-off',
      severity: 'danger',
      size: 'small',
      class: 'btn-sign-out',
    });
    logoutBtn.clicked.subscribe(() => this.handleLogout());
    r.appendChild(actionsBlock, logoutBtn.getElement());
    r.appendChild(topBar, actionsBlock);
    r.appendChild(root, topBar);

    // 2. 4 Executive KPI Metrics Grid
    const kpiGrid = r.createElement('div');
    r.setAttribute(kpiGrid, 'class', 'kpi-grid');
    r.setAttribute(kpiGrid, 'role', 'region');
    r.setAttribute(kpiGrid, 'aria-label', 'Executive Metrics');

    const kpis = this.dashboardService.kpis();
    for (const kpi of kpis) {
      const card = r.createElement('div');
      r.setAttribute(card, 'class', 'kpi-card');
      card.innerHTML = `
        <div class="kpi-card-header">
          <span class="kpi-title">${kpi.title}</span>
          <div class="kpi-icon-wrap" style="background-color: ${kpi.accentColor}18; color: ${kpi.accentColor};">
            <i class="${kpi.icon}"></i>
          </div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value">${kpi.value}</span>
          <span class="kpi-trend kpi-trend--${kpi.trend}">${kpi.trendValue}</span>
        </div>
        <span class="kpi-subtext">${kpi.subtext}</span>
      `;
      r.appendChild(kpiGrid, card);
    }
    r.appendChild(root, kpiGrid);

    // 3. Interactive Projects & Workspaces Section with PrimeNG Search Input
    const projectsSection = r.createElement('section');
    r.setAttribute(projectsSection, 'class', 'dashboard-card project-workspaces-section');

    const secHeader = r.createElement('div');
    r.setAttribute(secHeader, 'class', 'section-header-row');

    const titleCol = r.createElement('div');
    titleCol.innerHTML = `
      <h2 class="section-title">Authorized Workspaces & Active Projects</h2>
      <p class="section-subtitle">Real-time status of assigned engineering pipelines and security enclaves.</p>
    `;
    r.appendChild(secHeader, titleCol);

    const filterControls = r.createElement('div');
    r.setAttribute(filterControls, 'class', 'filter-controls');

    // PrimeNG Search Input Field
    const searchBox = r.createElement('div');
    r.setAttribute(searchBox, 'class', 'search-input-box');
    const searchIcon = r.createElement('i');
    r.setAttribute(searchIcon, 'class', 'pi pi-search search-icon');
    r.appendChild(searchBox, searchIcon);

    const searchInput = new JarvisInputText(r, {
      value: this.dashboardService.searchQuery,
      placeholder: 'Search by project or code...',
      size: 'small',
      class: 'w-full',
    });
    r.setAttribute(searchInput.getElement(), 'id', 'dashboard-search-input');
    r.setAttribute(searchInput.getElement(), 'aria-label', 'Search workspaces and projects');
    searchInput.valueChange.subscribe((val) => this.handleSearchInput(val));
    r.appendChild(searchBox, searchInput.getElement());
    r.appendChild(filterControls, searchBox);

    // Status Filter Pills
    const filterPills = r.createElement('div');
    r.setAttribute(filterPills, 'class', 'status-filter-pills');
    const filters: Array<{ label: string; key: ProjectStatus | 'ALL' }> = [
      { label: 'All', key: 'ALL' },
      { label: 'Active', key: 'ACTIVE' },
      { label: 'Review', key: 'REVIEW' },
      { label: 'Deployed', key: 'DEPLOYED' },
    ];

    const filterButtonEls: HTMLButtonElement[] = [];
    filters.forEach(f => {
      const btn = r.createElement('button');
      r.setAttribute(btn, 'type', 'button');
      r.setAttribute(btn, 'class', `status-pill ${f.key === 'ALL' ? 'active' : ''}`);
      r.setAttribute(btn, 'data-filter', f.key);
      btn.textContent = f.label;
      r.listen(btn, 'click', () => {
        this.handleFilterStatus(f.key);
        filterButtonEls.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      filterButtonEls.push(btn);
      r.appendChild(filterPills, btn);
    });
    r.appendChild(filterControls, filterPills);
    r.appendChild(secHeader, filterControls);
    r.appendChild(projectsSection, secHeader);

    // Projects Data Table
    const tableContainer = r.createElement('div');
    r.setAttribute(tableContainer, 'class', 'projects-table-container');

    const table = r.createElement('table');
    r.setAttribute(table, 'class', 'dashboard-table');
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Project Code</th>
          <th scope="col">Title & Department</th>
          <th scope="col">Clearance</th>
          <th scope="col">Status</th>
          <th scope="col">Completion</th>
          <th scope="col" style="text-align: right;">Actions</th>
        </tr>
      </thead>
    `;

    const tbody = r.createElement('tbody');
    r.setAttribute(tbody, 'class', 'projects-table-body');

    // Reactively render filtered projects
    const tableEffect = effect(() => {
      const projects = this.dashboardService.filteredProjects();
      tbody.innerHTML = '';

      if (projects.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="p-8 text-center text-slate-500">
              <i class="pi pi-filter-slash text-2xl mb-2 text-slate-400"></i>
              <p>No projects match current filter criteria.</p>
            </td>
          </tr>
        `;
        return;
      }

      for (const proj of projects) {
        const tr = r.createElement('tr');
        tr.innerHTML = `
          <td><span class="project-code-tag">${proj.code}</span></td>
          <td>
            <span class="project-title">${proj.title}</span>
            <span class="project-dept">${proj.department} · Lead: ${proj.lead}</span>
          </td>
          <td><span class="clearance-badge font-mono">${proj.clearance}</span></td>
          <td>
            <span class="status-tag status-tag--${proj.status}">
              <i class="pi pi-circle-fill text-[6px]"></i>
              <span>${proj.status}</span>
            </span>
          </td>
          <td>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${proj.progress}%;"></div>
            </div>
            <span class="font-mono text-xs font-semibold">${proj.progress}%</span>
          </td>
          <td style="text-align: right;">
            <button type="button" class="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition">
              Launch <i class="pi pi-external-link text-[10px] ml-1"></i>
            </button>
          </td>
        `;
        r.appendChild(tbody, tr);
      }
    });
    this.cleanupFns.push(tableEffect);

    r.appendChild(table, tbody);
    r.appendChild(tableContainer, table);
    r.appendChild(projectsSection, tableContainer);
    r.appendChild(root, projectsSection);

    // 4. Split Bottom Grid: Security Audit & Quick Tools
    const bottomGrid = r.createElement('div');
    r.setAttribute(bottomGrid, 'class', 'bottom-split-grid');

    // Audit Card
    const auditCard = r.createElement('section');
    r.setAttribute(auditCard, 'class', 'dashboard-card');
    auditCard.innerHTML = `
      <div class="card-header">
        <h3 class="card-title"><i class="pi pi-shield text-emerald-600"></i> Identity & Audit Trail</h3>
        <span class="audit-counter-badge font-mono">LIVE ENCLAVE</span>
      </div>
    `;

    const auditList = r.createElement('div');
    r.setAttribute(auditList, 'class', 'audit-list');
    const logs = this.dashboardService.auditLogs();
    for (const log of logs) {
      const item = r.createElement('div');
      r.setAttribute(item, 'class', 'audit-item');
      item.innerHTML = `
        <div>
          <div class="audit-event-title">${log.event}</div>
          <div class="audit-event-meta font-mono">${log.actor} · ${log.ipAddress}</div>
        </div>
        <span class="font-mono text-[11px] text-slate-500">${log.timestamp}</span>
      `;
      r.appendChild(auditList, item);
    }
    r.appendChild(auditCard, auditList);
    r.appendChild(bottomGrid, auditCard);

    // Quick Tools Card
    const toolsCard = r.createElement('section');
    r.setAttribute(toolsCard, 'class', 'dashboard-card');
    toolsCard.innerHTML = `
      <div class="card-header">
        <h3 class="card-title"><i class="pi pi-th-large text-emerald-600"></i> Quick Workspace Tools</h3>
        <span class="tools-subtext text-xs text-slate-500">SSO Authenticated</span>
      </div>
      <div class="quick-tools-grid">
        <div class="quick-tool-tile">
          <i class="pi pi-code text-cyan-600 text-xl mb-2"></i>
          <span class="tool-title">Monorepo Terminal</span>
          <span class="tool-desc">v0.1.0 · Fast HMR</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-server text-emerald-600 text-xl mb-2"></i>
          <span class="tool-title">Nexus Cloud Mesh</span>
          <span class="tool-desc">12 Nodes Online</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-key text-amber-600 text-xl mb-2"></i>
          <span class="tool-title">Key Vault HSM</span>
          <span class="tool-desc">Zero-Knowledge RSA</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-chart-line text-purple-600 text-xl mb-2"></i>
          <span class="tool-title">Telemetry Observability</span>
          <span class="tool-desc">99.99% Uptime</span>
        </div>
      </div>
    `;
    r.appendChild(bottomGrid, toolsCard);
    r.appendChild(root, bottomGrid);

    // 5. PrimeNG Dialog for Profile Settings with Form Validation and Error Handling
    const profileDialog = new JarvisDialog(r, {
      header: 'Employee Profile & Security Preferences',
      visible: this.isProfileModalOpen,
      width: '460px',
      modal: true,
      closable: true,
    });
    profileDialog.visibleChange.subscribe((v) => {
      this.isProfileModalOpen.set(v);
      if (!v) this.isProfileSubmitted.set(false);
    });

    const modalBody = r.createElement('div');
    r.setAttribute(modalBody, 'class', 'profile-modal-form');

    // Success Banner inside modal
    const modalAlertBox = r.createElement('div');
    r.setAttribute(modalAlertBox, 'class', 'jarvis-sr-only');
    const modalAlertEffect = effect(() => {
      const msg = this.profileSaveSuccess();
      if (msg) {
        r.setAttribute(modalAlertBox, 'class', 'jarvis-alert-banner jarvis-alert-banner--success');
        modalAlertBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${msg}</span>`;
      } else {
        r.setAttribute(modalAlertBox, 'class', 'jarvis-sr-only');
        modalAlertBox.innerHTML = '';
      }
    });
    this.cleanupFns.push(modalAlertEffect);
    r.appendChild(modalBody, modalAlertBox);

    // Field 1: Display Name with PrimeNG Input & Error Handling
    const nameGroup = r.createElement('div');
    r.setAttribute(nameGroup, 'class', 'jarvis-form-group');
    const nameLabel = r.createElement('label');
    r.setAttribute(nameLabel, 'class', 'jarvis-form-label');
    r.setAttribute(nameLabel, 'for', 'edit-name-input');
    nameLabel.textContent = 'Preferred Display Name';
    r.appendChild(nameGroup, nameLabel);

    const nameInput = new JarvisInputText(r, {
      value: this.editDisplayName,
      placeholder: 'Full name',
      invalid: () => Boolean(this.nameError()),
      class: 'w-full',
    });
    r.setAttribute(nameInput.getElement(), 'id', 'edit-name-input');
    nameInput.valueChange.subscribe((val) => this.editDisplayName.set(val));
    r.appendChild(nameGroup, nameInput.getElement());

    const nameErrorEl = r.createElement('div');
    r.setAttribute(nameErrorEl, 'class', 'jarvis-sr-only');
    const nameErrEffect = effect(() => {
      const err = this.nameError();
      if (err) {
        r.setAttribute(nameErrorEl, 'class', 'jarvis-form-error mt-1');
        nameErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(nameErrorEl, 'class', 'jarvis-sr-only');
        nameErrorEl.innerHTML = '';
      }
    });
    this.cleanupFns.push(nameErrEffect);
    r.appendChild(nameGroup, nameErrorEl);
    r.appendChild(modalBody, nameGroup);

    // Field 2: Direct Dial / Phone with PrimeNG Input & Error Handling
    const phoneGroup = r.createElement('div');
    r.setAttribute(phoneGroup, 'class', 'jarvis-form-group');
    const phoneLabel = r.createElement('label');
    r.setAttribute(phoneLabel, 'class', 'jarvis-form-label');
    r.setAttribute(phoneLabel, 'for', 'edit-phone-input');
    phoneLabel.textContent = 'Emergency Contact / Direct Phone';
    r.appendChild(phoneGroup, phoneLabel);

    const phoneInput = new JarvisInputText(r, {
      value: this.editPhone,
      placeholder: '+1 (555) 000-0000',
      invalid: () => Boolean(this.phoneError()),
      class: 'w-full',
    });
    r.setAttribute(phoneInput.getElement(), 'id', 'edit-phone-input');
    phoneInput.valueChange.subscribe((val) => this.editPhone.set(val));
    r.appendChild(phoneGroup, phoneInput.getElement());

    const phoneErrorEl = r.createElement('div');
    r.setAttribute(phoneErrorEl, 'class', 'jarvis-sr-only');
    const phoneErrEffect = effect(() => {
      const err = this.phoneError();
      if (err) {
        r.setAttribute(phoneErrorEl, 'class', 'jarvis-form-error mt-1');
        phoneErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(phoneErrorEl, 'class', 'jarvis-sr-only');
        phoneErrorEl.innerHTML = '';
      }
    });
    this.cleanupFns.push(phoneErrEffect);
    r.appendChild(phoneGroup, phoneErrorEl);
    r.appendChild(modalBody, phoneGroup);

    // Field 3: Office Location
    const officeGroup = r.createElement('div');
    r.setAttribute(officeGroup, 'class', 'jarvis-form-group');
    const officeLabel = r.createElement('label');
    r.setAttribute(officeLabel, 'class', 'jarvis-form-label');
    r.setAttribute(officeLabel, 'for', 'edit-office-input');
    officeLabel.textContent = 'Designated Office Location';
    r.appendChild(officeGroup, officeLabel);

    const officeInput = new JarvisInputText(r, {
      value: this.editOffice,
      placeholder: 'e.g. Stark Tower Suite 90',
      class: 'w-full',
    });
    r.setAttribute(officeInput.getElement(), 'id', 'edit-office-input');
    officeInput.valueChange.subscribe((val) => this.editOffice.set(val));
    r.appendChild(officeGroup, officeInput.getElement());
    r.appendChild(modalBody, officeGroup);

    // Modal Footer Actions with PrimeNG Buttons
    const footerActions = r.createElement('div');
    r.setAttribute(footerActions, 'class', 'modal-footer-actions');

    const cancelBtn = new JarvisButton(r, {
      label: 'Cancel',
      variant: 'text',
      size: 'small',
      class: 'text-slate-600',
    });
    cancelBtn.clicked.subscribe(() => this.closeProfileModal());
    r.appendChild(footerActions, cancelBtn.getElement());

    const saveBtn = new JarvisButton(r, {
      label: 'Save Changes',
      icon: 'pi pi-check',
      severity: 'primary',
      size: 'small',
    });
    saveBtn.clicked.subscribe(() => this.saveProfileChanges());
    r.appendChild(footerActions, saveBtn.getElement());
    r.appendChild(modalBody, footerActions);

    r.appendChild(profileDialog.getElement(), modalBody);
    r.appendChild(root, profileDialog.getElement());

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
        console.error('[EmployeeDashboardPage] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];
  }
}

Component({
  selector: 'app-employee-dashboard-page',
  templateUrl: './employee-dashboard.page.html',
  styleUrl: './employee-dashboard.page.css',
})(EmployeeDashboardPage);
