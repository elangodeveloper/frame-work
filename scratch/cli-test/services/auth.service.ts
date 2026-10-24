import { Injectable, inject } from '@jarvis/core';
import { HttpClient } from '@jarvis/http';

@Injectable()
export class AuthService {
  private readonly http = inject(HttpClient);

  fetchData(): string {
    return 'AuthService operational';
  }
}
