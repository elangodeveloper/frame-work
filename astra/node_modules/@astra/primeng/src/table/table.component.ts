import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';

export interface ColumnDef<T = any> {
  field: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  formatter?: (val: any, row: T) => string;
}

export interface TableProps<T = any> {
  value?: Signal<T[]> | T[];
  columns: ColumnDef<T>[];
  loading?: Signal<boolean> | boolean;
  paginator?: boolean;
  rows?: number;
  totalRecords?: number;
  sortField?: string;
  sortOrder?: 1 | -1;
  class?: string;
}

/**
 * Jarvis Table Adapter for PrimeNG v20 DataTable.
 * Selector: <jarvis-p-table>
 */
export class JarvisTable<T = any> extends JarvisPrimeComponent {
  readonly sortChange: JarvisEvent<{ field: string; order: 1 | -1 }> = jarvisEvent();
  readonly pageChange: JarvisEvent<{ first: number; rows: number; page: number }> = jarvisEvent();

  private containerEl: any;
  private tableEl: any;
  private theadEl: any;
  private tbodyEl: any;
  private readonly props: TableProps<T>;
  private loadingOverlayEl: any;
  private paginatorEl: any;

  private currentSortField: string | null = null;
  private currentSortOrder: 1 | -1 = 1;
  private currentPage = 1;

  constructor(renderer: Renderer, props: TableProps<T>) {
    super(renderer);
    this.props = props;
    this.currentSortField = props.sortField || null;
    this.currentSortOrder = props.sortOrder || 1;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    this.containerEl = this.renderer.createElement('div');
    this.hostElement = this.containerEl;
    this.renderer.setAttribute(this.containerEl, 'class', 'p-datatable p-component');
    this.renderer.setProperty(this.containerEl, 'style', 'position: relative;');

    // Table element
    this.tableEl = this.renderer.createElement('table');
    this.renderer.setAttribute(this.tableEl, 'class', 'p-datatable-table');
    this.renderer.appendChild(this.containerEl, this.tableEl);

    // Thead
    this.theadEl = this.renderer.createElement('thead');
    this.renderer.setAttribute(this.theadEl, 'class', 'p-datatable-thead');
    this.renderer.appendChild(this.tableEl, this.theadEl);

    // Tbody
    this.tbodyEl = this.renderer.createElement('tbody');
    this.renderer.setAttribute(this.tbodyEl, 'class', 'p-datatable-tbody');
    this.renderer.appendChild(this.tableEl, this.tbodyEl);

    // Loading overlay
    this.loadingOverlayEl = this.renderer.createElement('div');
    this.renderer.setAttribute(this.loadingOverlayEl, 'class', 'p-datatable-loading-overlay');
    this.renderer.setProperty(
      this.loadingOverlayEl,
      'style',
      'position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: none; align-items: center; justify-content: center;'
    );
    const spinner = this.renderer.createElement('span');
    this.renderer.setAttribute(spinner, 'class', 'pi pi-spinner pi-spin');
    this.renderer.setProperty(spinner, 'style', 'font-size: 2rem; color: var(--p-primary-color);');
    this.renderer.appendChild(this.loadingOverlayEl, spinner);
    this.renderer.appendChild(this.containerEl, this.loadingOverlayEl);

    // Build headers once
    this.renderHeaders();

    // Paginator if enabled
    if (this.props.paginator) {
      this.paginatorEl = this.renderer.createElement('div');
      this.renderer.setAttribute(this.paginatorEl, 'class', 'p-paginator p-component');
      this.renderer.appendChild(this.containerEl, this.paginatorEl);
    }
  }

