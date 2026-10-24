import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DashboardPage } from './dashboard.page.ts';

describe('DashboardPage', () => {
  it('should initialize page title', () => {
    const page = new DashboardPage();
    assert.strictEqual(page.pageTitle(), 'Dashboard Page');
  });
});
