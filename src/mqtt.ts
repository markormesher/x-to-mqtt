import { strict as assert } from "assert";
import * as mqtt from "mqtt";
import { getEnvConfig, logger } from "./utils.js";

type XToMqttSettings = {
  updateLastSeenOnPublish?: boolean;
  updateUpstreamStatusOnPublish?: boolean;
};

const defaultSettings: XToMqttSettings = {
  updateLastSeenOnPublish: true,
  updateUpstreamStatusOnPublish: true,
};

type UpstreamStatus = "unknown" | "okay" | "errored";

class XToMqtt {
  private settings: XToMqttSettings;
  private topicPrefix: string;
  private mqttClient: mqtt.MqttClient;

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

  private setupMqttClientEventHandlers(): void {
    this.mqttClient.on("connect", () => logger.info("MQTT client connected"));
    this.mqttClient.on("reconnect", () => logger.info("MQTT client reconnecting..."));
    this.mqttClient.on("disconnect", () => logger.info("MQTT client disconnected"));
  }

  public updateUpstreamStatus(status: UpstreamStatus): void {
    this.publish("_meta/upstream_status", status);
  }

  public updateLastSeen(value?: Date) {
    const realValue = value ?? new Date();
    const valueStr = realValue.toISOString();
    this.publish("_meta/last_seen", valueStr);
  }

  public publish(topicSuffix: string, message: string | number): void {
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
}

export { XToMqtt, XToMqttSettings, UpstreamStatus };