  private renderHeaders(): void {
    const headerRow = this.renderer.createElement('tr');

    for (const col of this.props.columns) {
      const th = this.renderer.createElement('th');
      this.renderer.setAttribute(th, 'class', col.sortable ? 'p-sortable-column' : '');

      const titleSpan = this.renderer.createElement('span');
      const titleTxt = this.renderer.createText(col.header);
      this.renderer.appendChild(titleSpan, titleTxt);
      this.renderer.appendChild(th, titleSpan);

      if (col.sortable) {
        const sortIcon = this.renderer.createElement('span');
        this.renderer.setAttribute(sortIcon, 'class', 'p-sortable-column-icon pi pi-sort');
        this.renderer.appendChild(th, sortIcon);

        this.renderer.listen(th, 'click', () => {
          const field = String(col.field);
          if (this.currentSortField === field) {
            this.currentSortOrder = this.currentSortOrder === 1 ? -1 : 1;
          } else {
            this.currentSortField = field;
            this.currentSortOrder = 1;
          }
          this.sortChange.emit({ field, order: this.currentSortOrder });
          this.renderRows();
        });
      }

      this.renderer.appendChild(headerRow, th);
    }

    this.renderer.appendChild(this.theadEl, headerRow);
  }

  private bindProperties(): void {
    // 1. Reactive rows data & sorting
    this.bindReactive(
      () => {
        const rawRows = (unwrap(this.props.value) || []) as T[];
        return [...rawRows];
      },
      () => {
        this.renderRows();
      }
    );

    // 2. Reactive loading state
    this.bindReactive(
      () => Boolean(unwrap(this.props.loading)),
      (isLoading) => {
        this.renderer.setProperty(
          this.loadingOverlayEl,
          'style',
          isLoading
            ? 'position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center;'
            : 'display: none;'
        );
      }
    );
  }

  private renderRows(): void {
    const rawRows = (unwrap(this.props.value) || []) as T[];
    let rows = [...rawRows];

    // Local sort if applicable
    if (this.currentSortField) {
      const field = this.currentSortField;
      const order = this.currentSortOrder;
      rows.sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    }

    // Pagination slice if applicable
    const pageSize = this.props.rows || 10;
    const total = this.props.totalRecords ?? rows.length;
    let displayRows = rows;
    if (this.props.paginator) {
      const start = (this.currentPage - 1) * pageSize;
      displayRows = rows.slice(start, start + pageSize);
    }

    // Clear existing rows
    while ((this.tbodyEl as any).children?.length > 0) {
      this.renderer.removeChild(this.tbodyEl, (this.tbodyEl as any).children[0]);
    }

    if (displayRows.length === 0) {
      const emptyRow = this.renderer.createElement('tr');
      const emptyTd = this.renderer.createElement('td');
      this.renderer.setAttribute(emptyTd, 'colspan', String(this.props.columns.length));
      this.renderer.setAttribute(emptyTd, 'class', 'p-datatable-emptymessage');
      const emptyTxt = this.renderer.createText('No records found.');
      this.renderer.appendChild(emptyTd, emptyTxt);
      this.renderer.appendChild(emptyRow, emptyTd);
      this.renderer.appendChild(this.tbodyEl, emptyRow);
    } else {
      for (const row of displayRows) {
        const tr = this.renderer.createElement('tr');
        for (const col of this.props.columns) {
          const td = this.renderer.createElement('td');
          const rawVal = (row as any)[col.field];
          const textVal = col.formatter ? col.formatter(rawVal, row) : rawVal != null ? String(rawVal) : '';
          const tdTxt = this.renderer.createText(textVal);
          this.renderer.appendChild(td, tdTxt);
          this.renderer.appendChild(tr, td);
        }
        this.renderer.appendChild(this.tbodyEl, tr);
      }
    }

    // Render paginator info
    if (this.props.paginator && this.paginatorEl) {
      while ((this.paginatorEl as any).children?.length > 0) {
        this.renderer.removeChild(this.paginatorEl, (this.paginatorEl as any).children[0]);
      }
      const pageInfo = this.renderer.createText(
        `Page ${this.currentPage} of ${Math.max(1, Math.ceil(total / pageSize))} (${total} items)`
      );
      this.renderer.appendChild(this.paginatorEl, pageInfo);
    }
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
