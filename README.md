[![CircleCI](https://img.shields.io/circleci/build/github/markormesher/x-to-mqtt)](https://app.circleci.com/pipelines/github/markormesher/x-to-mqtt)
[![npm](https://img.shields.io/npm/v/@markormesher/x-to-mqtt)](https://www.npmjs.com/package/@markormesher/x-to-mqtt)

# X to MQTT

:wave: Arrived here from a _something_-to-MQTT project? Jump to [configuration](#configuration).

---

This is the base library for various _something_-to-MQTT projects, each of which works as an adapter from some upstream service to MQTT.

It provides a wrapper around an MQTT client to reduce boilerplate code in each individual project, as well as a handful of useful utils for things like reading environment variables and logging.

## Configuration

Configuration for projects that consume this library is controlled by the following environment variables:

| Variable Name | Description |
|--|--|
| `TOPIC_PREFIX` | Topic prefix for emitted messages. Non-optional. |
| `MQTT_HOST` | MQTT server host name, _not_ including `mqtt://`. Non-optional. |
| `MQTT_PORT` | MQTT server port. Optional, default 1883. |
| `MQTT_USERNAME` | MQTT server username. Optional, default no auth. |
| `MQTT_PASSWORD` | MQTT server password. Optional, default no auth. |
| `UPDATE_INTERVAL_SECONDS` | Update interval to query the upstream source. Optional, default depends on the parent project, may be unused. |

Each of the environment variables can be suffixed with `_FILE` to read the value from a file, e.g. `MQTT_PASSWORD_FILE=/run/secrets/mqtt-password`.

## Features

### MQTT Client Wrapper

This library handles reading the configuration above and connecting to the MQTT broker, then provides convenient methods for publishing messages and updating the health status (see below).

### Publishing

Publishing messages couldn't be easier - just call `.publish()` with the topic and message. The user-configured topic prefix will be added automatically.

```typescript
const mqttWrapper = new XToMqtt();
mqttWrapper.publish("topic/foo/bar", "Hello world!");
```

### Subscribing

Messages can be subcribed to with the `.subscribe()` method, passing in the topic pattern and a listener callback. The topic pattern can use the usual `+` and `#` wildcards supported by MQTT.

Note that the topic prefix is **not** included in the subscription pattern, allowing you to listen to topics outside of the tree you publish to. The topic prefix is exposed via `.getTopicPrefix()`, as shown below.

Subscriptions are not allowed until the MQTT client has connected, so it is advisable to subscribe to topics inside the `onConnect` handler, as shown below.

```typescript
const mqttWrapper = new XToMqtt({
  onConnect: () => {
    mqttWrapper.subscribe(`${mqttWrapper.getTopicPrefix()}/command/#`, (topic, message) => {
      logger.info("Command message received", { topic, message });
    });
  },
});
```

### Standardised Status Publishing

Every project that consumes this library publishes its status on two standardised topics:

- `${topicPrefix}/_meta/last_seen` - ISO 8601 timestamp of the last update from the upstream source
- `${topicPrefix}/_meta/upstream_status` - status of the upstream source, always either `okay`, `errored` or `unknown`.

Both of these values can be updated directly via the library or may be updated automatically when other messages are published, depending on the settings used by each project (see this library's type definitions for all settings).

Other topics may be published under the `_meta` topic in the future.

### Repeating Update Runner

Many of the _something_-to-MQTT projects work by querying some upstream source on a given interval then publishing results. To further reduce boilerplate code, this library includes a utility to set up recurring updates that use the interval configured above.

Note: the update runner deliberately does not try to catch errors; if the update function throws an error the process will likely exit. This can be helpful if you want your programme to be restarted on error and you're using something like Kubernetes that will do that for you, but if you don't want the execution process to exit then you will need to catch and handle any potential errors.

## Example

Below is a minimal example of using this library. Note that not all settings are shown - see the source code and type definitions for all options.

```typescript
import { XToMqtt, logger, registerRepeatingUpdate } from "x-to-mqtt";

const mqttWrapper = new XToMqtt({
  // these are the default settings, so you could skipt this
  updateLastSeenOnPublish: true,
  updateUpstreamStatusOnPublish: true,

  // onConnect is optional
  onConnect: () => {
    mqttWrapper.subscribe("some/topic/+/set", (topic, message) => {
      logger.info("Message received");
    });
  },
});

registerRepeatingUpdate({ defaultIntervalSeconds: 3600 }, () => {
  logger.info("Getting new result...");
  getResultFromSomewhere()
    .then((result) => {
        logger.info("Got result");
        mqttWrapper.publish("key", result);
     })
    .catch((error) => {
      logger.error("Failed to get result", { error });
      mqttWrapper.updateUpstreamStatus("errored");
    });
});
```
