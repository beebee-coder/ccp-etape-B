import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type {
  SensorReading,
  ActuatorState,
  DeviceConnectionInfo,
} from "@/lib/embedded/schemas";

const log = createLogger({ module: "embedded-server-store" });

interface ActuatorRow {
  id: string;
  device_id: string;
  name: string;
  type: string;
  state: string;
  enabled: boolean;
  updated_at: string;
}

interface DeviceRow {
  id: string;
  name: string;
  connection_type: string;
  connection_status: string;
  rssi: number | null;
  sensors_json: string;
  created_at: string;
  updated_at: string;
}

function getDefaultSensors(deviceId: string): SensorReading {
  return {
    deviceId,
    timestamp: Date.now(),
    camera: {
      active: true,
      resolution: "1920x1080",
      fps: 30,
      motionDetected: false,
    },
    microphone: { active: true, level: 45, noiseDetected: false },
    temperature: {
      active: true,
      current: 22.5,
      min: 18,
      max: 35,
      unit: "C",
      alert: false,
    },
  };
}

const DEFAULT_ACTUATORS: ActuatorState[] = [
  {
    id: "relay-1",
    name: "Relais principal",
    type: "relay",
    state: "idle",
    enabled: false,
  },
  {
    id: "servo-1",
    name: "Servo d'orientation",
    type: "servo",
    state: "idle",
    enabled: false,
  },
  {
    id: "led-1",
    name: "LED indicateur",
    type: "led",
    state: "idle",
    enabled: false,
  },
];

function getDefaultActuators(): ActuatorState[] {
  return DEFAULT_ACTUATORS.map((a) => ({ ...a }));
}

export async function getOrCreateDevice(
  deviceId: string,
  name: string,
): Promise<DeviceRow> {
  log.debug("getOrCreateDevice: checking device existence", { deviceId, name });
  const now = new Date().toISOString();

  try {
    const result = await query<DeviceRow>(
      `SELECT id, name, connection_type, connection_status, rssi, sensors_json, created_at, updated_at
       FROM iot_devices
       WHERE id = $1`,
      [deviceId],
    );

    if (result.rows.length > 0) {
      log.debug("getOrCreateDevice: device found", {
        deviceId,
        connectionStatus: result.rows[0].connection_status,
      });
      return result.rows[0];
    }

    log.debug("getOrCreateDevice: device not found, creating", { deviceId });
    const sensors = JSON.stringify(getDefaultSensors(deviceId));
    const insertResult = await query<DeviceRow>(
      `INSERT INTO iot_devices (id, name, connection_type, connection_status, rssi, sensors_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, connection_type, connection_status, rssi, sensors_json, created_at, updated_at`,
      [deviceId, name, "wireless", "disconnected", null, sensors, now, now],
    );

    log.info("getOrCreateDevice: device created", { deviceId, name });

    await seedActuators(deviceId);

    return insertResult.rows[0];
  } catch (error) {
    log.error("getOrCreateDevice: database error", { deviceId, error });
    throw error;
  }
}

