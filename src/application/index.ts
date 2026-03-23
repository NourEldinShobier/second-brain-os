/**
 * Application layer: use cases and orchestration (wires domain to infrastructure).
 */
export { MarkdownCaptureService } from './capture-service.js';
export { EntityCrudService } from './entity-crud-service.js';
export { executeTypedCapture, type TypedCaptureInput, type TypedCaptureKind } from './typed-capture.js';
