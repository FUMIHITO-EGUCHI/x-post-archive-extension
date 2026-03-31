type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
};

type OpenFilePickerOptions = {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
};

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
  close(): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

type WriteParams = {
  type: "write" | "seek" | "truncate";
  position?: number;
  size?: number;
  data?: BufferSource | Blob | string;
};

interface FileSystemFileHandle {
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface Window {
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}
