/**
 * JARVIS Employee Portal: Organization & Branding Models
 */

export interface OrganizationBrandingConfig {
  organizationName: string;
  portalTitle: string;
  tagline: string;
  logoUrl?: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  supportEmail: string;
  supportPhone?: string;
  helpDocumentationUrl: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  securityComplianceLabel: string;
  ssoEnabled: boolean;
  ssoProviderName: string;
  version: string;
}

export const DEFAULT_ORGANIZATION_CONFIG: OrganizationBrandingConfig = {
  organizationName: 'JARVIS Enterprise Systems',
  portalTitle: 'JARVIS / WORKSPACE',
  tagline: 'Intelligent Employee Access',
  identifierLabel: 'Work Email or Employee ID',
  identifierPlaceholder: 'e.g. stark@jarvis.ai or EMP-10492',
  supportEmail: 'support@jarvis.ai',
  supportPhone: '+1 (800) 555-JARVIS',
  helpDocumentationUrl: 'https://help.jarvis.internal/access',
  privacyPolicyUrl: 'https://jarvis.internal/legal/privacy',
  termsOfServiceUrl: 'https://jarvis.internal/legal/terms',
  securityComplianceLabel: 'SOC-2 Type II Certified · Zero-Trust Architecture',
  ssoEnabled: true,
  ssoProviderName: 'Enterprise SSO (Okta / Azure AD)',
  version: 'v2.4.0',
};
