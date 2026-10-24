import { App } from './app.component.ts';
import { compileTemplateSource } from '../../packages/compiler-runtime/src/index.ts';
import { bootstrap } from '../../packages/runtime/src/index.ts';
import { DOMRenderer } from '../../packages/renderer/src/index.ts';
import { getComponentDef } from '../../core/src/index.ts';

// Precompiled view function emitted by jarvis-compiler for `<h1>Hello Jarvis</h1>`
function helloJarvisViewFactory(renderer: any, _ctx: any) {
  const n0 = renderer.createElement('h1');
  const n1 = renderer.createText('Hello Jarvis');
  renderer.appendChild(n0, n1);
  return { root: n0 };
}

// In the browser, attach precompiled factory or compile dynamically
const def = getComponentDef(App)!;
def.templateFn = helloJarvisViewFactory;

const rootEl = document.getElementById('root') || document.body;
const appRef = bootstrap(App, rootEl, new DOMRenderer());

console.log('[Jarvis] Hello World bootstrapped successfully:', appRef);
