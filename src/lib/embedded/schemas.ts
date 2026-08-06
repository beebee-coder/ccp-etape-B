import { z } from "zod";

export const ActuatorToggleSchema = z.object({
  id: z.string().min(1),
  state: z.enum(["idle", "active", "error"]),
  enabled: z.boolean().default(false),
});

export type ActuatorToggle = z.infer<typeof ActuatorToggleSchema>;

export const SensorCameraSchema = z.object({
  active: z.boolean().default(true),
  resolution: z.string(),
  fps: z.number().int().positive(),
  motionDetected: z.boolean().default(false),
});

export const SensorMicrophoneSchema = z.object({
  active: z.boolean().default(true),
  level: z.number().min(0).max(100),
  noiseDetected: z.boolean().default(false),
});

export const SensorTemperatureSchema = z.object({
  active: z.boolean().default(true),
  current: z.number(),
  min: z.number(),
  max: z.number(),
  unit: z.enum(["C", "F"]).default("C"),
  alert: z.boolean().default(false),
});

export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.number().int().positive(),
  camera: SensorCameraSchema,
  microphone: SensorMicrophoneSchema,
  temperature: SensorTemperatureSchema,
});

export type SensorReading = z.infer<typeof SensorReadingSchema>;

export const ActuatorStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["relay", "servo", "led", "motor", "valve"]),
  state: z.enum(["idle", "active", "error"]),
  enabled: z.boolean(),
});

export type ActuatorState = z.infer<typeof ActuatorStateSchema>;

export const DeviceConnectionInfoSchema = z.object({
  type: z.enum(["cable", "wireless", "disconnected"]),
  status: z.enum(["connected", "connecting", "disconnected"]),
  rssi: z.number().optional(),
});

export type DeviceConnectionInfo = z.infer<typeof DeviceConnectionInfoSchema>;

export const ConnectionTypeSchema = z.enum([
  "cable",
  "wireless",
  "disconnected",
]);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

export const ConnectionStatusSchema = z.enum([
  "connected",
  "connecting",
  "disconnected",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
