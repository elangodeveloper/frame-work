export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  status: 'active' | 'leave' | 'terminated';
}
