import { NextResponse } from "next/server";
import { ActuatorToggleSchema, type ActuatorToggle } from "@/lib/embedded/schemas";
import { validateApiRequest } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

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

type ActuatorState = {
  id: string;
  name: string;
  type: "relay" | "servo" | "led" | "motor" | "valve";
  state: "idle" | "active" | "error";
  enabled: boolean;
};

const defaultSensors: Sensors = {
  camera: { active: true, resolution: "1920x1080", fps: 30, motionDetected: false },
  microphone: { active: true, level: 45, noiseDetected: false },
  temperature: { active: true, current: 22.5, min: 18, max: 35, unit: "C", alert: false },
};

const defaultActuators: ActuatorState[] = [
  { id: "relay-1", name: "Relais principal", type: "relay", state: "idle", enabled: false },
  { id: "servo-1", name: "Servo d'orientation", type: "servo", state: "idle", enabled: false },
  { id: "led-1", name: "LED indicateur", type: "led", state: "idle", enabled: false },
];

let sensors: Sensors = { ...defaultSensors };
let actuators: ActuatorState[] = defaultActuators.map((a) => ({ ...a }));

function mutateSensors() {
  sensors = {
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

export async function GET(
  request: Request,
  { params }: { params: { deviceId: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  mutateSensors();

  const reading: SensorReading = {
    deviceId: params.deviceId,
    timestamp: Date.now(),
    camera: { ...sensors.camera },
    microphone: { ...sensors.microphone },
    temperature: { ...sensors.temperature },
  };

  return NextResponse.json({
    data: {
      sensors: reading,
      actuators: actuators.map((a) => ({ ...a })),
      connection: { type: "wireless", status: "connected", rssi: -42 },
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { deviceId: string } }
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    schema: ActuatorToggleSchema,
  });
  if (!result.ok) return result.response;

  const { id, state, enabled } = result.ctx.body as ActuatorToggle;
  const actuator = actuators.find((a) => a.id === id);

  if (!actuator) {
    return NextResponse.json({ error: `Actionneur ${id} introuvable` }, { status: 404 });
  }

  actuators = actuators.map((a) =>
    a.id === id ? { ...a, state, enabled } : a
  );

  return NextResponse.json({
    data: {
      deviceId: params.deviceId,
      actuator: actuators.find((a) => a.id === id),
      actuators: actuators.map((a) => ({ ...a })),
    },
  });
}
