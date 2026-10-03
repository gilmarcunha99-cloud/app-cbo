import { Buffer } from 'buffer';

globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.process = globalThis.process || { env: {} };
