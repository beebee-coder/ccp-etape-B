import type { LocationRef } from "./types";
import centraleData from "../../../doc/centrale.json";
import groupesData from "../../../doc/Groupes.json";

export interface CentraleNode {
  libelle: string;
  descendants: Array<{ nom: string; libelle: string }>;
}

export interface GroupeNode {
  descendants: Array<{ nom: string; libelle: string }>;
}

export interface LocationRegistry {
  Centrale: Record<string, CentraleNode>;
  Groupes: Record<string, GroupeNode>;
}

export const LOCATION_REGISTRY: LocationRegistry = {
  Centrale: (centraleData as { Centrale: Record<string, CentraleNode> }).Centrale,
  Groupes: (groupesData as { Groupes: Record<string, GroupeNode> }).Groupes,
};

export function getBlocLibelle(blocCode: string): string | undefined {
  return LOCATION_REGISTRY.Centrale[blocCode]?.libelle;
}

export function getEquipementLibelle(blocCode: string, equipCode: string): string | undefined {
  const bloc = LOCATION_REGISTRY.Centrale[blocCode];
  if (!bloc) return undefined;
  return bloc.descendants.find((d) => d.nom === equipCode)?.libelle;
}

export function getGroupeLibelle(groupeName: string): string | undefined {
  return LOCATION_REGISTRY.Groupes[groupeName]
    ? LOCATION_REGISTRY.Groupes[groupeName].descendants[0]?.libelle || groupeName
    : undefined;
}

export function resolveLocation(loc: LocationRef): { libelle: string; path: string } | null {
  if (loc.locationType === "centrale" && loc.blocCode && loc.equipementCode) {
    const blocLibelle = getBlocLibelle(loc.blocCode);
    const equipLibelle = getEquipementLibelle(loc.blocCode, loc.equipementCode);
    return {
      libelle: [blocLibelle, equipLibelle].filter(Boolean).join(" > ") || loc.locationPath || "Inconnu",
      path: loc.locationPath || `${loc.blocCode}/${loc.equipementCode}`,
    };
  }
  if (loc.locationType === "groupe" && loc.groupePath) {
    const groupeLibelle = getGroupeLibelle(loc.groupePath);
    return {
      libelle: groupeLibelle || loc.groupePath,
      path: loc.groupePath,
    };
  }
  if (loc.locationType === "global") {
    return { libelle: "Global", path: "global" };
  }
  return null;
}

export function getAllBlocCodes(): string[] {
  return Object.keys(LOCATION_REGISTRY.Centrale);
}

export function getAllEquipementCodes(blocCode: string): string[] {
  return LOCATION_REGISTRY.Centrale[blocCode]?.descendants.map((d) => d.nom) || [];
}

export function getAllGroupeNames(): string[] {
  return Object.keys(LOCATION_REGISTRY.Groupes);
}

export function getAllVueCodes(groupeName: string): string[] {
  return LOCATION_REGISTRY.Groupes[groupeName]?.descendants.map((d) => d.nom) || [];
}
