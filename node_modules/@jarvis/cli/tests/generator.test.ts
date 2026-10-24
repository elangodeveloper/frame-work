import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateComponent,
  generatePage,
  generateService,
  generateDirective,
  generatePipe,
  generateGuard,
  generateModel,
  generateRepository,
  createApp,
} from '../src/generator.ts';

describe('JARVIS CLI Schematics & Code Generators', () => {
  const tmpRoot = path.resolve(process.cwd(), 'scratch', 'cli-test');

  it('should generate component with separate TS, HTML, CSS, and spec files', () => {
    const compDir = 'components/user-profile';
    const files = generateComponent(compDir, { baseDir: tmpRoot, force: true });

    assert.strictEqual(files.length, 4);
    assert.ok(files.some((f) => f.endsWith('user-profile.component.ts')));
    assert.ok(files.some((f) => f.endsWith('user-profile.component.html')));
    assert.ok(files.some((f) => f.endsWith('user-profile.component.css')));
    assert.ok(files.some((f) => f.endsWith('user-profile.component.spec.ts')));

    const tsContent = fs.readFileSync(files.find((f) => f.endsWith('.ts'))!, 'utf8');
    assert.ok(tsContent.includes("selector: 'app-user-profile'"));
    assert.ok(tsContent.includes("templateUrl: './user-profile.component.html'"));
    assert.ok(tsContent.includes("styleUrl: './user-profile.component.css'"));
    assert.ok(tsContent.includes('export class UserProfileComponent'));
  });

  it('should respect skipTests option in generateComponent', () => {
    const compDir = 'components/compact-badge';
    const files = generateComponent(compDir, { baseDir: tmpRoot, skipTests: true, force: true });

    assert.strictEqual(files.length, 3);
    assert.strictEqual(files.some((f) => f.endsWith('.spec.ts')), false);
  });

  it('should generate page component with layout and spec', () => {
    const pageDir = 'pages/dashboard';
    const files = generatePage(pageDir, { baseDir: tmpRoot, force: true });

    assert.strictEqual(files.length, 4);
    assert.ok(files.some((f) => f.endsWith('dashboard.page.ts')));
    assert.ok(files.some((f) => f.endsWith('dashboard.page.html')));
    assert.ok(files.some((f) => f.endsWith('dashboard.page.css')));
    assert.ok(files.some((f) => f.endsWith('dashboard.page.spec.ts')));

    const tsContent = fs.readFileSync(files.find((f) => f.endsWith('.ts'))!, 'utf8');
    assert.ok(tsContent.includes('export class DashboardPage'));
  });

  it('should generate injectable service and colocated spec', () => {
    const serviceDir = 'services/auth';
    const files = generateService(serviceDir, { baseDir: tmpRoot, force: true });

    assert.strictEqual(files.length, 2);
    assert.ok(files.some((f) => f.endsWith('auth.service.ts')));
    assert.ok(files.some((f) => f.endsWith('auth.service.spec.ts')));

    const tsContent = fs.readFileSync(files[0], 'utf8');
    assert.ok(tsContent.includes('@Injectable()'));
    assert.ok(tsContent.includes('export class AuthService'));
  });

  it('should generate directive, pipe, guard, and model', () => {
    const dirFiles = generateDirective('directives/tooltip', { baseDir: tmpRoot, force: true });
    assert.ok(dirFiles.some((f) => f.endsWith('tooltip.directive.ts')));

    const pipeFiles = generatePipe('pipes/date-format', { baseDir: tmpRoot, force: true });
    assert.ok(pipeFiles.some((f) => f.endsWith('date-format.pipe.ts')));

    const guardFiles = generateGuard('guards/auth', { baseDir: tmpRoot, force: true });
    assert.ok(guardFiles.some((f) => f.endsWith('auth.guard.ts')));

    const modelFiles = generateModel('models/employee', { baseDir: tmpRoot, force: true });
    assert.ok(modelFiles.some((f) => f.endsWith('employee.model.ts')));
  });

  it('should generate repository with explicit interface for Dependency Inversion', () => {
    const repoFiles = generateRepository('repositories/employee', { baseDir: tmpRoot, force: true });

    assert.strictEqual(repoFiles.length, 2);
    assert.ok(repoFiles.some((f) => f.endsWith('employee-repository.interface.ts')));
    assert.ok(repoFiles.some((f) => f.endsWith('employee.repository.ts')));

    const interfaceContent = fs.readFileSync(repoFiles.find((f) => f.endsWith('.interface.ts'))!, 'utf8');
    assert.ok(interfaceContent.includes('export interface EmployeeRepository'));

    const repoContent = fs.readFileSync(repoFiles.find((f) => f.endsWith('.repository.ts'))!, 'utf8');
    assert.ok(repoContent.includes('export class HttpEmployeeRepository implements EmployeeRepository'));
  });

  it('should scaffold complete feature-based application structure via createApp', () => {
    const appDir = path.join(tmpRoot, 'sample-app');
    const files = createApp('sample-app', appDir, { force: true });

    assert.ok(files.length >= 10);
    assert.ok(fs.existsSync(path.join(appDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(appDir, 'jarvis.config.ts')));
    assert.ok(fs.existsSync(path.join(appDir, 'index.html')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'main.ts')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'app', 'app.component.ts')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'app', 'app.routes.ts')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'styles', 'styles.css')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'styles', 'tokens.css')));
    assert.ok(fs.existsSync(path.join(appDir, 'src', 'features', 'employees', 'employees.routes.ts')));
  });

  it('should throw clear error when target file already exists without force', () => {
    const compDir = 'components/duplicate-check';
    generateComponent(compDir, { baseDir: tmpRoot, force: true });

    assert.throws(
      () => {
        generateComponent(compDir, { baseDir: tmpRoot, force: false });
      },
      /File already exists/
    );
  });
});
