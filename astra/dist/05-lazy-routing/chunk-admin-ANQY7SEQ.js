// examples/05-lazy-routing/admin.ts
var AdminComponent = class {
  render(r) {
    const el = r.createElement("div");
    r.appendChild(el, r.createText("Admin Console (Lazy Chunk 2)"));
    return el;
  }
};
var admin_default = AdminComponent;
export {
  AdminComponent,
  admin_default as default
};
