import { signal, computed, effect } from '../../packages/reactive/src/index.ts';
import { DOMRenderer } from '../../packages/renderer/src/index.ts';
import {
  providePrimeNG,
  JarvisButton,
  JarvisInputText,
  JarvisSelect,
  JarvisCheckbox,
  JarvisDialog,
  JarvisTable,
} from '../../adapters/primeng/src/index.ts';

interface Employee {
  id: string;
  name: string;
  role: string;
  dept: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Inactive';
}

// 1. Initialize PrimeNG v20 Aura Theme Tokens & Configuration
providePrimeNG({
  theme: 'Aura',
  ripple: true,
  cssLayer: true,
});

const renderer = new DOMRenderer();

// 2. Reactive State using Native Jarvis Signals (Strictly ZERO RxJS)
const initialEmployees: Employee[] = [
  { id: 'EMP001', name: 'Sophia Martinez', role: 'Staff Frontend Architect', dept: 'Engineering', salary: 165000, status: 'Active' },
  { id: 'EMP002', name: 'Alexander Wright', role: 'Compiler Engineer', dept: 'Engineering', salary: 155000, status: 'Active' },
  { id: 'EMP003', name: 'Elena Rostova', role: 'Principal Designer', dept: 'Design', salary: 140000, status: 'Active' },
  { id: 'EMP004', name: 'Marcus Chen', role: 'Lead Product Manager', dept: 'Product', salary: 150000, status: 'On Leave' },
  { id: 'EMP005', name: 'Liam O\'Connor', role: 'Systems Developer', dept: 'Engineering', salary: 135000, status: 'Active' },
  { id: 'EMP006', name: 'Chloe Dubois', role: 'Brand Strategist', dept: 'Marketing', salary: 110000, status: 'Inactive' },
  { id: 'EMP007', name: 'Tariq Al-Mansoor', role: 'DevOps Architect', dept: 'Engineering', salary: 148000, status: 'Active' },
];

const employees = signal<Employee[]>(initialEmployees);
const searchQuery = signal<string>('');
const selectedDept = signal<string>('All');
const activeOnly = signal<boolean>(false);
const isLoading = signal<boolean>(false);
const isModalVisible = signal<boolean>(false);

// Form Signals for New Member Modal
const formName = signal<string>('');
const formRole = signal<string>('');
const formDept = signal<string>('Engineering');
const formSalary = signal<string>('120000');
const formInvalid = signal<boolean>(false);

// 3. Computed Projections
const filteredEmployees = computed(() => {
  const query = searchQuery().toLowerCase().trim();
  const dept = selectedDept();
  const isActiveOnly = activeOnly();

  return employees().filter((emp) => {
    const matchesSearch =
      !query ||
      emp.name.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query);

    const matchesDept = dept === 'All' || emp.dept === dept;
    const matchesActive = !isActiveOnly || emp.status === 'Active';

    return matchesSearch && matchesDept && matchesActive;
  });
});

// 4. Mount Components to DOM

// --- Header Actions ---
const headerActionsEl = document.getElementById('header-actions');
if (headerActionsEl) {
  // Add Member Button
  const addBtn = new JarvisButton(renderer, {
    label: 'Add Member',
    icon: 'pi pi-user-plus',
    severity: 'primary',
  });
  addBtn.clicked.subscribe(() => {
    formName.set('');
    formRole.set('');
    formDept.set('Engineering');
    formSalary.set('120000');
    formInvalid.set(false);
    isModalVisible.set(true);
  });
  renderer.appendChild(headerActionsEl, addBtn.getElement());

  // Refresh Button
  const refreshBtn = new JarvisButton(renderer, {
    label: 'Refresh Data',
    icon: 'pi pi-refresh',
    variant: 'outlined',
    loading: isLoading,
  });
  refreshBtn.clicked.subscribe(() => {
    isLoading.set(true);
    setTimeout(() => {
      isLoading.set(false);
    }, 600);
  });
  renderer.appendChild(headerActionsEl, refreshBtn.getElement());
}

// --- Search Input ---
const searchContainer = document.getElementById('search-container');
if (searchContainer) {
  const searchInput = new JarvisInputText(renderer, {
    placeholder: 'Search name or role...',
    value: searchQuery,
  });
  searchInput.valueChange.subscribe((val) => {
    searchQuery.set(val);
  });
  renderer.appendChild(searchContainer, searchInput.getElement());
}

// --- Department Filter Select ---
const deptContainer = document.getElementById('filter-dept-container');
if (deptContainer) {
  const deptSelect = new JarvisSelect(renderer, {
    options: ['All', 'Engineering', 'Design', 'Product', 'Marketing'],
    value: selectedDept,
    placeholder: 'Filter Department',
  });
  deptSelect.valueChange.subscribe((val) => {
    selectedDept.set(val);
  });
  renderer.appendChild(deptContainer, deptSelect.getElement());
}

// --- Active Only Checkbox ---
const checkboxContainer = document.getElementById('checkbox-container');
if (checkboxContainer) {
  const activeCheckbox = new JarvisCheckbox(renderer, {
    label: 'Active Personnel Only',
    checked: activeOnly,
  });
  activeCheckbox.checkedChange.subscribe((checked) => {
    activeOnly.set(checked);
  });
  renderer.appendChild(checkboxContainer, activeCheckbox.getElement());
}

