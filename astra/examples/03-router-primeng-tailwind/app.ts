import { signal, computed, effect } from '../../packages/reactive/src/index.ts';
import { DOMRenderer } from '../../packages/renderer/src/index.ts';
import {
  provideRouter,
  RouterOutlet,
  bindRouterLink,
  type Routes,
  type ActivatedRoute,
  type Router,
} from '../../packages/router/src/index.ts';
import {
  providePrimeNG,
  JarvisButton,
  JarvisInputText,
  JarvisSelect,
  JarvisCheckbox,
  JarvisDialog,
  JarvisTable,
} from '../../adapters/primeng/src/index.ts';
import { AuthService, DUMMY_USERS } from '../04-login-storage/auth.service.ts';
import { LoginComponent as JarvisLoginCore } from '../04-login-storage/login.component.ts';

// 1. Theme Configuration
providePrimeNG({
  theme: 'Aura',
  ripple: true,
  cssLayer: true,
});

const renderer = new DOMRenderer();

// 2. Shared Data Model & State
export interface Employee {
  id: string;
  name: string;
  role: string;
  dept: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Inactive';
}

export const initialEmployees: Employee[] = [
  { id: 'EMP001', name: 'Sophia Martinez', role: 'Staff Frontend Architect', dept: 'Engineering', salary: 165000, status: 'Active' },
  { id: 'EMP002', name: 'Alexander Wright', role: 'Compiler Engineer', dept: 'Engineering', salary: 155000, status: 'Active' },
  { id: 'EMP003', name: 'Elena Rostova', role: 'Principal Designer', dept: 'Design', salary: 140000, status: 'Active' },
  { id: 'EMP004', name: 'Marcus Chen', role: 'Lead Product Manager', dept: 'Product', salary: 150000, status: 'On Leave' },
  { id: 'EMP005', name: 'Liam O\'Connor', role: 'Systems Developer', dept: 'Engineering', salary: 135000, status: 'Active' },
];

export const employeesState = signal<Employee[]>(initialEmployees);

// 3. Routed Components (Angular-style)

/**
 * Dashboard View Component
 */
export class DashboardComponent {
  router!: Router;

  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'space-y-6');

    // Page Header
    const header = r.createElement('div');
    r.setAttribute(header, 'class', 'flex items-center justify-between');
    const title = r.createElement('h1');
    r.setAttribute(title, 'class', 'text-2xl font-bold text-slate-800');
    r.appendChild(title, r.createText('Executive Dashboard'));
    r.appendChild(header, title);

    // KPI Cards Grid
    const grid = r.createElement('div');
    r.setAttribute(grid, 'class', 'grid grid-cols-1 md:grid-cols-3 gap-5');

    const total = employeesState().length;
    const active = employeesState().filter((e) => e.status === 'Active').length;
    const avgSalary = Math.round(
      employeesState().reduce((acc, e) => acc + e.salary, 0) / (total || 1)
    );

    const cards = [
      { label: 'Total Personel', val: String(total), icon: 'pi pi-users', color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Active Headcount', val: String(active), icon: 'pi pi-check-circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Avg Compensation', val: `$${avgSalary.toLocaleString()}`, icon: 'pi pi-dollar', color: 'text-amber-600', bg: 'bg-amber-50' },
    ];

    for (const card of cards) {
      const cardEl = r.createElement('div');
      r.setAttribute(cardEl, 'class', 'bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between');

      const textWrap = r.createElement('div');
      const label = r.createElement('p');
      r.setAttribute(label, 'class', 'text-xs font-semibold uppercase tracking-wider text-slate-400');
      r.appendChild(label, r.createText(card.label));

      const val = r.createElement('p');
      r.setAttribute(val, 'class', 'text-2xl font-extrabold text-slate-800 mt-1');
      r.appendChild(val, r.createText(card.val));

      r.appendChild(textWrap, label);
      r.appendChild(textWrap, val);

      const iconWrap = r.createElement('div');
      r.setAttribute(iconWrap, 'class', `w-12 h-12 rounded-xl flex items-center justify-center text-xl ${card.bg} ${card.color}`);
      const icon = r.createElement('i');
      r.setAttribute(icon, 'class', card.icon);
      r.appendChild(iconWrap, icon);

      r.appendChild(cardEl, textWrap);
      r.appendChild(cardEl, iconWrap);
      r.appendChild(grid, cardEl);
    }

    // Call to Action Card
    const ctaCard = r.createElement('div');
    r.setAttribute(ctaCard, 'class', 'bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6');

    const ctaText = r.createElement('div');
    const ctaHeading = r.createElement('h2');
    r.setAttribute(ctaHeading, 'class', 'text-lg font-bold text-slate-800');
    r.appendChild(ctaHeading, r.createText('Personnel Directory Management'));
    const ctaSub = r.createElement('p');
    r.setAttribute(ctaSub, 'class', 'text-sm text-slate-500 mt-1');
    r.appendChild(ctaSub, r.createText('Review team rosters, compensation allocations, and update profiles with fine-grained reactivity.'));
    r.appendChild(ctaText, ctaHeading);
    r.appendChild(ctaText, ctaSub);

    const navBtn = new JarvisButton(r, {
      label: 'Open Directory',
      icon: 'pi pi-arrow-right',
      severity: 'primary',
    });
    navBtn.clicked.subscribe(() => {
      this.router.navigate(['employees']);
    });

    r.appendChild(ctaCard, ctaText);
    r.appendChild(ctaCard, navBtn.getElement());

    r.appendChild(root, header);
    r.appendChild(root, grid);
    r.appendChild(root, ctaCard);

    return root;
  }
}

