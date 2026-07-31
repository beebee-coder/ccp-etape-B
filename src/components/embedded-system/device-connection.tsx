"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cable, Wifi, Power, RotateCcw, WifiOff, Signal } from "lucide-react";

type ConnectionType = "cable" | "wireless" | "disconnected";
type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface DeviceConnectionProps {
  deviceName: string;
  initialType?: ConnectionType;
  initialStatus?: ConnectionStatus;
}

export function DeviceConnection({
  deviceName,
  initialType = "wireless",
  initialStatus = "connected",
}: DeviceConnectionProps) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialType);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(initialStatus);

  const handleConnect = () => {
    if (connectionType === "disconnected") return;
    setConnectionStatus("connecting");
    setTimeout(() => setConnectionStatus("connected"), 1500);
  };

  const handleDisconnect = () => setConnectionStatus("disconnected");

  const handleCycleConnection = () => {
    setConnectionType((prev) =>
      prev === "cable" ? "wireless" : prev === "wireless" ? "cable" : "wireless"
    );
    setConnectionStatus("disconnected");
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <Card className="relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20 transition-colors duration-700 pointer-events-none"
        style={{ background: isConnected ? "rgba(16, 185, 129, 0.3)" : isConnecting ? "rgba(245, 158, 11, 0.3)" : "rgba(156, 163, 175, 0.2)" }}
      />
      <CardContent className="relative p-5 space-y-5 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`h-4 w-4 rounded-full transition-all duration-500 ${
                  isConnected
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                    : isConnecting
                      ? "bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                      : "bg-muted-foreground/50"
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 h-4 w-4 rounded-full bg-emerald-500 animate-ping opacity-30" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{deviceName}</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {isConnected ? "Connexion établie" : isConnecting ? "Établissement de la connexion..." : "Déconnecté"}
              </p>
            </div>
          </div>
          <Badge
            variant={isConnected ? "default" : isConnecting ? "secondary" : "outline"}
            className={`text-[10px] font-semibold ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : isConnecting
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isConnected ? "Connecté" : isConnecting ? "Connexion..." : "Déconnecté"}
          </Badge>
        </div>

        {connectionType !== "disconnected" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="flex items-center gap-2.5">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  connectionType === "cable" ? "bg-blue-500/15 text-blue-600" : "bg-violet-500/15 text-violet-600"
                }`}>
                  {connectionType === "cable" ? (
                    <Cable className="h-4 w-4" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {connectionType === "cable" ? "USB / Ethernet" : "Wi-Fi / Bluetooth"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {connectionType === "wireless" ? "RSSI: -42 dBm" : "Débit: 1 Gbps"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Signal className="h-3.5 w-3.5 text-emerald-500" />
                <div className="flex gap-0.5">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`w-1 rounded-full ${
                      connectionType === "wireless" && i <= 3
                        ? "h-3 bg-emerald-500"
                        : connectionType === "cable"
                          ? "h-4 bg-blue-500"
                          : "h-2 bg-muted-foreground/30"
                    }`} />
                  ))}
                </div>
              </div>
            </div>

            {connectionType === "wireless" && (
              <div className="px-3 py-2 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Qualité du signal</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold">-42 dBm</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">Excellent</span>
                  <span className="text-[9px] text-muted-foreground">Faible</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2">
          {!isConnected ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting || connectionType === "disconnected"}
              className="flex-1 text-xs gap-1.5 h-9 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
            >
              {isConnecting ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Power className="h-3.5 w-3.5" />
                  Connecter
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="flex-1 text-xs gap-1.5 h-9 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700"
            >
              <WifiOff className="h-3.5 w-3.5" />
              Déconnecter
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCycleConnection}
            className="text-xs h-9 w-9 p-0 hover:bg-muted"
            title="Changer type de connexion"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
