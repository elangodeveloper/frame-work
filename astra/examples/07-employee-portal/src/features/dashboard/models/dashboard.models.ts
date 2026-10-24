/**
 * JARVIS Employee Dashboard Domain Models
 */

export type ProjectStatus = 'ACTIVE' | 'REVIEW' | 'DEPLOYED' | 'PAUSED';
export type ClearanceTier = 'LEVEL 2' | 'LEVEL 4' | 'LEVEL 5';

export interface DashboardProject {
  id: string;
  code: string;
  title: string;
  department: string;
  clearance: ClearanceTier;
  status: ProjectStatus;
  progress: number;
  lead: string;
  updatedAt: string;
}

export interface DashboardKpi {
  id: string;
  title: string;
  value: string;
  subtext: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: string;
  accentColor: string;
}

export interface SecurityAuditItem {
  id: string;
  event: string;
  actor: string;
  timestamp: string;
  ipAddress: string;
  status: 'SUCCESS' | 'WARNING' | 'ALERT';
}

export interface EmployeeProfileUpdate {
  displayName: string;
  phone: string;
  officeLocation: string;
}
