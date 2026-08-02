"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Power, Activity, AlertTriangle, Loader2, Settings2 } from "lucide-react";
import { DeviceService } from "@/lib/embedded/device-service";

interface ActuatorConfig {
  id: string;
  name: string;
  type: "relay" | "servo" | "led" | "motor" | "valve";
  icon: React.ReactNode;
  enabled: boolean;
  state: "idle" | "active" | "error";
  description: string;
}

interface ActuatorControlProps {
  deviceName: string;
  actuators?: ActuatorConfig[];
}

const defaultActuators: ActuatorConfig[] = [
  {
    id: "relay-1",
    name: "Relais principal",
    type: "relay",
    icon: <Power className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Contrôle d'alimentation principale",
  },
  {
    id: "servo-1",
    name: "Servo d'orientation",
    type: "servo",
    icon: <Activity className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Orientation du capteur",
  },
  {
    id: "led-1",
    name: "LED indicateur",
    type: "led",
    icon: <AlertTriangle className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Signal lumineux d'alerte",
  },
];

export function ActuatorControl({ deviceName, actuators: initialActuators }: ActuatorControlProps) {
  const [actuators, setActuators] = useState<ActuatorConfig[]>(initialActuators ?? defaultActuators);
  const [activating, setActivating] = useState<string | null>(null);

  const handleToggle = async (id: string) => {
    const actuator = actuators.find((a) => a.id === id);
    if (!actuator) return;

    const newState = actuator.state === "active" ? "idle" : "active";
    const newEnabled = newState === "active";

    setActivating(id);

    try {
      const service = new DeviceService("embarque-01");
      const updated = await service.toggleActuator(id, newState, newEnabled);
      setActuators((prev) =>
        prev.map((a) => (a.id === id ? { ...a, state: updated.state, enabled: updated.enabled } : a))
      );
    } catch {
      setActuators((prev) =>
        prev.map((a) => (a.id === id ? { ...a, state: "error", enabled: false } : a))
      );
    } finally {
      setActivating(null);
    }
  };

  const activeCount = actuators.filter((a) => a.state === "active").length;

  return (
    <Card className="h-full">
      <CardContent className="p-5 space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            Actionneurs — {deviceName}
          </h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/50">
            <span className="text-[10px] text-muted-foreground font-medium">
              {activeCount} actif{activeCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {actuators.map((actuator) => (
            <div
              key={actuator.id}
              className={`relative rounded-xl border p-4 transition-all duration-300 flex flex-col ${
                actuator.state === "active"
                  ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
                  : actuator.state === "error"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-card hover:border-primary/20 hover:shadow-md"
              }`}
            >
              {activating === actuator.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm z-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                    actuator.state === "active"
                      ? "bg-primary/15 text-primary shadow-sm shadow-primary/20"
                      : actuator.state === "error"
                        ? "bg-red-500/15 text-red-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {actuator.icon}
                </div>
                <Switch
                  checked={actuator.state === "active"}
                  onCheckedChange={() => handleToggle(actuator.id)}
                  disabled={activating !== null}
                  aria-label={`Toggle ${actuator.name}`}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>

              <div className="space-y-2 flex-1">
                <p className="text-xs font-bold text-foreground">{actuator.name}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{actuator.description}</p>
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground font-bold uppercase tracking-wider">
                    {actuator.type}
                  </span>
                  <span
                    className={`text-[9px] font-bold flex items-center gap-1 ${
                      actuator.state === "active"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : actuator.state === "error"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      actuator.state === "active"
                        ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                        : actuator.state === "error"
                          ? "bg-red-500"
                          : "bg-muted-foreground"
                    }`} />
                    {actuator.state === "active" ? "Actif" : actuator.state === "error" ? "Erreur" : "Inactif"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}