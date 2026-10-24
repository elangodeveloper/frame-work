/**
 * JARVIS Framework: Layout Architecture Contracts
 * Explicit, loosely coupled contracts decoupling router, layouts, and screens.
 */

export interface LayoutConfig {
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
  sidebarCollapsible?: boolean;
  sidebarCollapsed?: boolean;
  sidebarWidth?: string;
  headerSticky?: boolean;
  contentWidth?: 'full' | 'wide' | 'normal' | 'narrow';
  contentPadding?: string;
  theme?: 'light' | 'dark' | 'system';
  customClass?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  badge?: string;
  badgeSeverity?: 'info' | 'success' | 'warn' | 'danger';
  children?: NavItem[];
}

export interface LayoutDefinition {
  readonly name: string;
  readonly component: any;
  readonly defaultConfig?: LayoutConfig;
  readonly description?: string;
  readonly supportedSlots?: string[];
}

export interface RouteLayoutData {
  layout?: string | any;
  layoutConfig?: LayoutConfig;
  slots?: Record<string, any>;
  [key: string]: any;
}

export interface SlotProjectionDef {
  slot: string;
  component?: any;
  inputs?: Record<string, any>;
  render?: (renderer: any) => any;
}
