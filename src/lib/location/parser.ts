import type { LocationRef, LocationType } from "./types";
export type { LocationRef } from "./types";
import { LOCATION_REGISTRY } from "./registry";

const BLOC_CODES = ["A0", "B0", "B1", "B2", "B3"] as const;
const BLOC_PATTERN = new RegExp(`\\b(${BLOC_CODES.join("|")})\\b`, "i");

function toUpperCase<T extends string>(value: T): Uppercase<T> {
  return value.toUpperCase() as Uppercase<T>;
}

export function parseLocationFromFileName(fileName: string): LocationRef {
  const base = fileName.replace(/\.\w+$/, "");
  const parts = base.split(/[_\-\/\\]+/).filter(Boolean);

  const first = parts[0]?.toLowerCase();
  let locationType: LocationType = "global";
  let pathParts: string[] = [];

  if (first === "centrale") {
    locationType = "centrale";
    pathParts = parts.slice(1);
  } else if (first === "groupe") {
    locationType = "groupe";
    pathParts = parts.slice(1);
  } else if (first === "qr" || first === "alarm" || first === "media") {
    const candidate = parts.slice(1).join("_");
    if (isCentralePath(candidate)) {
      locationType = "centrale";
      pathParts = candidate.split("_");
    } else if (isGroupePath(candidate)) {
      locationType = "groupe";
      pathParts = candidate.split("_");
    } else {
      pathParts = parts;
    }
  } else {
    pathParts = parts;
  }

  const alarmMatch = pathParts[pathParts.length - 1]?.match(/^B[0-3][A-Z0-9]+[A-Z]{2}[0-9]{3}$/i);
  const alarmCode = alarmMatch ? toUpperCase(alarmMatch[0]) : undefined;

  const blocMatch = pathParts.find((p) => BLOC_CODES.some((b) => p.toUpperCase() === b));
  const blocCode = blocMatch ? toUpperCase(blocMatch) : undefined;

  const equipCandidates = pathParts.filter((p) => !BLOC_CODES.some((b) => p.toUpperCase() === b) && p !== alarmCode);
  const equipementCode = equipCandidates.length > 0 ? toUpperCase(equipCandidates[0]) : undefined;

  const groupePath = locationType === "groupe" ? pathParts.join("/") : undefined;

  const locationPath =
    locationType === "centrale" && blocCode && equipementCode
      ? `${blocCode}/${equipementCode}`
      : locationType === "groupe" && groupePath
        ? groupePath
        : undefined;

  return {
    locationType,
    blocCode,
    equipementCode,
    groupePath,
    locationPath,
    alarmCode,
  };
}

function isCentralePath(candidate: string): boolean {
  const upper = candidate.toUpperCase();
  return BLOC_CODES.some((b) => upper.startsWith(b + "_") || upper.startsWith(b + "/"));
}

function isGroupePath(candidate: string): boolean {
  const knownGroupes = Object.keys(LOCATION_REGISTRY.Groupes);
  const upper = candidate.toUpperCase();
  return knownGroupes.some((g) => upper.startsWith(g.toUpperCase() + "_") || upper.startsWith(g.toUpperCase() + "/"));
}

export function parseLocationFromHeader(header: {
  type?: string;
  path?: string;
  bloc?: string;
  equipement?: string;
}): LocationRef {
  const locationType = (header.type as LocationType) || "global";
  const blocCode = header.bloc ? toUpperCase(header.bloc) : undefined;
  const equipementCode = header.equipement ? toUpperCase(header.equipement) : undefined;

  let locationPath: string | undefined;
  if (locationType === "centrale" && blocCode && equipementCode) {
    locationPath = `${blocCode}/${equipementCode}`;
  } else if (locationType === "groupe" && header.path) {
    locationPath = header.path;
  } else if (header.path) {
    locationPath = header.path;
  }

  const alarmMatch = header.path?.match(/B[0-3][A-Z0-9]+[A-Z]{2}[0-9]{3}$/i);
  const alarmCode = alarmMatch ? toUpperCase(alarmMatch[0]) : undefined;

  return {
    locationType,
    blocCode,
    equipementCode,
    locationPath,
    alarmCode,
  };
}

export function extractLocationFromQuery(query: string): LocationRef[] {
  const locations: LocationRef[] = [];
  const seen = new Set<string>();

  const blocMatches = query.match(BLOC_PATTERN);
  if (blocMatches) {
    for (const match of blocMatches) {
      const blocCode = toUpperCase(match);
      const alarmMatch = query.match(new RegExp(`B[0-3][A-Z0-9]+[A-Z]{2}[0-9]{3}`, "i"));
      if (alarmMatch) {
        const code = toUpperCase(alarmMatch[0]);
        const key = `alarm:${code}`;
        if (!seen.has(key)) {
          seen.add(key);
          const equip = code.slice(2, -3);
          locations.push({
            locationType: "centrale",
            blocCode,
            equipementCode: toUpperCase(equip),
            locationPath: `${blocCode}/${toUpperCase(equip)}`,
            alarmCode: code,
          });
        }
      } else {
        const equipMatch = query.match(/\b([A-Z]{2,}[0-9]*)\b/i);
        if (equipMatch && !BLOC_CODES.some((b) => equipMatch[1].toUpperCase() === b)) {
          const equip = toUpperCase(equipMatch[1]);
          const key = `centrale:${blocCode}/${equip}`;
          if (!seen.has(key)) {
            seen.add(key);
            locations.push({
              locationType: "centrale",
              blocCode,
              equipementCode: equip,
              locationPath: `${blocCode}/${equip}`,
            });
          }
        }
      }
    }
  }

  for (const [groupeName] of Object.entries(LOCATION_REGISTRY.Groupes)) {
    const slug = groupeName.toLowerCase();
    if (query.toLowerCase().includes(slug)) {
      const key = `groupe:${groupeName}`;
      if (!seen.has(key)) {
        seen.add(key);
        locations.push({
          locationType: "groupe",
          groupePath: groupeName,
          locationPath: groupeName,
        });
      }
    }
  }

  if (locations.length === 0) {
    locations.push({ locationType: "global" });
  }

  return locations;
}

export function formatLocation(loc: LocationRef): string {
  const parts: string[] = [];
  if (loc.blocCode) parts.push(`Bloc ${loc.blocCode}`);
  if (loc.equipementCode) parts.push(`Équipement ${loc.equipementCode}`);
  if (loc.groupePath) parts.push(`Groupe ${loc.groupePath}`);
  if (loc.alarmCode) parts.push(`Alarme ${loc.alarmCode}`);
  return parts.join(" / ") || "Centrale";
}

export function getLocationFilterClause(loc: LocationRef, prefix = "metadata_json"): string {
  const clauses: string[] = [];
  if (loc.blocCode) {
    clauses.push(`${prefix}->>'bloc_code' = '${loc.blocCode}'`);
  }
  if (loc.equipementCode) {
    clauses.push(`${prefix}->>'equipement_code' = '${loc.equipementCode}'`);
  }
  if (loc.groupePath) {
    clauses.push(`${prefix}->>'groupe_path' LIKE '${loc.groupePath}%'`);
  }
  if (loc.locationPath) {
    clauses.push(`${prefix}->>'location_path' LIKE '${loc.locationPath}%'`);
  }
  if (loc.alarmCode) {
    clauses.push(`${prefix}->>'alarm_code' = '${loc.alarmCode}'`);
  }
  return clauses.join(" AND ");
}
