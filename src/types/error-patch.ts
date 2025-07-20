export interface SearchBarMetadata {
  generated_at: string;
  prompt?: string;
  version?: number;
}

export interface ComponentProps {
  id?: string;
  className?: string;
  metadata?: SearchBarMetadata;
  [key: string]: unknown;
}

export interface ComponentError {
  message: string;
  code: string;
  timestamp: Date;
  fixAttempts: number;
  resolved: boolean;
}

export interface ErrorPatchConfig {
  maxRetries: number;
  patchDelay: number;
  autoRetry: boolean;
}
