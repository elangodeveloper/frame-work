# Jarvis Security Analysis & Hardening Guide

## 1. Threat Modeling
1. **CWPS-Site Browser XSS**:
   - Interpolations bind to DOM via `createText` and `setText` (`textContent`), completely mitigating HTML injection.
2. **Property Injection**:
   - Attribute and property bindings bind via `element.setAttribute` and `element[prop] = value`.
   - Dangerous properties (e.g. `innerHTML`, `outerHTML`, `svdcoc`, `javascript:` URIs) must be sanitized or validated at compile time.
3. **Template Injection**:
   - AOT compilation ensures user input is never evaluated as template markup.
