# Jarvis Template Compiler Diagnostics Reference

The Jarvis template compiler evaluates `.html` templates at build time and enforces strict syntactical, semantic, and security correctness. Each diagnostic produces an exact error code, source file path, 1-indexed line and column numbers, a detailed message, and an underlined terminal and overlay code snippet.

---

## Diagnostic Code Catalog

### TPL001: Unclosed HTML Tag
- **Description**: An opening element tag was not closed within the template scope.
- **Why it happens**: Missing `</div>`, `</section>`, or unclosed custom component tag.

#### ❌ Bad Code:
```html
<div class="user-card">
  <h2>{{ user.name }}</h2>
  <!-- Missing closing </div> -->
```

#### ✅ Fixed Code:
```html
<div class="user-card">
  <h2>{{ user.name }}</h2>
</div>
```

---

### TPL002: Unbalanced Closing Tag
- **Description**: A closing tag was encountered that does not match the currently open element tag, or has no corresponding opening tag.
- **Why it happens**: Mismatched nesting or stray closing tags.

#### ❌ Bad Code:
```html
<div class="container">
  <span>Text Content</div>
</span>
```

#### ✅ Fixed Code:
```html
<div class="container">
  <span>Text Content</span>
</div>
```

---

### TPL003: Invalid Expression Syntax
- **Description**: An interpolation `{{ ... }}` or property binding `[prop]="..."` contains an invalid JavaScript/TypeScript expression or unclosed delimiter.
- **Why it happens**: Typo in expression, unbalanced parentheses, or syntax errors.

#### ❌ Bad Code:
```html
<p>Total: {{ total( + 1 }}</p>
```

#### ✅ Fixed Code:
```html
<p>Total: {{ total() + 1 }}</p>
```

---

### TPL004: Unknown Structural Directive
- **Description**: An unknown or malformed control flow directive was encountered.
- **Why it happens**: Jarvis uses modern control flow (`@if`, `@else`, `@for`, `@switch`, `@case`, `@default`). Using legacy or unrecognized directives triggers TPL004.

#### ❌ Bad Code:
```html
@repeat (item of items) {
  <div>{{ item }}</div>
}
```

#### ✅ Fixed Code:
```html
@for (item of items; track item.id) {
  <div>{{ item }}</div>
}
```

---

### TPL005: Duplicate Attribute or Binding
- **Description**: An element specifies the same attribute, property binding, or event listener more than once.
- **Why it happens**: Accidental duplicate `id`, `class`, or `(click)` handlers on the same tag.

#### ❌ Bad Code:
```html
<button class="btn" class="btn-primary" (click)="save()">Save</button>
```

#### ✅ Fixed Code:
```html
<button class="btn btn-primary" (click)="save()">Save</button>
```

---

### TPL006: Invalid Event Binding
- **Description**: An event binding syntax `(event)="statement"` contains an empty handler, malformed parenthesis, or invalid expression.
- **Why it happens**: Empty `(click)=""` or mismatched parens in event target.

#### ❌ Bad Code:
```html
<button (click)="">Submit</button>
```

#### ✅ Fixed Code:
```html
<button (click)="onSubmit()">Submit</button>
```

---

## Error Output Format Example

```
[Jarvis Compiler Error] TPL001: Unclosed tag 'div'
  --> src/app/pages/home/home.component.html:1:1
   |
 1 | <div class="hero">
   | ^^^^^^^^^^^^^^^^^^ unclosed opening tag starts here
   |
   = help: Ensure all opened HTML elements have corresponding closing tags.
```