// --- Stats Counter ---
const statsContainer = document.getElementById('stats-container');
if (statsContainer) {
  effect(() => {
    const total = employees().length;
    const current = filteredEmployees().length;
    statsContainer.textContent = `Showing ${current} of ${total} personnel`;
  });
}

// --- Data Table ---
const tableContainer = document.getElementById('table-container');
if (tableContainer) {
  const table = new JarvisTable<Employee>(renderer, {
    value: filteredEmployees,
    loading: isLoading,
    paginator: true,
    rows: 5,
    columns: [
      { field: 'id', header: 'ID', sortable: true },
      { field: 'name', header: 'Employee Name', sortable: true },
      { field: 'role', header: 'Role', sortable: true },
      { field: 'dept', header: 'Department', sortable: true },
      {
        field: 'salary',
        header: 'Compensation',
        sortable: true,
        formatter: (val) => `$${Number(val).toLocaleString()}`,
      },
      {
        field: 'status',
        header: 'Status',
        sortable: true,
        formatter: (val) => `[${val}]`,
      },
    ],
  });
  renderer.appendChild(tableContainer, table.getElement());
}

// --- Add Member Dialog Modal ---
const dialogHost = document.getElementById('dialog-host');
if (dialogHost) {
  const dialog = new JarvisDialog(renderer, {
    header: 'Add Team Member',
    visible: isModalVisible,
    width: '480px',
  });
  dialog.visibleChange.subscribe((visible) => {
    isModalVisible.set(visible);
  });

  const dialogContent = dialog.getContentContainer();

  // Create form controls inside dialog
  const formWrapper = renderer.createElement('div');
  renderer.setAttribute(formWrapper, 'class', 'space-y-4');

  // Name Input
  const nameRow = renderer.createElement('div');
  renderer.setAttribute(nameRow, 'class', 'flex flex-col gap-1.5');
  const nameLabel = renderer.createElement('label');
  renderer.setAttribute(nameLabel, 'class', 'text-xs font-semibold text-slate-600');
  renderer.appendChild(nameLabel, renderer.createText('Full Name *'));
  const nameInput = new JarvisInputText(renderer, {
    placeholder: 'e.g. Jane Doe',
    value: formName,
    invalid: formInvalid,
  });
  nameInput.valueChange.subscribe((val) => formName.set(val));
  renderer.appendChild(nameRow, nameLabel);
  renderer.appendChild(nameRow, nameInput.getElement());
  renderer.appendChild(formWrapper, nameRow);

  // Role Input
  const roleRow = renderer.createElement('div');
  renderer.setAttribute(roleRow, 'class', 'flex flex-col gap-1.5');
  const roleLabel = renderer.createElement('label');
  renderer.setAttribute(roleLabel, 'class', 'text-xs font-semibold text-slate-600');
  renderer.appendChild(roleLabel, renderer.createText('Job Role *'));
  const roleInput = new JarvisInputText(renderer, {
    placeholder: 'e.g. Senior Architect',
    value: formRole,
  });
  roleInput.valueChange.subscribe((val) => formRole.set(val));
  renderer.appendChild(roleRow, roleLabel);
  renderer.appendChild(roleRow, roleInput.getElement());
  renderer.appendChild(formWrapper, roleRow);

  // Department Dropdown
  const deptRow = renderer.createElement('div');
  renderer.setAttribute(deptRow, 'class', 'flex flex-col gap-1.5');
  const deptLabel = renderer.createElement('label');
  renderer.setAttribute(deptLabel, 'class', 'text-xs font-semibold text-slate-600');
  renderer.appendChild(deptLabel, renderer.createText('Department'));
  const modalDeptSelect = new JarvisSelect(renderer, {
    options: ['Engineering', 'Design', 'Product', 'Marketing'],
    value: formDept,
  });
  modalDeptSelect.valueChange.subscribe((val) => formDept.set(val));
  renderer.appendChild(deptRow, deptLabel);
  renderer.appendChild(deptRow, modalDeptSelect.getElement());
  renderer.appendChild(formWrapper, deptRow);

  // Action Buttons row
  const actionsRow = renderer.createElement('div');
  renderer.setAttribute(actionsRow, 'class', 'flex justify-end gap-3 pt-4 border-t border-slate-100');

  const cancelBtn = new JarvisButton(renderer, {
    label: 'Cancel',
    variant: 'text',
  });
  cancelBtn.clicked.subscribe(() => {
    isModalVisible.set(false);
  });

  const saveBtn = new JarvisButton(renderer, {
    label: 'Save Member',
    severity: 'primary',
  });
  saveBtn.clicked.subscribe(() => {
    const name = formName().trim();
    const role = formRole().trim();
    if (!name || !role) {
      formInvalid.set(true);
      return;
    }

    const newEmp: Employee = {
      id: `EMP${String(employees().length + 1).padStart(3, '0')}`,
      name,
      role,
      dept: formDept(),
      salary: Number(formSalary()) || 100000,
      status: 'Active',
    };

    employees.set([...employees(), newEmp]);
    isModalVisible.set(false);
  });

  renderer.appendChild(actionsRow, cancelBtn.getElement());
  renderer.appendChild(actionsRow, saveBtn.getElement());
  renderer.appendChild(formWrapper, actionsRow);

  renderer.appendChild(dialogContent, formWrapper);
  renderer.appendChild(dialogHost, dialog.getElement());
}

console.log('[Jarvis] PrimeNG v20 showcase application running successfully with fine-grained signals!');
