declare module "@marsaud/smb2" {
  import type { Readable, Writable } from "node:stream";
  type Entry = {
    name: string;
    size: number;
    mtime: Date;
    isDirectory(): boolean;
  };
  export default class SMB2 {
    constructor(options: {
      share: string;
      domain?: string;
      username: string;
      password?: string;
      port?: number;
      autoCloseTimeout?: number;
    });
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: { stats: true }): Promise<Entry[]>;
    unlink(path: string): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(
      path: string,
      options?: { flags?: string },
    ): Promise<Writable>;
    disconnect(): void;
  }
}
