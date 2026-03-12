export type ConfigSource = "env" | "file" | "default" | "unset";

export interface StoredConfig {
  webUnlockerApiKey?: string;
  cloudToken?: string;
  defaultProfileId?: string;
  daemonPort?: number;
}

export interface ResolvedConfig extends StoredConfig {
  daemonPort: number;
  configPath: string;
  stateDir: string;
  jobsDir: string;
  trackingDir: string;
  artifactsDir: string;
  sources: {
    webUnlockerApiKey: ConfigSource;
    cloudToken: ConfigSource;
    defaultProfileId: ConfigSource;
    daemonPort: ConfigSource;
  };
}

export type ScrapeFormat = "html" | "markdown" | "text" | "json";

export interface ScrapeEnvelope {
  url: string;
  title?: string;
  description?: string;
  text: string;
  headings: Array<{
    level: number;
    text: string;
  }>;
  links: Array<{
    text: string;
    href: string;
  }>;
}

export interface BrowserSessionSummary {
  id: string;
  profileId?: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  current: boolean;
}

export interface SnapshotElement {
  ref: string;
  selector: string;
  tag: string;
  role?: string;
  label?: string;
  text?: string;
  type?: string;
  href?: string;
  placeholder?: string;
}

export interface BrowserSnapshot {
  sessionId: string;
  url: string;
  title: string;
  capturedAt: string;
  elements: SnapshotElement[];
}

export type DoctorStatus = "ok" | "warn" | "error" | "info";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  detail: string;
}

export type WebAccessJobKind = "crawl" | "run" | "batch";
export type WebAccessJobStatus = "queued" | "running" | "ok" | "partial" | "failed";

export interface WebAccessJobRecord {
  jobId: string;
  kind: WebAccessJobKind;
  name: string;
  status: WebAccessJobStatus;
  cwd: string;
  args: string[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  outputPath?: string;
  errorPath?: string;
  resultPath?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
