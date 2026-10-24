import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService, DUMMY_USERS } from './auth.service.ts';
import { LoginComponent } from './login.component.ts';

// Mock LocalStorage in Node.js test environment
class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, val: string): void { this.store[key] = val; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
}

(globalThis as any).localStorage = new MockStorage();

describe('JARVIS Login & LocalStorage Component', () => {
  it('should initialize with default form values and dummy profiles', () => {
    localStorage.clear();
    const auth = new AuthService();
    const comp = new LoginComponent(auth);
    assert.equal(comp.emailControl.value(), 'stark@jarvis.ai');
    assert.equal(comp.passwordControl.value(), 'password123');
    assert.equal(comp.rememberMe(), true);
    assert.equal(comp.quickUsers.length, 3);
  });

  it('should successfully authenticate and store session in LocalStorage', async () => {
    localStorage.clear();
    const auth = new AuthService();
    const comp = new LoginComponent(auth);

    await comp.handleLogin();

    assert.equal(auth.isAuthenticated(), true);
    assert.equal(auth.currentUser()?.name, 'Tony Stark');
    assert.ok(comp.successMessage()?.includes('Tony Stark'));

    // Verify LocalStorage was populated
    const rawStored = localStorage.getItem('jarvis_auth_session');
    assert.ok(rawStored);
    const parsed = JSON.parse(rawStored!);
    assert.equal(parsed.user.email, 'stark@jarvis.ai');
    assert.equal(parsed.token.slice(0, 11), 'jwt-jarvis-');
  });

  it('should restore active session on initialization from LocalStorage', () => {
    // New auth instance when session already exists
    const newAuth = new AuthService();
    assert.equal(newAuth.isAuthenticated(), true);
    assert.equal(newAuth.currentUser()?.id, 'USR-001');

    const newComp = new LoginComponent(newAuth);
    newComp.onInit();
    assert.ok(newComp.successMessage()?.includes('Active session restored'));
  });

  it('should purge session from LocalStorage on logout', () => {
    const auth = new AuthService();
    const comp = new LoginComponent(auth);

    comp.handleLogout();
    assert.equal(auth.isAuthenticated(), false);
    assert.equal(auth.currentUser(), null);
    assert.equal(localStorage.getItem('jarvis_auth_session'), null);
  });

  it('should handle invalid credentials with reactive errors', async () => {
    localStorage.clear();
    const auth = new AuthService();
    const comp = new LoginComponent(auth);

    comp.fillDummy('stark@jarvis.ai', 'wrong-password');
    await comp.handleLogin();

    assert.equal(auth.isAuthenticated(), false);
    assert.ok(comp.errorMessage()?.includes('Invalid credentials'));
    assert.equal(localStorage.getItem('jarvis_auth_session'), null);
  });
});