/**
 * Personnel List Component
 */
export class EmployeeListComponent {
  router!: Router;

  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'space-y-6');

    // Page Header with Action
    const header = r.createElement('div');
    r.setAttribute(header, 'class', 'flex items-center justify-between');

    const titleWrap = r.createElement('div');
    const title = r.createElement('h1');
    r.setAttribute(title, 'class', 'text-2xl font-bold text-slate-800');
    r.appendChild(title, r.createText('Personnel Directory'));
    const sub = r.createElement('p');
    r.setAttribute(sub, 'class', 'text-sm text-slate-500 mt-1');
    r.appendChild(sub, r.createText('Select any team member to view and edit details via dynamic Angular routing.'));
    r.appendChild(titleWrap, title);
    r.appendChild(titleWrap, sub);

    r.appendChild(header, titleWrap);

    // PrimeNG Data Table
    const table = new JarvisTable<Employee>(r, {
      value: employeesState,
      paginator: true,
      rows: 5,
      columns: [
        { field: 'id', header: 'ID', sortable: true },
        { field: 'name', header: 'Employee Name', sortable: true },
        { field: 'role', header: 'Job Role', sortable: true },
        { field: 'dept', header: 'Department', sortable: true },
        {
          field: 'salary',
          header: 'Salary',
          sortable: true,
          formatter: (val) => `$${Number(val).toLocaleString()}`,
        },
        { field: 'status', header: 'Status', sortable: true },
        {
          field: 'id',
          header: 'Action',
          formatter: (id) => `[Edit ${id}]`,
        },
      ],
    });

    // Quick navigation buttons bar below table
    const quickNav = r.createElement('div');
    r.setAttribute(quickNav, 'class', 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between');
    const info = r.createElement('span');
    r.setAttribute(info, 'class', 'text-sm text-slate-600 font-medium');
    r.appendChild(info, r.createText('Quick profile shortcuts:'));
    r.appendChild(quickNav, info);

    const shortcutsWrap = r.createElement('div');
    r.setAttribute(shortcutsWrap, 'class', 'flex gap-2');

    for (const emp of employeesState().slice(0, 3)) {
      const btn = new JarvisButton(r, {
        label: emp.name.split(' ')[0],
        variant: 'outlined',
        size: 'small',
      });
      btn.clicked.subscribe(() => {
        this.router.navigate(['employees', emp.id]);
      });
      r.appendChild(shortcutsWrap, btn.getElement());
    }
    r.appendChild(quickNav, shortcutsWrap);

    r.appendChild(root, header);
    r.appendChild(root, table.getElement());
    r.appendChild(root, quickNav);

    return root;
  }
}

