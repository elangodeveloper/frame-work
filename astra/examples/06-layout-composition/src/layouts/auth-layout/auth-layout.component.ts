import { Component } from '@jarvis/core';
import { AuthLayoutComponent as BaseAuthLayout } from '@jarvis/layout';

/**
 * Auth application layout for sign in & onboarding screens.
 */
export class AppAuthLayoutComponent extends BaseAuthLayout {
  constructor() {
    super();
  }
}

Component({
  selector: 'app-auth-layout',
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css',
})(AppAuthLayoutComponent);
