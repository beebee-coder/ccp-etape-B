import type { DeviceEvent } from "@/lib/embedded/device-service";
import type { SensorReading } from "@/lib/embedded/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  getOrCreateDevice,
  getDeviceSnapshot,
  upsertSensorReading,
  saveSensorReadingHistory,
  upsertDeviceConnection,
} from "@/lib/embedded/server-store";

const log = createLogger({ handler: "embedded-events" });

const intervalMs = 2000;

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

function buildSensorReading(
  deviceId: string,
  sensors: SensorReading,
): { reading: SensorReading; next: SensorReading } {
  const next = mutateSensors(sensors);
  return {
    reading: {
      ...next,
      timestamp: Date.now(),
    },
    next,
  };
}

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "embarque-01";

  log.debug("GET events: SSE stream requested", { deviceId });

  const encoder = new TextEncoder();

  let sensors: SensorReading = {
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

  let intervalId: ReturnType<typeof setInterval> | undefined;

  try {
    await getOrCreateDevice(deviceId, `Embarqué ${deviceId}`);

    const snapshot = await getDeviceSnapshot(deviceId);
    if (snapshot) {
      sensors = {
        ...sensors,
        ...snapshot.sensors,
        deviceId,
        timestamp: Date.now(),
      };
      log.debug("GET events: initialized sensors from database", { deviceId });
    } else {
      log.warn("GET events: device snapshot not found, using defaults", {
        deviceId,
      });
    }

    await upsertDeviceConnection(deviceId, "wireless", "connected", -42);
    log.debug("GET events: device connection updated in database", {
      deviceId,
    });
  } catch (error) {
    log.warn(
      "GET events: failed to initialize device from database, using in-memory defaults",
      {
        deviceId,
        error,
      },
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: DeviceEvent) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      };

      send({ type: "status", data: { connected: true, rssi: -42 } });
      const initial = buildSensorReading(deviceId, sensors);
      sensors = initial.next;
      send({ type: "sensor", data: initial.reading });

      intervalId = setInterval(async () => {
        try {
          const sensorResult = buildSensorReading(deviceId, sensors);
          sensors = sensorResult.next;
          const reading = sensorResult.reading;

          send({ type: "sensor", data: reading });

          await upsertSensorReading(deviceId, reading);
          await saveSensorReadingHistory(deviceId, reading);

          if (reading.temperature.alert) {
            send({
              type: "alarm",
              data: {
                message: `Alerte température : seuil dépassé — ${reading.temperature.current}°C détecté.`,
                severity: "danger",
                sensor: "temperature",
              },
            });
          }

          if (reading.camera.motionDetected) {
            send({
              type: "alarm",
              data: {
                message: "Mouvement détecté sur la caméra.",
                severity: "warning",
                sensor: "camera",
              },
            });
          }

          if (reading.microphone.noiseDetected) {
            send({
              type: "alarm",
              data: {
                message: "Bruit anormal détecté par le microphone.",
                severity: "warning",
                sensor: "microphone",
              },
            });
          }
        } catch (error) {
          log.error("SSE interval: failed to persist sensor reading", {
            deviceId,
            error,
          });
          const sensorResult = buildSensorReading(deviceId, sensors);
          sensors = sensorResult.next;
          send({ type: "sensor", data: sensorResult.reading });
        }
      }, intervalMs);

      controller.enqueue(encoder.encode(": keep-alive\n\n"));

      request.signal.addEventListener("abort", () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
        controller.close();
      });
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