/**
 * Employee Detail Component (Demonstrates route parameters :id)
 */
export class EmployeeDetailComponent {
  activatedRoute!: ActivatedRoute;
  router!: Router;

  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'space-y-6 max-w-3xl');

    // Read param from ActivatedRoute signal
    const empId = this.activatedRoute.params().id;
    const employee = employeesState().find((e) => e.id === empId);

    // Breadcrumb / Back button
    const topBar = r.createElement('div');
    r.setAttribute(topBar, 'class', 'flex items-center gap-4');

    const backBtn = new JarvisButton(r, {
      label: 'Back to Personel',
      icon: 'pi pi-arrow-left',
      variant: 'text',
      size: 'small',
    });
    backBtn.clicked.subscribe(() => {
      this.router.navigate(['employees']);
    });
    r.appendChild(topBar, backBtn.getElement());

    if (!employee) {
      const errCard = r.createElement('div');
      r.setAttribute(errCard, 'class', 'bg-red-50 text-red-700 p-6 rounded-xl border border-red-200');
      r.appendChild(errCard, r.createText(`Employee record '${empId}' not found.`));
      r.appendChild(root, topBar);
      r.appendChild(root, errCard);
      return root;
    }

    // Detail Profile Card
    const card = r.createElement('div');
    r.setAttribute(card, 'class', 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden');

    // Header banner with Avatar
    const cardHeader = r.createElement('div');
    r.setAttribute(cardHeader, 'class', 'p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between');

    const profileInfo = r.createElement('div');
    r.setAttribute(profileInfo, 'class', 'flex items-center gap-4');
    const avatar = r.createElement('div');
    r.setAttribute(avatar, 'class', 'w-14 h-14 rounded-full bg-white text-emerald-700 font-extrabold text-xl flex items-center justify-center shadow');
    r.appendChild(avatar, r.createText(employee.name.split(' ').map((n) => n[0]).join('')));

    const meta = r.createElement('div');
    const empName = r.createElement('h2');
    r.setAttribute(empName, 'class', 'text-xl font-bold');
    r.appendChild(empName, r.createText(employee.name));

    const empIdBadge = r.createElement('span');
    r.setAttribute(empIdBadge, 'class', 'text-xs text-emerald-100 font-mono');
    r.appendChild(empIdBadge, r.createText(`ID: ${employee.id} • ${employee.dept}`));

    r.appendChild(meta, empName);
    r.appendChild(meta, empIdBadge);
    r.appendChild(profileInfo, avatar);
    r.appendChild(profileInfo, meta);

    const statusBadge = r.createElement('span');
    r.setAttribute(statusBadge, 'class', 'text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white');
    r.appendChild(statusBadge, r.createText(employee.status));

    r.appendChild(cardHeader, profileInfo);
    r.appendChild(cardHeader, statusBadge);
    r.appendChild(card, cardHeader);

    // Form fields inside card
    const formBody = r.createElement('div');
    r.setAttribute(formBody, 'class', 'p-6 space-y-4');

    // Local Signals for Editing
    const roleSig = signal(employee.role);
    const salarySig = signal(String(employee.salary));
    const deptSig = signal(employee.dept);
    const activeSig = signal(employee.status === 'Active');

    // Role Input
    const roleField = r.createElement('div');
    r.setAttribute(roleField, 'class', 'space-y-1');
    const roleLabel = r.createElement('label');
    r.setAttribute(roleLabel, 'class', 'text-xs font-semibold text-slate-600');
    r.appendChild(roleLabel, r.createText('Job Role'));
    const roleInput = new JarvisInputText(r, { value: roleSig });
    roleInput.valueChange.subscribe((v) => roleSig.set(v));
    r.appendChild(roleField, roleLabel);
    r.appendChild(roleField, roleInput.getElement());
    r.appendChild(formBody, roleField);

    // Department Select
    const deptField = r.createElement('div');
    r.setAttribute(deptField, 'class', 'space-y-1');
    const deptLabel = r.createElement('label');
    r.setAttribute(deptLabel, 'class', 'text-xs font-semibold text-slate-600');
    r.appendChild(deptLabel, r.createText('Department'));
    const deptSelect = new JarvisSelect(r, {
      options: ['Engineering', 'Design', 'Product', 'Marketing'],
      value: deptSig,
    });
    deptSelect.valueChange.subscribe((v) => deptSig.set(v));
    r.appendChild(deptField, deptLabel);
    r.appendChild(deptField, deptSelect.getElement());
    r.appendChild(formBody, deptField);

    // Active Checkbox
    const activeField = r.createElement('div');
    r.setAttribute(activeField, 'class', 'pt-2');
    const activeCheckbox = new JarvisCheckbox(r, {
      label: 'Active Full-time Status',
      checked: activeSig,
    });
    activeCheckbox.checkedChange.subscribe((c) => activeSig.set(c));
    r.appendChild(activeField, activeCheckbox.getElement());
    r.appendChild(formBody, activeField);

    // Footer actions
    const footer = r.createElement('div');
    r.setAttribute(footer, 'class', 'flex items-center justify-between pt-6 border-t border-slate-100');

    const cancelBtn = new JarvisButton(r, {
      label: 'Cancel',
      variant: 'text',
    });
    cancelBtn.clicked.subscribe(() => {
      this.router.navigate(['employees']);
    });

    const saveBtn = new JarvisButton(r, {
      label: 'Save Changes',
      icon: 'pi pi-check',
      severity: 'primary',
    });
    saveBtn.clicked.subscribe(() => {
      // Update shared state
      employeesState.update((list) =>
        list.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                role: roleSig(),
                dept: deptSig(),
                salary: Number(salarySig()) || item.salary,
                status: activeSig() ? 'Active' : 'Inactive',
              }
            : item
        )
      );
      this.router.navigate(['employees']);
    });

    r.appendChild(footer, cancelBtn.getElement());
    r.appendChild(footer, saveBtn.getElement());
    r.appendChild(formBody, footer);

    r.appendChild(card, formBody);
    r.appendChild(root, topBar);
    r.appendChild(root, card);

    return root;
  }
}

