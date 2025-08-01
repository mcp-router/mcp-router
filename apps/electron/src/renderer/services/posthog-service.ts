import posthog from "posthog-js/dist/module.full.no-external";

const POSTHOG_API_KEY = "phc_IT78Ct3BMiUYBZLgAXEKUHKVjfAtVL5urGBk17WpWiI";
const POSTHOG_HOST = "https://us.i.posthog.com";

interface PostHogConfig {
  analyticsEnabled: boolean;
  userId?: string;
}

class PostHogService {
  private initialized = false;

  initialize(config: PostHogConfig): void {
    if (this.initialized) {
      return;
    }

    if (!config.analyticsEnabled) {
      this.disable();
      return;
    }

    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "always",
      autocapture: true,
      loaded: (ph) => {
        if (config.userId) {
          ph.identify(config.userId);
        }
      },
    });

    this.initialized = true;
  }

  updateConfig(config: PostHogConfig): void {
    if (config.analyticsEnabled) {
      if (!this.initialized) {
        this.initialize(config);
      } else {
        posthog.opt_in_capturing();
        if (config.userId) {
          posthog.identify(config.userId);
        }
      }
    } else {
      this.disable();
    }
  }

  disable(): void {
    if (this.initialized) {
      posthog.opt_out_capturing();
    }
  }

  capture(event: string, properties?: Record<string, any>): void {
    if (this.initialized && posthog.has_opted_in_capturing()) {
      const safeProperties = this.sanitizeProperties(properties);
      posthog.capture(event, safeProperties);
    }
  }

  private sanitizeProperties(
    properties?: Record<string, any>,
  ): Record<string, any> {
    if (!properties) {
      return {};
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.length;
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = "[object]";
      }
    }
    return sanitized;
  }

  shutdown(): void {
    if (this.initialized) {
      // PostHog doesn't have a shutdown method, just disable capturing
      posthog.opt_out_capturing();
      this.initialized = false;
    }
  }
}

export const postHogService = new PostHogService();
