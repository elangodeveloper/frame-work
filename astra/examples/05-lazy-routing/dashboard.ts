export class DashboardComponent {
  render(r) {
    const el = r.createElement('div');
    r.appendChild(el, r.createText('Executive Dashboard (Eager)'));
    return el;
  }
}
