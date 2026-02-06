export interface PackageUpdateInfo {
  packageName: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export interface ServerPackageUpdates {
  packages: PackageUpdateInfo[];
  hasUpdates: boolean;
}
