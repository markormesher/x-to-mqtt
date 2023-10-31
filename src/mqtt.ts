import { strict as assert } from "assert";
import * as mqtt from "mqtt";
import { getEnvConfig, logger } from "./utils.js";

type XToMqttSettings = {
  updateLastSeenOnPublish?: boolean;
  updateUpstreamStatusOnPublish?: boolean;
  onConnect?: () => void;
};

const defaultSettings: XToMqttSettings = {
  updateLastSeenOnPublish: true,
  updateUpstreamStatusOnPublish: true,
};

type UpstreamStatus = "unknown" | "okay" | "errored";

type MessageListener = (topic: string, message: string) => void;

class XToMqtt {
  private settings: XToMqttSettings;
  private topicPrefix: string;
  private mqttClient: mqtt.MqttClient;
  private subscriptions: [RegExp, MessageListener][] = [];

  private static topicPatternToRegex(topicSubscription: string): RegExp {
    // escape slashes
    let regex = topicSubscription.replaceAll("/", "\\/");

    // replace single-chunk wildcards
    regex = regex.replaceAll("+", "[^/]+");

    // replace multi-chunk wildcard
    regex = regex.replace(/#$/, ".*");

    // match the entire topic
    regex = `^${regex}$`;

    logger.debug("Converted topic subscription to regex", { topicSubscription, regex });
    return new RegExp(regex);
  }

  constructor(settings?: XToMqttSettings) {
    this.settings = {
      ...defaultSettings,
      ...settings,
    };

    const mqttHost = getEnvConfig("MQTT_HOST");
    const mqttPort = parseInt(getEnvConfig("MQTT_PORT") ?? "1883") ?? 1883;
    const mqttUsername = getEnvConfig("MQTT_USERNAME");
    const mqttPassword = getEnvConfig("MQTT_PASSWORD");
    const topicPrefix = getEnvConfig("TOPIC_PREFIX");

    // check required values
    assert(!!mqttHost, "MQTT host not set");
    assert(!!topicPrefix, "Topic prefix not set");

    // MQTT setup
    this.topicPrefix = topicPrefix;
    this.mqttClient = mqtt.connect({
      host: mqttHost,
      port: mqttPort,
      username: mqttUsername,
      password: mqttPassword,
    });
    this.setupMqttClientEventHandlers();
  }

  public getTopicPrefix(): string {
    return this.topicPrefix;
  }

  private setupMqttClientEventHandlers(): void {
    this.mqttClient.on("connect", () => {
      logger.info("MQTT client connected");
      this.settings.onConnect?.();
    });
    this.mqttClient.on("reconnect", () => logger.info("MQTT client reconnecting..."));
    this.mqttClient.on("disconnect", () => logger.info("MQTT client disconnected"));
    this.mqttClient.on("message", (topic: string, message: Buffer) => {
      const messageStr = message.toString();
      this.subscriptions.forEach(([topicRegex, listener]) => {
        if (topicRegex.test(topic)) {
          listener(topic, messageStr);
        }
      });
    });
  }

  public updateUpstreamStatus(status: UpstreamStatus): void {
    this.publish("_meta/upstream_status", status);
  }

  public updateLastSeen(value?: Date) {
    const realValue = value ?? new Date();
    const valueStr = realValue.toISOString();
    this.publish("_meta/last_seen", valueStr);
  }

  public publish(topicSuffix: string, message: string | number | boolean): void {
    if (this.settings.updateLastSeenOnPublish && !topicSuffix.startsWith("_meta")) {
      this.updateLastSeen();
    }

    if (this.settings.updateUpstreamStatusOnPublish && !topicSuffix.startsWith("_meta")) {
      this.updateUpstreamStatus("okay");
    }

    if (this.mqttClient.connected) {
      logger.debug("Publishing message", { topicSuffix, message });
      this.mqttClient.publish(`${this.topicPrefix}/${topicSuffix.replace(/^\/*/, "")}`, message?.toString());
    } else {
      logger.debug("Dropping message because MQTT client is disconnected", { topicSuffix, message });
    }
  }

  public subscribe(topicPattern: string, listener: MessageListener): void {
    if (this.mqttClient.connected) {
      logger.debug("Subscribing to topic", { topicPattern });
      this.subscriptions.push([XToMqtt.topicPatternToRegex(topicPattern), listener]);
      this.mqttClient.subscribe(topicPattern);
    } else {
      logger.warn("Cannot subscribe to a topic before the MQTT client is connected", { topicPattern });
    }
  }
}

export { XToMqtt, XToMqttSettings, UpstreamStatus };
