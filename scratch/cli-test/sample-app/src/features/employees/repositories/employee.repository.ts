import { Injectable, inject } from '@jarvis/core';
import { HttpClient } from '@jarvis/http';
import type { EmployeeRepository } from './employee-repository.interface.ts';

@Injectable()
export class HttpEmployeeRepository implements EmployeeRepository {
  private readonly http = inject(HttpClient);

  async findById(id: string): Promise<any> {
    return { id, status: 'loaded' };
  }

  async findAll(): Promise<any[]> {
    return [];
  }

  async save(entity: any): Promise<void> {}

  async delete(id: string): Promise<void> {}
}
