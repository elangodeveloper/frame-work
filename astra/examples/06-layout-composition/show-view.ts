/**
 * JARVIS Framework: Route-Based Layout & Screen View Demonstration
 *
 * Demonstrates:
 * 1. Defining Routes with Layout metadata
 * 2. Layout resolution and screen composition via LayoutRouterOutlet
 * 3. Inspecting and printing the rendered visual output (HTML & hierarchy)
 */

import { TestRenderer } from '@jarvis/renderer';
import { provideRouter } from '@jarvis/router';
import { LayoutRouterOutlet, MainLayoutComponent, AuthLayoutComponent } from '@jarvis/layout';
import { routes } from './src/app.routes.ts';

function formatBanner(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ✦ ${title}`);
  console.log('='.repeat(70));
}

async function runDemo() {
  formatBanner('JARVIS ROUTE + LAYOUT + SCREEN VIEW DEMO');

  const renderer = new TestRenderer();
  const router = provideRouter(routes, { initialUrl: '/dashboard' });
  const outlet = new LayoutRouterOutlet(renderer, router);

  // -------------------------------------------------------------
  // Step 1: Navigate to /dashboard (uses 'main' layout)
  // -------------------------------------------------------------
  formatBanner('STEP 1: Route /dashboard -> Resolves "main" Layout');
  console.log('Route definition:');
  console.log(JSON.stringify(routes.find(r => r.path === 'dashboard'), null, 2));

  await router.navigate(['dashboard']);

  const mainLayout = outlet.getCurrentLayout();
  const dashboardScreen = outlet.getCurrentScreen();
  console.log('\nActive Layout:', mainLayout?.constructor.name);
  console.log('Active Screen:', dashboardScreen?.constructor.name);
  console.log('\nRendered View (DOM Output):');
  console.log(outlet.getElement().toHtml());

  // -------------------------------------------------------------
  // Step 2: Navigate to /employees (uses same 'main' layout)
  // -------------------------------------------------------------
  formatBanner('STEP 2: Route /employees -> Reuses "main" Layout (Identity Preserved)');
  console.log('Toggling sidebar collapsed state on layout...');
  if (mainLayout instanceof MainLayoutComponent) {
    mainLayout.toggleSidebar();
    console.log('Sidebar open state before navigation:', mainLayout.sidebarOpen());
  }

  await router.navigate(['employees']);

  const currentLayoutAfterEmployees = outlet.getCurrentLayout();
  const employeeScreen = outlet.getCurrentScreen();
  const isLayoutReused = mainLayout === currentLayoutAfterEmployees;

  console.log('\nActive Layout:', currentLayoutAfterEmployees?.constructor.name);
  console.log('Layout instance strictly reused?:', isLayoutReused);
  console.log('Sidebar state preserved?:', (currentLayoutAfterEmployees as MainLayoutComponent)?.sidebarOpen());
  console.log('Active Screen:', employeeScreen?.constructor.name);
  console.log('\nRendered View (DOM Output):');
  console.log(outlet.getElement().toHtml());

  // -------------------------------------------------------------
  // Step 3: Navigate to /login (uses 'auth' layout)
  // -------------------------------------------------------------
  formatBanner('STEP 3: Route /login -> Switches to "auth" Layout');
  console.log('Route definition:');
  console.log(JSON.stringify(routes.find(r => r.path === 'login'), null, 2));

  await router.navigate(['login']);

  const authLayout = outlet.getCurrentLayout();
  const loginScreen = outlet.getCurrentScreen();

  console.log('\nActive Layout:', authLayout?.constructor.name);
  console.log('Active Screen:', loginScreen?.constructor.name);
  console.log('\nRendered View (DOM Output):');
  console.log(outlet.getElement().toHtml());

  outlet.destroy();
  formatBanner('DEMO COMPLETED SUCCESSFULLY');
}

runDemo().catch((err) => {
  console.error('Error running demo:', err);
  process.exit(1);
});
