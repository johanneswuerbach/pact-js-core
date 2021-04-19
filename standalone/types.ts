export interface PackageConfig {
  binaryLocation?: string;
  doNotTrack?: boolean;
}

export interface Config {
  doNotTrack: boolean;
  binaries: BinaryEntry[];
}

export interface Data {
  binaryDownloadPath: string;
  checksumDownloadPath: string;
  filepath: string;
  checksumFilepath: string;
  platform: string;
  isWindows: boolean;
  arch?: string;
  platformFolderPath?: string;
  binaryInstallSkipped?: boolean;
  binaryAlreadyDownloaded?: boolean;
  binaryAlreadyInstalled?: boolean;
}

export interface BinaryEntry {
  platform: string;
  arch?: string;
  binary: string;
  binaryChecksum: string;
  downloadLocation: string;
  folderName: string;
  type: 'ruby-standalone' | 'rust-ffi';
}
