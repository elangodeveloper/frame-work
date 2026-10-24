export interface EmployeeRepository {
  findById(id: string): Promise<any>;
  findAll(): Promise<any[]>;
  save(entity: any): Promise<void>;
  delete(id: string): Promise<void>;
}
