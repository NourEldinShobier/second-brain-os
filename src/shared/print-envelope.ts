import type { JsonEnvelope } from './envelope.js';

export function printJsonEnvelope<T>(envelope: JsonEnvelope<T>): void {
  console.log(JSON.stringify(envelope, null, 2));
}
