interface Window {
  process?: {
    env?: Record<string, string>;
    versions?: {
      electron?: string;
    };
  };
}

declare namespace NodeJS {
  type Timeout = any;
}
