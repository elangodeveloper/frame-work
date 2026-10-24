import { Pipe, type PipeTransform } from '@jarvis/core';

@Pipe({ name: 'dateFormat' })
export class DateFormatPipe implements PipeTransform {
  transform(value: any, ...args: any[]): any {
    return value;
  }
}
