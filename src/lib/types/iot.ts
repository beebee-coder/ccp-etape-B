export type {
  ConnectionType,
  ConnectionStatus,
  SensorReading,
  ActuatorState,
  DeviceConnectionInfo,
  DeviceSnapshot,
  DeviceEvent,
} from "@/lib/embedded/device-service";

export {
  ActuatorToggleSchema,
  SensorCameraSchema,
  SensorMicrophoneSchema,
  SensorTemperatureSchema,
  SensorReadingSchema,
  ActuatorStateSchema,
  DeviceConnectionInfoSchema,
  ConnectionTypeSchema,
  ConnectionStatusSchema,
  type ActuatorToggle,
} from "@/lib/embedded/schemas";
