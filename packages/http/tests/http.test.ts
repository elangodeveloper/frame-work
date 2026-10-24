import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HttpClient } from '../src/index.ts';

describe('@jarvis/http - HttpClient', () => {
  it('should create an HttpClient instance', () => {
    const client = new HttpClient('https://api.example.com');
    assert.strictEqual(typeof client.get, 'function');
    assert.strictEqual(typeof client.post, 'function');
  });
});
