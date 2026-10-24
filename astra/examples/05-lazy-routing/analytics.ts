export class AnalyticsComponent {
  activatedRoute;
  render(r) {
    const el = r.createElement('div');
    r.appendChild(el, r.createText('Analytics Feature (Lazy Chunk 1)'));
    return el;
  }
}
export default AnalyticsComponent;
