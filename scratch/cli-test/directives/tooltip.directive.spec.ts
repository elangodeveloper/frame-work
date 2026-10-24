import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TooltipDirective } from './tooltip.directive.ts';

describe('TooltipDirective', () => {
  it('should instantiate successfully', () => {
    const directive = new TooltipDirective();
    assert.ok(directive);
  });
});
