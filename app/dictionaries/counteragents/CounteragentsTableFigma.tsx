"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Counteragent } from "@/components/figma/counteragents-table";

// Dynamically import the heavy table component
const CounteragentsTableDynamic = dynamic(
  () => import("@/components/figma/counteragents-table"),
  { ssr: false }
);

// Safe date formatting helpers
function toValidDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISO(d: Date | null): string {
  return d ? d.toISOString() : "";
}

export default function CounteragentsTableFigma() {
  const [counteragents, setCounteragents] = useState<Counteragent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounteragents() {
      try {
        const res = await fetch("/api/counteragents");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        const mapped = data.map((row: any) => ({
          id: row.id || row.ID,
          createdAt: toISO(toValidDate(row.created_at || row.createdAt)),
          updatedAt: toISO(toValidDate(row.updated_at || row.updatedAt)),
          ts: toYMD(toValidDate(row.ts || row.TS)),
          counteragentUuid: row.counteragent_uuid || row.counteragentUuid || "",
          name: row.name || row.NAME || "",
          identificationNumber: row.identification_number || row.identificationNumber || null,
          birthOrIncorporationDate: row.birth_or_incorporation_date || row.birthOrIncorporationDate || null,
          entityType: row.entity_type || row.entityType || null,
          sex: row.sex || row.SEX || null,
          pensionScheme: row.pension_scheme || row.pensionScheme || null,
          country: row.country || row.COUNTRY || null,
          addressLine1: row.address_line_1 || row.addressLine1 || null,
          addressLine2: row.address_line_2 || row.addressLine2 || null,
          zipCode: row.zip_code || row.zipCode || null,
          iban: row.iban || row.IBAN || null,
          swift: row.swift || row.SWIFT || null,
          director: row.director || row.DIRECTOR || null,
          directorId: row.director_id || row.directorId || null,
          email: row.email || row.EMAIL || null,
          phone: row.phone || row.PHONE || null,
          orisId: row.oris_id || row.orisId || null,
          counteragent: row.counteragent || row.COUNTERAGENT || null,
          countryUuid: row.country_uuid || row.countryUuid || null,
          entityTypeUuid: row.entity_type_uuid || row.entityTypeUuid || null,
          internalNumber: row.internal_number || row.internalNumber || null,
          isActive: row.is_active ?? row.isActive ?? true,
          isEmploye: row.is_emploee ?? row.isEmploye ?? null,
          wasEmploye: row.was_emploee ?? row.wasEmploye ?? null,
        }));

        setCounteragents(mapped);
      } catch (err) {
        console.error("[CounteragentsTableFigma] Load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCounteragents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading counteragents...</p>
      </div>
    );
  }

  return <CounteragentsTableDynamic data={counteragents} />;
}
