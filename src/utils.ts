import { readFileSync } from "fs";

type JsonValue = string | number | boolean | { [x: string]: JsonValue } | JsonValue[];

function getEnvConfig(key: string): string | undefined {
  const maybeFilePath = process.env[key + "_FILE"];
  const maybeLiteralValue = process.env[key];
  if (maybeFilePath) {
    return readFileSync(maybeFilePath).toString().trim();
  } else if (maybeLiteralValue) {
    return maybeLiteralValue.trim();
  } else {
    return undefined;
  }
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: JsonValue) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}

function makeLogLine(message: string, params?: Record<string, unknown>): string {
  return JSON.stringify(
    {
      timestamp: new Date(),
      message,
      params,
    },
    getCircularReplacer(),
  );
}

const logger = {
  debug: (message: string, params?: Record<string, unknown>) => {
    if (process.env?.DEBUG == "true") {
      console.debug(makeLogLine(message, params));
    }
  },
  info: (message: string, params?: Record<string, unknown>) => {
    console.info(makeLogLine(message, params));
  },
  warn: (message: string, params?: Record<string, unknown>) => {
    console.warn(makeLogLine(message, params));
  },
  error: (message: string, params?: Record<string, unknown>) => {
    console.error(makeLogLine(message, params));
  },
};

type RepeatingUpdateSettings = {
  runImmediately?: boolean;
  defaultIntervalSeconds: number;
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
};

function registerRepeatingUpdate(settings: RepeatingUpdateSettings, handler: () => void): void {
  const rawUpdateInterval = getEnvConfig("UPDATE_INTERVAL_SECONDS") ?? "";
  let updateInterval = parseInt(rawUpdateInterval) ?? settings.defaultIntervalSeconds;
  if (settings.minIntervalSeconds !== undefined) {
    updateInterval = Math.max(updateInterval, settings.minIntervalSeconds);
  }
  if (settings.maxIntervalSeconds !== undefined) {
    updateInterval = Math.min(updateInterval, settings.maxIntervalSeconds);
  }

  logger.info("Registered repeating update", { updateInterval });
  setInterval(handler, updateInterval);

  if (settings.runImmediately) {
    handler();
  }
}

export { getEnvConfig, logger, RepeatingUpdateSettings, registerRepeatingUpdate };
