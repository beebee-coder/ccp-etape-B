"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Video, MicOff, AlertTriangle, ScanEye, Eye } from "lucide-react";

interface SensorData {
  camera: {
    active: boolean;
    resolution: string;
    fps: number;
    motionDetected: boolean;
  };
  microphone: {
    active: boolean;
    level: number;
    noiseDetected: boolean;
  };
  temperature: {
    active: boolean;
    current: number;
    min: number;
    max: number;
    unit: "C" | "F";
    alert: boolean;
  };
}

interface SensorReadingsProps {
  deviceName: string;
  initialData?: SensorData;
}

function useSensorSimulation(initialData: SensorData) {
  const [data, setData] = useState<SensorData>(initialData);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => ({
        camera: {
          ...prev.camera,
          motionDetected: Math.random() > 0.85,
        },
        microphone: {
          ...prev.microphone,
          level: Math.max(0, Math.min(100, prev.microphone.level + (Math.random() - 0.5) * 20)),
          noiseDetected: Math.random() > 0.9,
        },
        temperature: {
          ...prev.temperature,
          current: Math.round((prev.temperature.current + (Math.random() - 0.5) * 0.5) * 10) / 10,
          alert: Math.random() > 0.95,
        },
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return data;
}

export function SensorReadings({ deviceName, initialData }: SensorReadingsProps) {
  const defaultData: SensorData = {
    camera: { active: true, resolution: "1920x1080", fps: 30, motionDetected: false },
    microphone: { active: true, level: 45, noiseDetected: false },
    temperature: { active: true, current: 22.5, min: 18, max: 35, unit: "C", alert: false },
  };

  const sensorData = useSensorSimulation(initialData ?? defaultData);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <ScanEye className="h-4 w-4 text-primary" />
            </div>
            Capteurs — {deviceName}
          </h3>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative rounded-xl border border-border/50 bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30">
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {sensorData.camera.active ? (
                <>
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative inline-flex mb-3">
                        <Eye className="h-10 w-10 text-primary/30" />
                        <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/10 animate-ping opacity-20" />
                      </div>
                      <p className="text-[11px] text-primary/70 font-bold tracking-wider">{sensorData.camera.resolution}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sensorData.camera.fps} fps · 30 ms</p>
                    </div>
                  </div>
                  {sensorData.camera.motionDetected && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/95 backdrop-blur-md shadow-lg shadow-red-500/30 animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-bold text-white tracking-wide">MOUVEMENT</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-white font-mono font-bold tracking-wider">REC</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                    <Video className="h-6 w-6 opacity-40" />
                  </div>
                  <span className="text-[11px] font-medium">Caméra inactive</span>
                </div>
              )}
            </div>
            <div className="p-3.5 border-t border-border/50 bg-gradient-to-r from-blue-500/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[11px] text-muted-foreground font-semibold">Caméra</span>
                </div>
                <Badge variant={sensorData.camera.active ? "default" : "secondary"} className={`text-[9px] font-bold ${
                  sensorData.camera.active ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" : ""
                }`}>
                  {sensorData.camera.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="group relative rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <MicOff className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Microphone</span>
              </div>
              <Badge variant={sensorData.microphone.active ? "default" : "secondary"} className={`text-[9px] font-bold ${
                sensorData.microphone.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : ""
              }`}>
                {sensorData.microphone.active ? "Actif" : "Muet"}
              </Badge>
            </div>
            {sensorData.microphone.active ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-end gap-1 h-12 bg-muted/30 rounded-lg p-2">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = Math.max(4, sensorData.microphone.level * (0.4 + Math.random() * 0.6));
                      const isHigh = h > 70;
                      const isMid = h > 40;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm transition-all duration-300 ${
                            isHigh
                              ? "bg-red-500 shadow-sm shadow-red-500/50"
                              : isMid
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-muted-foreground font-medium">Niveau audio</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold ${
                        sensorData.microphone.level > 70 ? "text-red-500" : sensorData.microphone.level > 40 ? "text-amber-500" : "text-emerald-500"
                      }`}>
                        {Math.round(sensorData.microphone.level)}%
                      </span>
                    </div>
                  </div>
                </div>
                {sensorData.microphone.noiseDetected && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Bruit détecté</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                  <MicOff className="h-6 w-6 opacity-40" />
                </div>
                <span className="text-[11px] font-medium">Microphone inactif</span>
              </div>
            )}
          </div>

          <div className="group relative rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  sensorData.temperature.alert ? "bg-red-500/15" : "bg-violet-500/15"
                }`}>
                  <Thermometer className={`h-4 w-4 ${
                    sensorData.temperature.alert ? "text-red-500" : "text-violet-600 dark:text-violet-400"
                  }`} />
                </div>
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Température</span>
              </div>
              <Badge variant={sensorData.temperature.alert ? "destructive" : "secondary"} className={`text-[9px] font-bold ${
                sensorData.temperature.alert ? "" : "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30"
              }`}>
                {sensorData.temperature.alert ? "Alerte" : "Normal"}
              </Badge>
            </div>
            {sensorData.temperature.active ? (
              <>
                <div className="text-center py-3 relative">
                  <div className="inline-flex items-baseline gap-1">
                    <span
                      className={`text-4xl font-black font-mono tabular-nums tracking-tight transition-colors duration-500 ${
                        sensorData.temperature.alert ? "text-red-500" : "text-foreground"
                      }`}
                    >
                      {sensorData.temperature.current}
                    </span>
                    <span className="text-lg text-muted-foreground font-medium">°{sensorData.temperature.unit}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-muted/40 p-2.5 text-center border border-border/30">
                      <span className="text-[9px] text-muted-foreground block font-medium uppercase tracking-wider">Min</span>
                      <span className="text-sm font-bold text-foreground mt-0.5">{sensorData.temperature.min}°{sensorData.temperature.unit}</span>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-2.5 text-center border border-border/30">
                      <span className="text-[9px] text-muted-foreground block font-medium uppercase tracking-wider">Max</span>
                      <span className="text-sm font-bold text-foreground mt-0.5">{sensorData.temperature.max}°{sensorData.temperature.unit}</span>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-muted/60 overflow-hidden border border-border/30">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        sensorData.temperature.current > 30
                          ? "bg-gradient-to-r from-red-500 to-red-400 shadow-sm shadow-red-500/50"
                          : sensorData.temperature.current > 25
                            ? "bg-gradient-to-r from-amber-500 to-amber-400"
                            : "bg-gradient-to-r from-violet-500 to-violet-400"
                      }`}
                      style={{
                        width: `${Math.min(100, ((sensorData.temperature.current - sensorData.temperature.min) / (sensorData.temperature.max - sensorData.temperature.min)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-muted-foreground/70 font-mono">{sensorData.temperature.min}°</span>
                    <span className="text-[9px] text-muted-foreground/70 font-mono">{sensorData.temperature.max}°</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                  <Thermometer className="h-6 w-6 opacity-40" />
                </div>
                <span className="text-[11px] font-medium">Capteur inactif</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