/**
 * Settings View Component
 */
export class SettingsComponent {
  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'space-y-6 max-w-2xl');

    const title = r.createElement('h1');
    r.setAttribute(title, 'class', 'text-2xl font-bold text-slate-800');
    r.appendChild(title, r.createText('System Configuration'));

    const card = r.createElement('div');
    r.setAttribute(card, 'class', 'bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4');

    const cb1 = new JarvisCheckbox(r, { label: 'Enable Automatic Telemetry', checked: true });
    const cb2 = new JarvisCheckbox(r, { label: 'Enable Dark Mode Tokens', checked: false });
    const cb3 = new JarvisCheckbox(r, { label: 'Strict CanActivate Guard Verification', checked: true });

    r.appendChild(card, cb1.getElement());
    r.appendChild(card, cb2.getElement());
    r.appendChild(card, cb3.getElement());

    r.appendChild(root, title);
    r.appendChild(root, card);
    return root;
  }
}

/**
 * 404 Not Found Component
 */
export class NotFoundComponent {
  router!: Router;

  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'text-center py-16 space-y-4');

    const h1 = r.createElement('h1');
    r.setAttribute(h1, 'class', 'text-6xl font-black text-slate-300');
    r.appendChild(h1, r.createText('404'));

    const p = r.createElement('p');
    r.setAttribute(p, 'class', 'text-slate-600 font-medium');
    r.appendChild(p, r.createText('Requested route was not found in the Jarvis Router table.'));

    const btn = new JarvisButton(r, {
      label: 'Return to Dashboard',
      icon: 'pi pi-home',
      severity: 'primary',
    });
    btn.clicked.subscribe(() => {
      this.router.navigate(['dashboard']);
    });

    r.appendChild(root, h1);
    r.appendChild(root, p);
    r.appendChild(root, btn.getElement());
    return root;
  }
}

