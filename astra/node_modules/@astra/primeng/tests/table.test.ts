import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisTable } from '../src/index.ts';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

describe('JarvisTable (<jarvis-p-table>) Adapter', () => {
  const initialProducts: Product[] = [
    { id: '1000', name: 'Bamboo Watch', price: 65, category: 'Accessories' },
    { id: '1001', name: 'Black Watch', price: 72, category: 'Accessories' },
    { id: '1002', name: 'Blue Band', price: 79, category: 'Fitness' },
  ];

  it('should render table headers and initial rows', () => {
    const renderer = new TestRenderer();
    const table = new JarvisTable<Product>(renderer, {
      value: initialProducts,
      columns: [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'category', header: 'Category' },
        { field: 'price', header: 'Price', formatter: (val) => `$${val}` },
      ],
    });

    const el = table.getElement();
    assert.strictEqual(el.tag, 'div');
    assert.strictEqual(el.attributes.get('class'), 'p-datatable p-component');

    const html = el.toHtml();
    assert.ok(html.includes('Bamboo Watch'));
    assert.ok(html.includes('Black Watch'));
    assert.ok(html.includes('Blue Band'));
    assert.ok(html.includes('$65'));
    assert.ok(html.includes('$72'));
    assert.ok(html.includes('$79'));
  });

  it('should reactively update rows when value signal changes', () => {
    const renderer = new TestRenderer();
    const productsSig = signal<Product[]>(initialProducts);

    const table = new JarvisTable<Product>(renderer, {
      value: productsSig,
      columns: [
        { field: 'name', header: 'Name' },
      ],
    });

    const el = table.getElement();
    assert.ok(el.toHtml().includes('Bamboo Watch'));

    productsSig.set([
      { id: '2000', name: 'Smart Keyboard', price: 120, category: 'Electronics' },
    ]);
    flushJobs();

    const updatedHtml = el.toHtml();
    assert.ok(!updatedHtml.includes('Bamboo Watch'));
    assert.ok(updatedHtml.includes('Smart Keyboard'));
  });

  it('should support column sorting and emit sortChange event', () => {
    const renderer = new TestRenderer();
    const table = new JarvisTable<Product>(renderer, {
      value: initialProducts,
      columns: [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'price', header: 'Price', sortable: true },
      ],
    });

    let sortEvent: { field: string; order: 1 | -1 } | null = null;
    table.sortChange.subscribe((evt) => {
      sortEvent = evt;
    });

    // Structure: container -> [table, loadingOverlay] -> table -> [thead, tbody]
    const tableEl = table.getElement().children[0];
    const thead = (tableEl as any).children[0];
    const headerRow = (thead as any).children[0];
    const nameTh = (headerRow as any).children[0];

    // Click Name header to sort ascending
    nameTh.dispatch('click');
    assert.deepStrictEqual(sortEvent, { field: 'name', order: 1 });

    // Click Name header again to toggle to descending
    nameTh.dispatch('click');
    assert.deepStrictEqual(sortEvent, { field: 'name', order: -1 });
  });

  it('should reactively toggle loading overlay via signal', () => {
    const renderer = new TestRenderer();
    const loadingSig = signal(false);

    const table = new JarvisTable<Product>(renderer, {
      value: initialProducts,
      loading: loadingSig,
      columns: [{ field: 'name', header: 'Name' }],
    });

    // Structure: container -> [table, loadingOverlay]
    const overlay = table.getElement().children[1];
    assert.strictEqual(overlay.properties.get('style'), 'display: none;');

    loadingSig.set(true);
    flushJobs();

    assert.ok(overlay.properties.get('style')?.includes('display: flex'));

    loadingSig.set(false);
    flushJobs();

    assert.strictEqual(overlay.properties.get('style'), 'display: none;');
  });

  it('should render empty message when dataset is empty', () => {
    const renderer = new TestRenderer();
    const table = new JarvisTable<Product>(renderer, {
      value: [],
      columns: [{ field: 'name', header: 'Name' }],
    });

    assert.ok(table.getElement().toHtml().includes('No records found.'));
  });
});
