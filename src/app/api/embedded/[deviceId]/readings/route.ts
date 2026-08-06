import { NextResponse } from "next/server";
import {
  ActuatorToggleSchema,
  type ActuatorToggle,
} from "@/lib/embedded/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  getOrCreateDevice,
  getDeviceSnapshot,
  upsertSensorReading,
  saveSensorReadingHistory,
  getDefaultSensors,
  updateActuatorState,
  getActuators,
} from "@/lib/embedded/server-store";
import type { SensorReading, ActuatorState } from "@/lib/embedded/schemas";

const log = createLogger({ module: "embedded-readings" });

const defaultActuators: ActuatorState[] = [
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

function mutateSensors(sensors: SensorReading): SensorReading {
  return {
    ...sensors,
    camera: {
      ...sensors.camera,
      motionDetected: Math.random() > 0.85,
    },
    microphone: {
      ...sensors.microphone,
      level: Math.max(
        0,
        Math.min(100, sensors.microphone.level + (Math.random() - 0.5) * 20),
      ),
      noiseDetected: Math.random() > 0.9,
    },
    temperature: {
      ...sensors.temperature,
      current:
        Math.round(
          (sensors.temperature.current + (Math.random() - 0.5) * 0.5) * 10,
        ) / 10,
      alert: sensors.temperature.current > 30 || Math.random() > 0.95,
    },
  };
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { deviceId: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const user = result.ctx.user;
  log.debug("GET readings: request received", {
    deviceId: params.deviceId,
    userId: user.sub,
  });

  const deviceId = params.deviceId;
  const deviceName = `Embarqué ${deviceId}`;

  try {
    await getOrCreateDevice(deviceId, deviceName);

    let snapshot = await getDeviceSnapshot(deviceId);

    if (!snapshot) {
      log.warn(
        "GET readings: snapshot not found after create, falling back to defaults",
        { deviceId },
      );
      snapshot = {
        sensors: getDefaultSensors(deviceId),
        actuators: defaultActuators,
        connection: { type: "wireless", status: "connected", rssi: -42 },
      };
    }

    snapshot.sensors = mutateSensors(snapshot.sensors);

    await upsertSensorReading(deviceId, snapshot.sensors);
    await saveSensorReadingHistory(deviceId, snapshot.sensors);

    log.debug("GET readings: sensor reading persisted", { deviceId });

    return NextResponse.json({
      data: {
        sensors: snapshot.sensors,
        actuators: snapshot.actuators,
        connection: { type: "wireless", status: "connected", rssi: -42 },
      },
    });
  } catch (error) {
    log.error(
      "GET readings: database error, falling back to in-memory defaults",
      {
        deviceId,
        userId: user.sub,
        error,
      },
    );

    const fallbackSensors = mutateSensors(getDefaultSensors(deviceId));
    return NextResponse.json({
      data: {
        sensors: fallbackSensors,
        actuators: defaultActuators,
        connection: { type: "wireless", status: "connected", rssi: -42 },
      },
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { deviceId: string } },
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    schema: ActuatorToggleSchema,
  });
  if (!result.ok) return result.response;

  const user = result.ctx.user;
  const { id, state, enabled } = result.ctx.body as ActuatorToggle;
  const deviceId = params.deviceId;

  log.debug("POST readings: actuator toggle request", {
    deviceId,
    actuatorId: id,
    state,
    enabled,
    userId: user.sub,
  });

  try {
    const actuator = await updateActuatorState(deviceId, id, state, enabled);

    if (!actuator) {
      log.warn("POST readings: actuator not found", {
        deviceId,
        actuatorId: id,
      });
      return NextResponse.json(
        { error: `Actionneur ${id} introuvable` },
        { status: 404 },
      );
    }

    const allActuators = await getActuators(deviceId);

    log.info("POST readings: actuator state updated in database", {
      deviceId,
      actuatorId: id,
      state,
      enabled,
    });

    return NextResponse.json({
      data: {
        deviceId,
        actuator,
        actuators: allActuators,
      },
    });
  } catch (error) {
    log.error(
      "POST readings: database error, responding with actuator update failure",
      {
        deviceId,
        actuatorId: id,
        state,
        enabled,
        userId: user.sub,
        error,
      },
    );

    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'actionneur" },
      { status: 500 },
    );
  }
}
