/**
 * Organization Configuration Service
 * Provides configurable branding, URLs, identifier options, and SSO settings.
 */

import { signal, type Signal } from '@jarvis/reactive';
import {
  type OrganizationBrandingConfig,
  DEFAULT_ORGANIZATION_CONFIG,
} from '../models/organization.models.ts';

export class OrganizationConfigService {
  private readonly _config = signal<OrganizationBrandingConfig>(DEFAULT_ORGANIZATION_CONFIG);

  readonly config: Signal<OrganizationBrandingConfig> = this._config;

  constructor(initialConfig?: Partial<OrganizationBrandingConfig>) {
    if (initialConfig) {
      this.updateConfig(initialConfig);
    }
  }

  updateConfig(partial: Partial<OrganizationBrandingConfig>): void {
    this._config.set({
      ...this._config(),
      ...partial,
    });
  }

  get organizationName(): string {
    return this._config().organizationName;
  }

  get portalTitle(): string {
    return this._config().portalTitle;
  }

  get identifierLabel(): string {
    return this._config().identifierLabel;
  }
}
