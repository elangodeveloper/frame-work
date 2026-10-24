/**
 * JARVIS Employee Dashboard Service
 * Manages dashboard state, project registry, search filtering, and metrics
 * using fine-grained JARVIS signals. Strictly zero RxJS.
 */

import { signal, computed, type Signal } from '@jarvis/reactive';
import type { DashboardProject, DashboardKpi, SecurityAuditItem, ProjectStatus, EmployeeProfileUpdate } from '../models/dashboard.models.ts';

const INITIAL_PROJECTS: DashboardProject[] = [
  {
    id: 'proj-001',
    code: 'MK-85',
    title: 'Mark 85 Nanotech Chassis Integration',
    department: 'Advanced Engineering',
    clearance: 'LEVEL 5',
    status: 'ACTIVE',
    progress: 88,
    lead: 'Tony Stark',
    updatedAt: '12m ago',
  },
  {
    id: 'proj-002',
    code: 'ARC-V4',
    title: 'Arc Reactor Clean Grid Distributed Core',
    department: 'Energy Systems',
    clearance: 'LEVEL 5',
    status: 'DEPLOYED',
    progress: 100,
    lead: 'Pepper Potts',
    updatedAt: '1h ago',
  },
  {
    id: 'proj-003',
    code: 'NEXUS-M',
    title: 'Nexus Mesh Zero-Trust IAM Protocol',
    department: 'Security & DevOps',
    clearance: 'LEVEL 4',
    status: 'REVIEW',
    progress: 65,
    lead: 'Tony Stark',
    updatedAt: '3h ago',
  },
  {
    id: 'proj-004',
    code: 'NANO-W',
    title: 'Next-Gen Biomorphic Smart Webbing',
    department: 'Material Science',
    clearance: 'LEVEL 2',
    status: 'ACTIVE',
    progress: 42,
    lead: 'Peter Parker',
    updatedAt: 'Yesterday',
  },
];

const INITIAL_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-security',
    title: 'Security Compliance',
    value: '99.4%',
    subtext: 'Hardware Token Synced · 0 Threats',
    trend: 'up',
    trendValue: '+0.6%',
    icon: 'pi pi-shield',
    accentColor: '#10b981',
  },
  {
    id: 'kpi-workspaces',
    title: 'Active Workspaces',
    value: '4 Projects',
    subtext: '2 Deployed · 1 Under Review',
    trend: 'neutral',
    trendValue: 'Steady',
    icon: 'pi pi-box',
    accentColor: '#3b82f6',
  },
  {
    id: 'kpi-leave',
    title: 'Time-Off Balance',
    value: '18.5 Days',
    subtext: 'Annual PTO Balance 2026',
    trend: 'down',
    trendValue: '-2.0d used',
    icon: 'pi pi-calendar',
    accentColor: '#8b5cf6',
  },
  {
    id: 'kpi-approvals',
    title: 'Pending Approvals',
    value: '3 Action Items',
    subtext: 'Architecture Review & Budget Sign-off',
    trend: 'up',
    trendValue: '2 Urgent',
    icon: 'pi pi-bell',
    accentColor: '#f59e0b',
  },
];

const INITIAL_AUDIT_LOGS: SecurityAuditItem[] = [
  {
    id: 'aud-001',
    event: 'Biometric MFA Challenge Verified',
    actor: 'Pepper Potts (EMP-10002)',
    timestamp: '2026-10-15 17:42:10 UTC',
    ipAddress: '192.168.10.42 (Starknet VPN)',
    status: 'SUCCESS',
  },
  {
    id: 'aud-002',
    event: 'SAML Session Token Renewed',
    actor: 'Tony Stark (EMP-10001)',
    timestamp: '2026-10-15 17:35:04 UTC',
    ipAddress: '192.168.10.15 (Direct Armor Link)',
    status: 'SUCCESS',
  },
  {
    id: 'aud-003',
    event: 'Firmware Flash Signature Validated',
    actor: 'JARVIS Automator',
    timestamp: '2026-10-15 16:15:22 UTC',
    ipAddress: '10.0.0.1 (Local Core Mesh)',
    status: 'SUCCESS',
  },
];

export class DashboardService {
  readonly projects: Signal<DashboardProject[]> = signal([...INITIAL_PROJECTS]);
  readonly kpis: Signal<DashboardKpi[]> = signal([...INITIAL_KPIS]);
  readonly auditLogs: Signal<SecurityAuditItem[]> = signal([...INITIAL_AUDIT_LOGS]);

  // Search & Filter State
  readonly searchQuery: Signal<string> = signal('');
  readonly statusFilter: Signal<ProjectStatus | 'ALL'> = signal('ALL');

  // Filtered derivations
  readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    let items = this.projects();

    if (filter !== 'ALL') {
      items = items.filter(p => p.status === filter);
    }

    if (query) {
      items = items.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.department.toLowerCase().includes(query) ||
        p.lead.toLowerCase().includes(query)
      );
    }

    return items;
  });

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  setStatusFilter(filter: ProjectStatus | 'ALL'): void {
    this.statusFilter.set(filter);
  }

  updateProjectProgress(id: string, progress: number): void {
    this.projects.update(list =>
      list.map(p => (p.id === id ? { ...p, progress: Math.min(100, Math.max(0, progress)) } : p))
    );
  }

  addProject(project: Omit<DashboardProject, 'id' | 'updatedAt'>): void {
    const newProj: DashboardProject = {
      ...project,
      id: `proj-${Date.now()}`,
      updatedAt: 'Just now',
    };
    this.projects.update(list => [newProj, ...list]);
  }
}
