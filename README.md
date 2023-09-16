![CircleCI](https://img.shields.io/circleci/build/github/markormesher/x-to-mqtt)
![npm](https://img.shields.io/npm/v/@markormesher/x-to-mqtt)

# X to MQTT

👋 Arrived here from a _something_-to-MQTT project? Jump to [configuration](#configuration).

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
