import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { EmployeeListPage } from './employee-list.page.ts';

describe('EmployeeListPage', () => {
  it('should initialize page title', () => {
    const page = new EmployeeListPage();
    assert.strictEqual(page.pageTitle(), 'EmployeeList Page');
  });
});