/**
 * Shared Authentication Service instance with LocalStorage persistence
 */
export const authService = new AuthService();

/**
 * Angular-style CanActivate Guard for protected routes
 */
export const authGuard = async (): Promise<boolean> => {
  if (authService.isAuthenticated()) {
    return true;
  }
  // Navigate to login if not authenticated
  if (typeof router !== 'undefined') {
    router.navigate(['login']);
  }
  return false;
};

/**
 * Login View Component with PrimeNG widgets & LocalStorage integration
 */
export class LoginComponent {
  router!: Router;
  readonly email = signal('stark@jarvis.ai');
  readonly password = signal('password123');
  readonly rememberMe = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isLoading = signal(false);

  render(r: any) {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'max-w-xl mx-auto py-8 px-4 space-y-6');

    // Hero Header
    const hero = r.createElement('div');
    r.setAttribute(hero, 'class', 'text-center space-y-2');
    const h1 = r.createElement('h1');
    r.setAttribute(h1, 'class', 'text-3xl font-extrabold text-slate-800 tracking-tight');
    r.appendChild(h1, r.createText('Authentication & Access Control'));
    const sub = r.createElement('p');
    r.setAttribute(sub, 'class', 'text-sm text-slate-500');
    r.appendChild(sub, r.createText('Protected access with JARVIS Signals and LocalStorage session persistence.'));
    r.appendChild(hero, h1);
    r.appendChild(hero, sub);

    // Form Card
    const card = r.createElement('div');
    r.setAttribute(card, 'class', 'bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6');

    // 1-Click Profile Presets
    const presetsBox = r.createElement('div');
    r.setAttribute(presetsBox, 'class', 'p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5');
    const presetsLabel = r.createElement('span');
    r.setAttribute(presetsLabel, 'class', 'text-xs font-semibold text-slate-500 uppercase tracking-wider block');
    r.appendChild(presetsLabel, r.createText('1-Click Demo Profiles:'));
    r.appendChild(presetsBox, presetsLabel);

    const presetGrid = r.createElement('div');
    r.setAttribute(presetGrid, 'class', 'grid grid-cols-1 sm:grid-cols-3 gap-2');
    for (const u of DUMMY_USERS) {
      const pBtn = r.createElement('button');
      r.setAttribute(pBtn, 'type', 'button');
      r.setAttribute(pBtn, 'class', 'p-2.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left');
      
      const pName = r.createElement('div');
      r.setAttribute(pName, 'class', 'text-xs font-bold text-slate-800 truncate');
      r.appendChild(pName, r.createText(u.name));
      
      const pRole = r.createElement('div');
      r.setAttribute(pRole, 'class', 'text-[11px] text-slate-500 truncate');
      r.appendChild(pRole, r.createText(u.role));

      r.appendChild(pBtn, pName);
      r.appendChild(pBtn, pRole);

      r.listen(pBtn, 'click', () => {
        this.email.set(u.email);
        this.password.set(u.password);
        this.errorMessage.set(null);
      });

      r.appendChild(presetGrid, pBtn);
    }
    r.appendChild(presetsBox, presetGrid);

