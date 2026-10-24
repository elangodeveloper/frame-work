// examples/05-lazy-routing/analytics.ts
var AnalyticsComponent = class {
  render(r) {
    const el = r.createElement("div");
    r.appendChild(el, r.createText("Analytics Feature (Lazy Chunk 1)"));
    return el;
  }
};
var analytics_default = AnalyticsComponent;
export {
  AnalyticsComponent,
  analytics_default as default
};
