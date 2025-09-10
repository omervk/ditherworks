declare module 'archiver' {
  import { Stream } from 'node:stream';
  interface ArchiverOptions {
    zlib?: { level?: number };
  }
  interface AppendOptions {
    name: string;
  }
  interface Archiver extends Stream {
    append(input: Buffer | NodeJS.ReadableStream, options: AppendOptions): this;
    finalize(): Promise<void>;
    pipe(dest: NodeJS.WritableStream): NodeJS.WritableStream;
    on(event: 'warning', handler: (err: unknown) => void): this;
    on(event: 'error', handler: (err: unknown) => void): this;
    destroy(error?: Error): void;
  }
  function archiver(format: 'zip', options?: ArchiverOptions): Archiver;
  export default archiver;
}


