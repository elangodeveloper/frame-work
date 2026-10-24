import { Component, input } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';
import { DEFAULT_ORGANIZATION_CONFIG } from '../../models/organization.models.ts';

/**
 * AuthBrandPanelComponent: Editorial & Architectural Branding Region
 * Adheres to the 'JARVIS / WORKSPACE — Intelligent Employee Access' design direction.
 */
export class AuthBrandPanelComponent {
  readonly organizationName = input<string>(DEFAULT_ORGANIZATION_CONFIG.organizationName);
  readonly portalTitle = input<string>(DEFAULT_ORGANIZATION_CONFIG.portalTitle);
  readonly headline = input<string>('Your work. One connected space.');
  readonly supportingCopy = input<string>(
    'Access the tools, information, and workflows you need to move your work forward.'
  );
  readonly securityStatus = input<string>('Operational · End-to-end Encrypted · v2.4.0');

  render(r: Renderer): any {
    const root = r.createElement('aside');
    r.setAttribute(root, 'class', 'jarvis-brand-panel');
    r.setAttribute(root, 'aria-label', 'Brand and Platform Overview');

    // Architectural grid background
    const grid = r.createElement('div');
    r.setAttribute(grid, 'class', 'jarvis-architectural-grid');
    r.appendChild(root, grid);

    // Top Brand Bar: Logo & Status
    const topBar = r.createElement('div');
    r.setAttribute(topBar, 'class', 'brand-top-bar');

    const brandIdentity = r.createElement('div');
    r.setAttribute(brandIdentity, 'class', 'brand-identity');

    // Original SVG JARVIS Icon
    const logoSvg = r.createElement('div');
    r.setAttribute(logoSvg, 'class', 'brand-logo-icon');
    logoSvg.innerHTML = `
      <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#0b1320" stroke="url(#brandGrad)" stroke-width="3.5"/>
        <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="#10b981" stroke-width="1.8" stroke-dasharray="3 2"/>
        <circle cx="50" cy="50" r="14" fill="#047857" fill-opacity="0.2" stroke="url(#brandGrad)" stroke-width="2.5"/>
        <circle cx="50" cy="50" r="5" fill="#34d399"/>
        <path d="M50 20 L50 30 M50 70 L50 80 M24 50 L34 50 M66 50 L76 50" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;
    r.appendChild(brandIdentity, logoSvg);

    const brandTitles = r.createElement('div');
    const brandNameEl = r.createElement('div');
    r.setAttribute(brandNameEl, 'class', 'brand-name');
    brandNameEl.textContent = 'JARVIS';
    const portalLabel = r.createElement('div');
    r.setAttribute(portalLabel, 'class', 'portal-label');
    portalLabel.textContent = 'WORKSPACE';
    r.appendChild(brandTitles, brandNameEl);
    r.appendChild(brandTitles, portalLabel);
    r.appendChild(brandIdentity, brandTitles);
    r.appendChild(topBar, brandIdentity);

    // Live Security Status Pill
    const statusPill = r.createElement('div');
    r.setAttribute(statusPill, 'class', 'jarvis-status-badge jarvis-status-badge--success');
    const dot = r.createElement('span');
    r.setAttribute(dot, 'class', 'jarvis-status-dot jarvis-status-dot--pulse');
    const statusText = r.createElement('span');
    r.bindText(statusText, () => this.securityStatus());
    r.appendChild(statusPill, dot);
    r.appendChild(statusPill, statusText);
    r.appendChild(topBar, statusPill);
    r.appendChild(root, topBar);

    // Center Hero Section
    const heroSection = r.createElement('div');
    r.setAttribute(heroSection, 'class', 'brand-hero-section');

    const heading = r.createElement('h1');
    r.setAttribute(heading, 'class', 'brand-headline');
    r.bindText(heading, () => this.headline());
    r.appendChild(heroSection, heading);

    const desc = r.createElement('p');
    r.setAttribute(desc, 'class', 'brand-supporting-copy');
    r.bindText(desc, () => this.supportingCopy());
    r.appendChild(heroSection, desc);

    // Geometric Architectural System Illustration (Original SVG)
    const illustrationWrap = r.createElement('div');
    r.setAttribute(illustrationWrap, 'class', 'brand-illustration-wrapper');
    illustrationWrap.innerHTML = `
      <svg width="100%" height="150" viewBox="0 0 460 150" fill="none" xmlns="http://www.w3.org/2000/svg" class="brand-illustration">
        <defs>
          <linearGradient id="gridGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.1"/>
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.1"/>
          </linearGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#162235" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#0d1522" stop-opacity="0.9"/>
          </linearGradient>
        </defs>

        <!-- Structural Grid Axis Lines -->
        <path d="M10 75 L450 75" stroke="url(#gridGlow)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <path d="M70 20 L70 130 M230 15 L230 135 M390 20 L390 130" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>

        <!-- System Node 1: Identity & Access Gate -->
        <rect x="30" y="45" width="80" height="60" rx="8" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.2" stroke-opacity="0.4"/>
        <circle cx="70" cy="65" r="8" fill="#047857" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
        <path d="M67 65 L69 67 L74 62" stroke="#34d399" stroke-width="1.5" stroke-linecap="round"/>
        <text x="70" y="93" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">IAM CORE</text>

        <!-- Transit Connection 1 -> 2 -->
        <path d="M110 75 L180 75" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="145" cy="75" r="3" fill="#34d399"/>

        <!-- Central Nexus: Reactive Workspace Engine -->
        <rect x="180" y="32" width="100" height="86" rx="10" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.6"/>
        <circle cx="230" cy="65" r="14" fill="#0284c7" fill-opacity="0.2" stroke="#38bdf8" stroke-width="1.8"/>
        <circle cx="230" cy="65" r="6" fill="#38bdf8"/>
        <path d="M230 45 L230 51 M230 79 L230 85 M210 65 L216 65 M244 65 L250 65" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="230" y="103" fill="#e2e8f0" font-size="10" font-weight="600" font-family="sans-serif" text-anchor="middle">NEXUS MESH</text>

        <!-- Transit Connection 2 -> 3 -->
        <path d="M280 75 L350 75" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="315" cy="75" r="3" fill="#34d399"/>

        <!-- System Node 3: Vault & Neural State -->
        <rect x="350" y="45" width="80" height="60" rx="8" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.2" stroke-opacity="0.4"/>
        <circle cx="390" cy="65" r="8" fill="#047857" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
        <rect x="386" y="62" width="8" height="6" rx="1" fill="#34d399"/>
        <path d="M388 62 L388 60 C388 58.9 388.9 58 390 58 C391.1 58 392 58.9 392 60 L392 62" stroke="#34d399" stroke-width="1.2"/>
        <text x="390" y="93" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">KEY VAULT</text>
      </svg>
    `;
    r.appendChild(heroSection, illustrationWrap);

    // 3 Feature Highlights
    const featureList = r.createElement('div');
    r.setAttribute(featureList, 'class', 'brand-feature-list');

    const features = [
      {
        icon: 'pi pi-compass',
        title: 'One place for your work.',
        desc: 'Unified, single-pane access across enterprise apps, repositories, and engineering tooling.',
      },
      {
        icon: 'pi pi-shield',
        title: 'Secure employee access.',
        desc: 'Zero-trust cryptographic verification, hardened sessions, and real-time posture defense.',
      },
      {
        icon: 'pi pi-sliders-h',
        title: 'A workspace designed around you.',
        desc: 'Fine-grained reactive signals adapt interfaces instantly to your department and clearance.',
      },
    ];

    for (const f of features) {
      const item = r.createElement('div');
      r.setAttribute(item, 'class', 'jarvis-feature-item');

      const iconBox = r.createElement('div');
      r.setAttribute(iconBox, 'class', 'jarvis-feature-icon');
      const icon = r.createElement('i');
      r.setAttribute(icon, 'class', f.icon);
      r.appendChild(iconBox, icon);
      r.appendChild(item, iconBox);

      const textBox = r.createElement('div');
      r.setAttribute(textBox, 'class', 'feature-text-box');
      const fTitle = r.createElement('h3');
      r.setAttribute(fTitle, 'class', 'feature-title');
      fTitle.textContent = f.title;
      const fDesc = r.createElement('p');
      r.setAttribute(fDesc, 'class', 'feature-desc');
      fDesc.textContent = f.desc;
      r.appendChild(textBox, fTitle);
      r.appendChild(textBox, fDesc);
      r.appendChild(item, textBox);

      r.appendChild(featureList, item);
    }

    r.appendChild(heroSection, featureList);
    r.appendChild(root, heroSection);

    // Bottom Compliance & Footer
    const footer = r.createElement('footer');
    r.setAttribute(footer, 'class', 'brand-footer');
    const compliance = r.createElement('div');
    compliance.textContent = 'SOC-2 Type II Certified · Continuous Posture Evaluation';
    const version = r.createElement('div');
    version.textContent = 'JARVIS Framework Core v0.1.0';
    r.appendChild(footer, compliance);
    r.appendChild(footer, version);
    r.appendChild(root, footer);

    return root;
  }
}

Component({
  selector: 'jarvis-auth-brand-panel',
  templateUrl: './auth-brand-panel.component.html',
  styleUrl: './auth-brand-panel.component.css',
})(AuthBrandPanelComponent);
