import type { DeviceEvent } from "@/lib/embedded/device-service";
import { validateApiRequest } from "@/lib/api/handlers";

type SensorReading = {
  deviceId: string;
  timestamp: number;
  camera: { active: boolean; resolution: string; fps: number; motionDetected: boolean };
  microphone: { active: boolean; level: number; noiseDetected: boolean };
  temperature: { active: boolean; current: number; min: number; max: number; unit: "C" | "F"; alert: boolean };
};

interface Sensors {
  camera: { active: boolean; resolution: string; fps: number; motionDetected: boolean };
  microphone: { active: boolean; level: number; noiseDetected: boolean };
  temperature: { active: boolean; current: number; min: number; max: number; unit: "C" | "F"; alert: boolean };
}

const intervalMs = 2000;

const defaultSensors: Sensors = {
  camera: { active: true, resolution: "1920x1080", fps: 30, motionDetected: false },
  microphone: { active: true, level: 45, noiseDetected: false },
  temperature: { active: true, current: 22.5, min: 18, max: 35, unit: "C", alert: false },
};

function mutateSensors(sensors: Sensors): Sensors {
  return {
    camera: { ...sensors.camera, motionDetected: Math.random() > 0.85 },
    microphone: {
      ...sensors.microphone,
      level: Math.max(0, Math.min(100, sensors.microphone.level + (Math.random() - 0.5) * 20)),
      noiseDetected: Math.random() > 0.9,
    },
    temperature: {
      ...sensors.temperature,
      current: Math.round((sensors.temperature.current + (Math.random() - 0.5) * 0.5) * 10) / 10,
      alert: sensors.temperature.current > 30 || Math.random() > 0.95,
    },
  };
}

function buildSensorReading(deviceId: string, sensors: Sensors): { reading: SensorReading; next: Sensors } {
  const next = mutateSensors(sensors);
  return {
    reading: {
      deviceId,
      timestamp: Date.now(),
      camera: { ...next.camera },
      microphone: { ...next.microphone },
      temperature: { ...next.temperature },
    },
    next,
  };
}

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "embarque-01";

  const encoder = new TextEncoder();

  let sensors: Sensors = { ...defaultSensors };
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: DeviceEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "status", data: { connected: true, rssi: -42 } });
      const initial = buildSensorReading(deviceId, sensors);
      sensors = initial.next;
      send({ type: "sensor", data: initial.reading });

      intervalId = setInterval(() => {
        const sensorResult = buildSensorReading(deviceId, sensors);
        sensors = sensorResult.next;
        const reading = sensorResult.reading;

        send({ type: "sensor", data: reading });

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
