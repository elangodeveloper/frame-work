export class AdminComponent {
  render(r) {
    const el = r.createElement('div');
    r.appendChild(el, r.createText('Admin Console (Lazy Chunk 2)'));
    return el;
  }
}
export default AdminComponent;