export async function seedActuators(deviceId: string): Promise<void> {
  log.debug("seedActuators: seeding default actuators", { deviceId });
  const actuators = getDefaultActuators();
  const now = new Date().toISOString();

  for (const actuator of actuators) {
    try {
      await query(
        `INSERT INTO iot_actuators (id, device_id, name, type, state, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          actuator.id,
          deviceId,
          actuator.name,
          actuator.type,
          actuator.state,
          actuator.enabled,
          now,
        ],
      );
    } catch (error) {
      log.error("seedActuators: failed to insert actuator", {
        deviceId,
        actuatorId: actuator.id,
        error,
      });
    }
  }

  log.debug("seedActuators: completed", { deviceId, count: actuators.length });
}

export async function getDeviceSnapshot(deviceId: string): Promise<{
  sensors: SensorReading;
  actuators: ActuatorState[];
  connection: DeviceConnectionInfo;
} | null> {
  log.debug("getDeviceSnapshot: fetching device snapshot", { deviceId });

  try {
    const deviceResult = await query<DeviceRow>(
      `SELECT id, name, connection_type, connection_status, rssi, sensors_json, created_at, updated_at
       FROM iot_devices
       WHERE id = $1`,
      [deviceId],
    );

    if (deviceResult.rows.length === 0) {
      log.debug("getDeviceSnapshot: device not found, returning null", {
        deviceId,
      });
      return null;
    }

    const device = deviceResult.rows[0];

    const actuatorResult = await query<ActuatorRow>(
      `SELECT id, device_id, name, type, state, enabled, updated_at
       FROM iot_actuators
       WHERE device_id = $1
       ORDER BY updated_at DESC`,
      [deviceId],
    );

    let sensors: SensorReading;
    try {
      sensors = JSON.parse(device.sensors_json) as SensorReading;
    } catch {
      log.warn(
        "getDeviceSnapshot: failed to parse sensors_json, using defaults",
        { deviceId },
      );
      sensors = getDefaultSensors(deviceId);
    }

    const actuators: ActuatorState[] = actuatorResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as ActuatorState["type"],
      state: row.state as ActuatorState["state"],
      enabled: row.enabled,
    }));

    const connection: DeviceConnectionInfo = {
      type: device.connection_type as DeviceConnectionInfo["type"],
      status: device.connection_status as DeviceConnectionInfo["status"],
      rssi: device.rssi ?? undefined,
    };

    log.debug("getDeviceSnapshot: snapshot fetched", {
      deviceId,
      actuatorCount: actuators.length,
    });
    return { sensors, actuators, connection };
  } catch (error) {
    log.error("getDeviceSnapshot: database error", { deviceId, error });
    throw error;
  }
}

export async function upsertSensorReading(
  deviceId: string,
  sensors: SensorReading,
): Promise<void> {
  log.debug("upsertSensorReading: saving sensor reading", { deviceId });

  const sensorsJson = JSON.stringify(sensors);
  const now = new Date().toISOString();

  try {
    await query(
      `UPDATE iot_devices
       SET sensors_json = $1, updated_at = $2
       WHERE id = $3`,
      [sensorsJson, now, deviceId],
    );

    log.debug("upsertSensorReading: sensor reading saved to device", {
      deviceId,
    });
  } catch (error) {
    log.error("upsertSensorReading: failed to update device sensors", {
      deviceId,
      error,
    });
  }
}

export async function saveSensorReadingHistory(
  deviceId: string,
  sensors: SensorReading,
): Promise<void> {
  log.debug("saveSensorReadingHistory: saving historical reading", {
    deviceId,
  });

  const sensorsJson = JSON.stringify(sensors);
  const now = new Date().toISOString();

  try {
    await query(
      `INSERT INTO iot_sensor_readings (device_id, reading_json, created_at)
       VALUES ($1, $2, $3)`,
      [deviceId, sensorsJson, now],
    );

    log.debug("saveSensorReadingHistory: historical reading saved", {
      deviceId,
    });
  } catch (error) {
    log.error("saveSensorReadingHistory: failed to save history", {
      deviceId,
      error,
    });
  }
}

export async function getActuators(deviceId: string): Promise<ActuatorState[]> {
  log.debug("getActuators: fetching actuators", { deviceId });

  try {
    const result = await query<ActuatorRow>(
      `SELECT id, device_id, name, type, state, enabled, updated_at
       FROM iot_actuators
       WHERE device_id = $1`,
      [deviceId],
    );

    const actuators: ActuatorState[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as ActuatorState["type"],
      state: row.state as ActuatorState["state"],
      enabled: row.enabled,
    }));

    log.debug("getActuators: actuators fetched", {
      deviceId,
      count: actuators.length,
    });
    return actuators;
  } catch (error) {
    log.error("getActuators: database error", { deviceId, error });
    throw error;
  }
}

export async function updateActuatorState(
  deviceId: string,
  actuatorId: string,
  state: "idle" | "active" | "error",
  enabled: boolean,
): Promise<ActuatorState | null> {
  log.debug("updateActuatorState: updating actuator", {
    deviceId,
    actuatorId,
    state,
    enabled,
  });

  const now = new Date().toISOString();

  try {
    await query(
      `UPDATE iot_actuators
       SET state = $1, enabled = $2, updated_at = $3
       WHERE device_id = $4 AND id = $5`,
      [state, enabled, now, deviceId, actuatorId],
    );

    log.info("updateActuatorState: actuator updated", {
      deviceId,
      actuatorId,
      state,
      enabled,
    });

    const result = await query<ActuatorRow>(
      `SELECT id, device_id, name, type, state, enabled, updated_at
       FROM iot_actuators
       WHERE device_id = $1 AND id = $2`,
      [deviceId, actuatorId],
    );

    if (result.rows.length === 0) {
      log.warn("updateActuatorState: actuator not found after update", {
        deviceId,
        actuatorId,
      });
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type as ActuatorState["type"],
      state: row.state as ActuatorState["state"],
      enabled: row.enabled,
    };
  } catch (error) {
    log.error("updateActuatorState: database error", {
      deviceId,
      actuatorId,
      error,
    });
    throw error;
  }
}

export async function upsertDeviceConnection(
  deviceId: string,
  connectionType: string,
  connectionStatus: string,
  rssi?: number,
): Promise<void> {
  log.debug("upsertDeviceConnection: updating device connection", {
    deviceId,
    connectionType,
    connectionStatus,
    rssi,
  });

  const now = new Date().toISOString();

  try {
    await query(
      `UPDATE iot_devices
       SET connection_type = $1, connection_status = $2, rssi = $3, updated_at = $4
       WHERE id = $5`,
      [connectionType, connectionStatus, rssi ?? null, now, deviceId],
    );

    log.debug("upsertDeviceConnection: device connection updated", {
      deviceId,
      connectionStatus,
    });
  } catch (error) {
    log.error("upsertDeviceConnection: database error", { deviceId, error });
  }
}

export { getDefaultSensors, getDefaultActuators };
