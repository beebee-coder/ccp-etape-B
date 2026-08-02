export type ConnectionType = "cable" | "wireless" | "disconnected";
export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface SensorReading {
  deviceId: string;
  timestamp: number;
  camera: { active: boolean; resolution: string; fps: number; motionDetected: boolean };
  microphone: { active: boolean; level: number; noiseDetected: boolean };
  temperature: { active: boolean; current: number; min: number; max: number; unit: "C" | "F"; alert: boolean };
}

export interface ActuatorState {
  id: string;
  name: string;
  type: "relay" | "servo" | "led" | "motor" | "valve";
  state: "idle" | "active" | "error";
  enabled: boolean;
}

export interface DeviceConnectionInfo {
  type: ConnectionType;
  status: ConnectionStatus;
  rssi?: number;
}

export interface DeviceSnapshot {
  sensors: SensorReading;
  actuators: ActuatorState[];
  connection: DeviceConnectionInfo;
}

export type DeviceEvent =
  | { type: "sensor"; data: SensorReading }
  | { type: "actuator"; data: ActuatorState }
  | { type: "alarm"; data: { message: string; severity: "warning" | "danger" | "info"; sensor: string } }
  | { type: "status"; data: { connected: boolean; rssi?: number } };

type EventCallback = (event: DeviceEvent) => void;

export class DeviceService {
  private deviceId: string;
  private eventUrl: string;
  private readingsUrl: string;
  private eventSource: EventSource | null = null;
  private callbacks: Set<EventCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  constructor(deviceId: string, baseUrl = "/api/embedded") {
    this.deviceId = deviceId;
    this.eventUrl = `${baseUrl}/events?deviceId=${encodeURIComponent(deviceId)}`;
    this.readingsUrl = `${baseUrl}/${deviceId}/readings`;
  }

  private connection: DeviceConnectionInfo = { type: "wireless", status: "connected", rssi: -42 };

  onEvent(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  connect() {
    if (this.eventSource) return;
    this.manualClose = false;

    try {
      this.eventSource = new EventSource(this.eventUrl);

      this.eventSource.addEventListener("sensor", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as DeviceEvent;
        this.emit(data);
      });

      this.eventSource.addEventListener("actuator", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as DeviceEvent;
        this.emit(data);
      });

      this.eventSource.addEventListener("alarm", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as DeviceEvent;
        this.emit(data);
      });

      this.eventSource.addEventListener("status", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as DeviceEvent;
        this.emit(data);
      });

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;
        if (!this.manualClose) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async getReadings(): Promise<DeviceSnapshot> {
    const res = await fetch(this.readingsUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch readings: ${res.status}`);
    }
    const json = await res.json();
    return json.data as DeviceSnapshot;
  }

  async toggleActuator(id: string, state: "idle" | "active" | "error", enabled: boolean): Promise<ActuatorState> {
    const res = await fetch(this.readingsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, state, enabled }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Erreur réseau" }));
      throw new Error(error.error || `Failed to toggle actuator: ${res.status}`);
    }

    const json = await res.json();
    return json.data.actuator as ActuatorState;
  }

  private emit(event: DeviceEvent) {
    this.callbacks.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}
