import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

export class LoginPage implements OnInit, OnDestroy {
  readonly email = signal('architect@jarvis.ai');
  readonly password = signal('securePassword123');
  readonly status = signal('Ready');

  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'login-page-form');

    const h2 = r.createElement('h2');
    h2.textContent = 'Sign In to Corporate Portal';
    r.appendChild(root, h2);

    const emailInput = r.createElement('input');
    emailInput.value = this.email();
    r.setAttribute(emailInput, 'type', 'email');
    r.setAttribute(emailInput, 'placeholder', 'Email address');
    r.appendChild(root, emailInput);

    const passInput = r.createElement('input');
    passInput.value = this.password();
    r.setAttribute(passInput, 'type', 'password');
    r.setAttribute(passInput, 'placeholder', 'Password');
    r.appendChild(root, passInput);

    const btn = r.createElement('button');
    btn.textContent = 'Authenticate';
    r.appendChild(root, btn);

    return root;
  }
}

Component({
  selector: 'app-login-page',
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})(LoginPage);
