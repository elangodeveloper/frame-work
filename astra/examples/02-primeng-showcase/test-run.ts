import { describe, it } from 'node:test';
import assert from 'node:assert';
import { signal, computed, flushJobs } from '../../packages/reactive/src/index.ts';
import { TestRenderer } from '../../packages/renderer/src/index.ts';
import {
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

describe('02-primeng-showcase Integration Verification', () => {
  it('should run full employee management flow with 6 PrimeNG components and zero RxJS', () => {
    const renderer = new TestRenderer();

    // 1. Reactive State
    const employees = signal<Employee[]>([
      { id: 'EMP001', name: 'Sophia Martinez', role: 'Staff Frontend Architect', dept: 'Engineering', salary: 165000, status: 'Active' },
      { id: 'EMP002', name: 'Alexander Wright', role: 'Compiler Engineer', dept: 'Engineering', salary: 155000, status: 'Active' },
      { id: 'EMP003', name: 'Elena Rostova', role: 'Principal Designer', dept: 'Design', salary: 140000, status: 'Active' },
    ]);

    const searchQuery = signal('');
    const selectedDept = signal('All');
    const activeOnly = signal(false);
    const isModalVisible = signal(false);

    // 2. Computed Pipeline
    const filteredEmployees = computed(() => {
      const q = searchQuery().toLowerCase().trim();
      const d = selectedDept();
      const active = activeOnly();

      return employees().filter((emp) => {
        const matchesSearch = !q || emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q);
        const matchesDept = d === 'All' || emp.dept === d;
        const matchesActive = !active || emp.status === 'Active';
        return matchesSearch && matchesDept && matchesActive;
      });
    });

    // 3. Components
    const searchInput = new JarvisInputText(renderer, {
      value: searchQuery,
      placeholder: 'Search...',
    });
    searchInput.valueChange.subscribe((v) => searchQuery.set(v));

    const deptSelect = new JarvisSelect(renderer, {
      options: ['All', 'Engineering', 'Design'],
      value: selectedDept,
    });
    deptSelect.valueChange.subscribe((v) => selectedDept.set(v));

    const activeCheckbox = new JarvisCheckbox(renderer, {
      label: 'Active Only',
      checked: activeOnly,
    });
    activeCheckbox.checkedChange.subscribe((c) => activeOnly.set(c));

    const table = new JarvisTable<Employee>(renderer, {
      value: filteredEmployees,
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', sortable: true },
        { field: 'dept', header: 'Department' },
      ],
    });

    const dialog = new JarvisDialog(renderer, {
      header: 'New Member',
      visible: isModalVisible,
    });

    // Initial table check
    let tableHtml = table.getElement().toHtml();
    assert.ok(tableHtml.includes('Sophia Martinez'));
    assert.ok(tableHtml.includes('Alexander Wright'));
    assert.ok(tableHtml.includes('Elena Rostova'));

    // 4. Test Search Filter
    searchInput.getElement().dispatch('input', { target: { value: 'Compiler' } });
    flushJobs();

    tableHtml = table.getElement().toHtml();
    assert.ok(!tableHtml.includes('Sophia Martinez'));
    assert.ok(tableHtml.includes('Alexander Wright'));
    assert.ok(!tableHtml.includes('Elena Rostova'));

    // Reset search
    searchQuery.set('');
    flushJobs();

    // 5. Test Department Filter via Select
    selectedDept.set('Design');
    flushJobs();

    tableHtml = table.getElement().toHtml();
    assert.ok(!tableHtml.includes('Sophia Martinez'));
    assert.ok(!tableHtml.includes('Alexander Wright'));
    assert.ok(tableHtml.includes('Elena Rostova'));

    selectedDept.set('All');
    flushJobs();

    // 6. Test Modal Flow
    assert.strictEqual(dialog.getElement().properties.get('style'), 'display: none;');
    isModalVisible.set(true);
    flushJobs();
    assert.ok(dialog.getElement().properties.get('style')?.includes('display: flex'));

    // Add new employee
    employees.set([
      ...employees(),
      { id: 'EMP004', name: 'Lucas Scott', role: 'QA Lead', dept: 'Engineering', salary: 110000, status: 'Active' },
    ]);
    isModalVisible.set(false);
    flushJobs();

    assert.strictEqual(dialog.getElement().properties.get('style'), 'display: none;');
    tableHtml = table.getElement().toHtml();
    assert.ok(tableHtml.includes('Lucas Scott'));
    assert.strictEqual(filteredEmployees().length, 4);
  });
});