    // Notification banner
    const alertBox = r.createElement('div');
    effect(() => {
      const err = this.errorMessage();
      const succ = this.successMessage();
      if (err) {
        r.setAttribute(alertBox, 'class', 'p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700 block');
        alertBox.textContent = err;
      } else if (succ) {
        r.setAttribute(alertBox, 'class', 'p-3.5 rounded-xl text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 block');
        alertBox.textContent = succ;
      } else {
        r.setAttribute(alertBox, 'class', 'hidden');
        alertBox.textContent = '';
      }
    });

    // Inputs using PrimeNG adapters
    const formFields = r.createElement('div');
    r.setAttribute(formFields, 'class', 'space-y-4');

    // Email field
    const emailGroup = r.createElement('div');
    r.setAttribute(emailGroup, 'class', 'space-y-1.5');
    const emailLabel = r.createElement('label');
    r.setAttribute(emailLabel, 'class', 'block text-xs font-bold uppercase tracking-wider text-slate-600');
    r.appendChild(emailLabel, r.createText('Work Email'));
    const emailInput = new JarvisInputText(r, {
      value: this.email,
      placeholder: 'stark@jarvis.ai',
    });
    emailInput.valueChange.subscribe((v) => this.email.set(v));
    r.appendChild(emailGroup, emailLabel);
    r.appendChild(emailGroup, emailInput.getElement());

    // Password field
    const passGroup = r.createElement('div');
    r.setAttribute(passGroup, 'class', 'space-y-1.5');
    const passLabel = r.createElement('label');
    r.setAttribute(passLabel, 'class', 'block text-xs font-bold uppercase tracking-wider text-slate-600');
    r.appendChild(passLabel, r.createText('Password / Secret Key'));
    const passInput = new JarvisInputText(r, {
      value: this.password,
      placeholder: 'password123',
    });
    passInput.valueChange.subscribe((v) => this.password.set(v));
    r.appendChild(passGroup, passLabel);
    r.appendChild(passGroup, passInput.getElement());

    // Remember Me Checkbox
    const rememberBox = new JarvisCheckbox(r, {
      label: 'Persist session in LocalStorage',
      checked: this.rememberMe(),
    });
    rememberBox.checkedChange.subscribe((c) => this.rememberMe.set(c));

    r.appendChild(formFields, emailGroup);
    r.appendChild(formFields, passGroup);
    r.appendChild(formFields, rememberBox.getElement());

    // Action Submit Button
    const submitBtn = new JarvisButton(r, {
      label: 'Sign In to Portal',
      icon: 'pi pi-sign-in',
      severity: 'primary',
      loading: this.isLoading,
    });
    submitBtn.clicked.subscribe(async () => {
      this.errorMessage.set(null);
      this.successMessage.set(null);

      if (!this.email() || !this.email().includes('@')) {
        this.errorMessage.set('Please provide a valid corporate email address.');
        return;
      }
      if (!this.password() || this.password().length < 6) {
        this.errorMessage.set('Password must contain at least 6 characters.');
        return;
      }

      this.isLoading.set(true);

      const res = authService.login(this.email(), this.password(), this.rememberMe());
      this.isLoading.set(false);

      if (res.success) {
        const u = authService.currentUser();
        this.successMessage.set(`Welcome back, ${u?.name}! Redirecting to Dashboard...`);
        setTimeout(() => {
          this.router.navigate(['dashboard']);
        }, 500);
      } else {
        this.errorMessage.set(res.message || 'Authentication failed.');
      }
    });

    r.appendChild(card, presetsBox);
    r.appendChild(card, alertBox);
    r.appendChild(card, formFields);
    r.appendChild(card, submitBtn.getElement());

