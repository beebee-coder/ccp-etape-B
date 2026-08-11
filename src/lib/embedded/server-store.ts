import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import type {
  SensorReading,
  ActuatorState,
  DeviceConnectionInfo,
} from "@/lib/embedded/schemas";

const log = createLogger({ module: "embedded-server-store" });

interface DeviceRow {
  id: string;
  name: string;
  connectionType: string;
  connectionStatus: string;
  rssi: number | null;
  sensorsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
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

  try {
    const existing = await prisma.iotDevice.findUnique({
      where: { id: deviceId },
    });

    if (existing) {
      log.debug("getOrCreateDevice: device found", {
        deviceId,
        connectionStatus: existing.connectionStatus,
      });
      return {
        id: existing.id,
        name: existing.name,
        connectionType: existing.connectionType,
        connectionStatus: existing.connectionStatus,
        rssi: existing.rssi ?? null,
        sensorsJson: existing.sensorsJson,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    log.debug("getOrCreateDevice: device not found, creating", { deviceId });
    const sensors = getDefaultSensors(deviceId);

    const created = await prisma.iotDevice.create({
      data: {
        id: deviceId,
        name,
        connectionType: "wireless",
        connectionStatus: "disconnected",
        sensorsJson: sensors as unknown as Prisma.InputJsonValue,
      },
    });

    log.info("getOrCreateDevice: device created", { deviceId, name });

    await seedActuators(deviceId);

    return {
      id: created.id,
      name: created.name,
      connectionType: created.connectionType,
      connectionStatus: created.connectionStatus,
      rssi: created.rssi ?? null,
      sensorsJson: created.sensorsJson,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  } catch (error) {
    log.error("getOrCreateDevice: database error", { deviceId, error });
    throw error;
  }
}

export async function seedActuators(deviceId: string): Promise<void> {
  log.debug("seedActuators: seeding default actuators", { deviceId });
  const actuators = getDefaultActuators();

  for (const actuator of actuators) {
    try {
      await prisma.iotActuator.create({
        data: {
          id: actuator.id,
          deviceId,
          name: actuator.name,
          type: actuator.type,
          state: actuator.state,
          enabled: actuator.enabled,
        },
      });
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
    const device = await prisma.iotDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      log.debug("getDeviceSnapshot: device not found, returning null", {
        deviceId,
      });
      return null;
    }

    const actuatorRows = await prisma.iotActuator.findMany({
      where: { deviceId },
      orderBy: { updatedAt: "desc" },
    });

    let sensors: SensorReading;
    try {
      sensors = device.sensorsJson as unknown as SensorReading;
    } catch {
      log.warn(
        "getDeviceSnapshot: failed to parse sensors_json, using defaults",
        { deviceId },
      );
      sensors = getDefaultSensors(deviceId);
    }

    const actuators: ActuatorState[] = actuatorRows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as ActuatorState["type"],
      state: row.state as ActuatorState["state"],
      enabled: row.enabled,
    }));

    const connection: DeviceConnectionInfo = {
      type: device.connectionType as DeviceConnectionInfo["type"],
      status: device.connectionStatus as DeviceConnectionInfo["status"],
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

  try {
    await prisma.iotDevice.update({
      where: { id: deviceId },
      data: {
        sensorsJson: sensors as unknown as Prisma.InputJsonValue,
      },
    });

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

  try {
    await prisma.iotSensorReading.create({
      data: {
        id: `${deviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        deviceId,
        readingJson: sensors as unknown as Prisma.InputJsonValue,
      },
    });

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
    const actuatorRows = await prisma.iotActuator.findMany({
      where: { deviceId },
    });

    const actuators: ActuatorState[] = actuatorRows.map((row) => ({
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

  try {
    const existing = await prisma.iotActuator.findFirst({
      where: { id: actuatorId, deviceId },
    });

    if (!existing) {
      log.warn("updateActuatorState: actuator not found after update", {
        deviceId,
        actuatorId,
      });
      return null;
    }

    const updated = await prisma.iotActuator.update({
      where: { id: actuatorId },
      data: { state, enabled },
    });

    log.info("updateActuatorState: actuator updated", {
      deviceId,
      actuatorId,
      state,
      enabled,
    });

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type as ActuatorState["type"],
      state: updated.state as ActuatorState["state"],
      enabled: updated.enabled,
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

  try {
    await prisma.iotDevice.update({
      where: { id: deviceId },
      data: {
        connectionType,
        connectionStatus,
        rssi: rssi ?? null,
      },
    });

    log.debug("upsertDeviceConnection: device connection updated", {
      deviceId,
      connectionStatus,
    });
  } catch (error) {
    log.error("upsertDeviceConnection: database error", { deviceId, error });
  }
}

export { getDefaultSensors, getDefaultActuators };
