"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeviceConnection } from "./device-connection";
import { SensorReadings } from "./sensor-readings";
import { ActuatorControl } from "./actuator-control";
import { VoiceOutput } from "./voice-output";
import { Cpu, Cable, Activity, Gauge, Radio, Zap, Server, Signal, Wifi } from "lucide-react";

interface EmbeddedSystemPanelProps {
  deviceName?: string;
}

export function EmbeddedSystemPanel({ deviceName = "Embarqué #01" }: EmbeddedSystemPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden relative m-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        <CardHeader className="pt-5 pb-5 relative px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Système embarqué
                  <Badge variant="outline" className="text-[10px] font-normal border-primary/20 text-primary/80">
                    <Server className="h-3 w-3 mr-1" />
                    IoT
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5 font-medium">{deviceName}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">En ligne</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">|</span>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Wifi className="h-3 w-3" />
                    <span>Wi-Fi · RSSI -42 dBm</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">|</span>
                  <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Signal className="h-3 w-3" />
                    <span>Qualité excellente</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                <Activity className="h-3 w-3 mr-1" />
                3 capteurs actifs
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
                <Radio className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative p-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="group relative rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 p-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Cable className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Connexion</span>
              </div>
              <p className="text-sm font-bold text-foreground">Sans fil</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Wi-Fi 6 · Stable</p>
              <div className="mt-2 h-1 rounded-full bg-blue-500/10 overflow-hidden">
                <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" />
              </div>
            </div>
            <div className="group relative rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Capteurs</span>
              </div>
              <p className="text-sm font-bold text-foreground">3 actifs</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Caméra · Micro · Temp</p>
              <div className="mt-2 flex gap-0.5">
                {[1,2,3].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full bg-emerald-500/20 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="group relative rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Actionneurs</span>
              </div>
              <p className="text-sm font-bold text-foreground">0 actif(s)</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">3 disponibles</p>
              <div className="mt-2 flex gap-1">
                {[1,2,3].map(i => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-amber-500/30" />
                ))}
              </div>
            </div>
            <div className="group relative rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 p-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Voix</span>
              </div>
              <p className="text-sm font-bold text-foreground">Prêt</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Synthèse vocale active</p>
              <div className="mt-2 flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-2 w-0.5 rounded-full bg-violet-500/40 animate-pulse" style={{ animationDelay: `${i * 100}ms`, height: `${8 + i * 2}px` }} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-5 py-5">
        <Card className="lg:col-span-4 lg:row-span-2 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <DeviceConnection deviceName={deviceName} initialType="wireless" initialStatus="connected" />
        </Card>

        <Card className="lg:col-span-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <SensorReadings deviceName={deviceName} />
        </Card>

        <Card className="lg:col-span-4 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <ActuatorControl deviceName={deviceName} />
        </Card>

        <Card className="lg:col-span-4 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <VoiceOutput deviceName={deviceName} />
        </Card>
      </div>
    </div>
  );
}