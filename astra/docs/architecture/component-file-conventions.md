# JARVIS: Component File Conventions & Separation of Concerns

## 1. Multi-File Component Architecture

Every standard JARVIS component consists of four colocated files sharing an identical base kebab-case name:

```text
user-card/
├── user-card.component.ts        # TypeScript class & metadata
├── user-card.component.html      # HTML template structure
├── user-card.component.css       # Scoped stylesheet
└── user-card.component.spec.ts   # Colocated unit tests
```

---

## 2. File Implementation Standards

### 2.1 TypeScript Component (`user-card.component.ts`)
```typescript
import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import type { User } from '../../models/user.model.ts';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.css',
})
export class UserCardComponent implements OnInit, OnDestroy {
  /**
   * Required signal input passed from parent template.
   */
  readonly user = input.required<User>();

  /**
   * Output event emitter without RxJS.
   */
  readonly selected = output<User>();

  onInit(): void {
    // Lifecycle setup
  }

  selectUser(): void {
    this.selected.emit(this.user());
  }

  onDestroy(): void {
    // Clean up resources
  }
}
```

### 2.2 HTML Template (`user-card.component.html`)
```html
<article class="user-card">
  <header class="user-card-header">
    <h2 class="user-name">{{ user().name }}</h2>
    <span class="user-role">{{ user().role }}</span>
  </header>

  <p class="user-email">{{ user().email }}</p>

  <button
    type="button"
    class="select-button"
    (click)="selectUser()">
    Select User
  </button>
</article>
```

### 2.3 Scoped Stylesheet (`user-card.component.css`)
```css
.user-card {
  padding: var(--jarvis-space-4);
  border-radius: var(--jarvis-radius-md);
  background: var(--jarvis-surface);
  border: 1px solid var(--jarvis-border);
}

.user-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--jarvis-text-color);
}
```

### 2.4 Unit Test Specification (`user-card.component.spec.ts`)
```typescript
import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { UserCardComponent } from './user-card.component.ts';

describe('UserCardComponent', () => {
  it('should accept input and emit selection event', () => {
    const comp = new UserCardComponent();
    comp.user.set({ id: '1', name: 'Tony Stark', email: 'tony@stark.com', role: 'Engineer' });

    let emittedUser: any = null;
    comp.selected.subscribe((val) => {
      emittedUser = val;
    });

    comp.selectUser();
    assert.strictEqual(emittedUser?.name, 'Tony Stark');
  });
});
```

---

## 3. Compiler Resolution & Dependency Tracking

During Ahead-of-Time (AOT) compilation and development serving:
1. The compiler reads `@Component` decorator metadata.
2. Resolves `templateUrl` relative to the component file path.
3. Resolves `styleUrl` relative to the component file path.
4. Registers dependency edges:
   $$\text{user-card.component.ts} \to \text{user-card.component.html}$$
   $$\text{user-card.component.ts} \to \text{user-card.component.css}$$
5. If `user-card.component.css` is modified, the compiler only recompiles the CSS stage and hot-swaps the browser stylesheet without touching component state or template bytecode.
