import { Component, input } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';

export type SystemStatusType = 'operational' | 'degraded' | 'maintenance';

/**
 * AuthStatusIndicatorComponent: Live system telemetry status pill
 */
export class AuthStatusIndicatorComponent {
  readonly status = input<SystemStatusType>('operational');
  readonly label = input<string>('All Systems Operational');
  readonly pulse = input<boolean>(true);

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', `jarvis-status-badge jarvis-status-badge--${this.status()}`);

    const dot = r.createElement('span');
    const pulseClass = this.pulse() ? 'jarvis-status-dot jarvis-status-dot--pulse' : 'jarvis-status-dot';
    r.setAttribute(dot, 'class', pulseClass);
    r.appendChild(root, dot);

    const text = r.createElement('span');
    r.bindText(text, () => this.label());
    r.appendChild(root, text);

    return root;
  }
}

Component({
  selector: 'jarvis-auth-status-indicator',
  templateUrl: './auth-status-indicator.component.html',
  styleUrl: './auth-status-indicator.component.css',
})(AuthStatusIndicatorComponent);