    // Active session status widget
    const sessionCard = r.createElement('div');
    r.setAttribute(sessionCard, 'class', 'p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3');
    effect(() => {
      const isAuth = authService.isAuthenticated();
      const user = authService.currentUser();
      sessionCard.innerHTML = '';

      if (isAuth && user) {
        const row = r.createElement('div');
        r.setAttribute(row, 'class', 'flex items-center justify-between');
        const userDesc = r.createElement('div');
        userDesc.innerHTML = `<span class="text-xs font-bold text-slate-800">${user.name}</span> <span class="text-[11px] text-emerald-600 font-semibold">(${user.role})</span><div class="text-[11px] text-slate-500 font-mono">${user.email}</div>`;
        
        const logoutBtn = new JarvisButton(r, {
          label: 'Sign Out',
          icon: 'pi pi-power-off',
          severity: 'danger',
          size: 'small',
        });
        logoutBtn.clicked.subscribe(() => {
          authService.logout();
          this.successMessage.set(null);
          this.errorMessage.set('Logged out and cleared LocalStorage.');
        });

        r.appendChild(row, userDesc);
        r.appendChild(row, logoutBtn.getElement());
        r.appendChild(sessionCard, row);
      } else {
        const guestText = r.createElement('p');
        r.setAttribute(guestText, 'class', 'text-xs text-slate-500');
        r.appendChild(guestText, r.createText('Status: Guest mode (no active LocalStorage session)'));
        r.appendChild(sessionCard, guestText);
      }
    });

    r.appendChild(root, hero);
    r.appendChild(root, card);
    r.appendChild(root, sessionCard);

    return root;
  }
}

// 4. Route Table Configuration (Angular-style)
const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Jarvis Portal — Sign In' },
  { path: 'dashboard', component: DashboardComponent, title: 'Jarvis Portal — Dashboard' },
  { path: 'employees', component: EmployeeListComponent, title: 'Jarvis Portal — Personnel' },
  { path: 'employees/:id', component: EmployeeDetailComponent, title: 'Jarvis Portal — Employee Details' },
  { path: 'settings', component: SettingsComponent, title: 'Jarvis Portal — Settings' },
  { path: '**', component: NotFoundComponent, title: 'Jarvis Portal — 404' },
];

// 5. Bootstrap Router & Viewport
export const router = provideRouter(routes);

if (typeof document !== 'undefined') {
  const outletHost = document.getElementById('router-outlet');
  if (outletHost) {
    new RouterOutlet(renderer, router, outletHost);
  }

  // 6. Bind Sidebar Router Links
  const navDashboard = document.getElementById('nav-dashboard');
  const navEmployees = document.getElementById('nav-employees');
  const navSettings = document.getElementById('nav-settings');
  const navLogin = document.getElementById('nav-login');

  if (navDashboard) bindRouterLink(renderer, navDashboard, router, '/dashboard', { activeClass: 'nav-link-active' });
  if (navEmployees) bindRouterLink(renderer, navEmployees, router, '/employees', { activeClass: 'nav-link-active' });
  if (navSettings) bindRouterLink(renderer, navSettings, router, '/settings', { activeClass: 'nav-link-active' });
  if (navLogin) bindRouterLink(renderer, navLogin, router, '/login', { activeClass: 'nav-link-active' });

  // 7. Reactive Topbar URL & User indicator
  const currentUrlDisplay = document.getElementById('current-url-display');
  if (currentUrlDisplay) {
    effect(() => {
      currentUrlDisplay.textContent = router.currentUrl();
    });
  }

  const currentUserDisplay = document.getElementById('current-user-display');
  const userAvatarDisplay = document.getElementById('user-avatar-display');
  if (currentUserDisplay || userAvatarDisplay) {
    effect(() => {
      const isAuth = authService.isAuthenticated();
      const user = authService.currentUser();
      if (currentUserDisplay) {
        currentUserDisplay.textContent = isAuth && user ? user.name : 'Guest User';
      }
      if (userAvatarDisplay) {
        userAvatarDisplay.textContent = isAuth && user ? user.name.slice(0, 2).toUpperCase() : 'GU';
      }
    });
  }

  console.log('[Jarvis] Router + PrimeNG v20 + Tailwind showcase bootstrapped successfully!');
}
