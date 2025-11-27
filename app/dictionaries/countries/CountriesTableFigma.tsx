"use client";

import React from "react";
import { CountriesTable as FigmaCountriesTable, type Country as FigmaCountry } from "@/components/figma/countries-table";

export type CountryRow = {
  id: number;
  created_at: Date | string;
  updated_at: Date | string;
  timezone?: string | null;
  uuid?: string | null;
  name_en: string;
  name_ka?: string | null;
  iso2?: string | null;
  iso3?: string | null;
  un_code?: number | null;
};

// Also support the camelCase shape already returned by /api/countries
type CountryRowCamel = {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  ts?: string;
  countryUuid?: string | null;
  nameEn?: string;
  nameKa?: string | null;
  iso2?: string | null;
  iso3?: string | null;
  unCode?: number | null;
  country?: string | null;
  isActive?: boolean | null;
};

type Props = {
  rows: Array<CountryRow | CountryRowCamel>;
};

export default function CountriesTableFigma({ rows }: Props) {
  // Safe date helpers to avoid "Invalid time value" at runtime
  const toValidDate = (value: Date | string | null | undefined) => {
    if (!value) return null;
    try {
      const d = value instanceof Date ? value : new Date(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const toYMD = (value: Date | string | null | undefined) => {
    const d = toValidDate(value);
    return d ? d.toISOString().slice(0, 10) : "";
  };

  const toISO = (value: Date | string | null | undefined) => {
    const d = toValidDate(value);
    return d ? d.toISOString() : "";
  };

  const mapped: FigmaCountry[] = rows.map((rAny) => {
    const r = rAny as any;
    // If API already returned camelCase, pass through with normalization
    if (typeof r.nameEn !== "undefined" || typeof r.countryUuid !== "undefined") {
      return {
        id: r.id,
        createdAt: r.createdAt ?? "",
        updatedAt: r.updatedAt ?? "",
        ts: r.ts ?? "",
        countryUuid: r.countryUuid ?? "",
        nameEn: r.nameEn ?? "",
        nameKa: r.nameKa ?? "",
        iso2: (r.iso2 ?? "").toUpperCase(),
        iso3: (r.iso3 ?? "").toUpperCase(),
        unCode: typeof r.unCode === "number" ? r.unCode : r.unCode ? Number(r.unCode) || 0 : 0,
        country: r.country ?? (r.nameEn ? r.nameEn + (r.iso2 ? ` - ${String(r.iso2).toUpperCase()}` : "") : ""),
        isActive: typeof r.isActive === "boolean" ? r.isActive : true,
      } as FigmaCountry;
    }

    // Else, map from snake_case
    const rs: CountryRow = rAny as CountryRow;
    return {
      id: rs.id,
      createdAt: toYMD(rs.created_at),
      updatedAt: toYMD(rs.updated_at),
      ts: toISO(rs.created_at),
      countryUuid: rs.uuid ?? "",
      nameEn: rs.name_en,
      nameKa: rs.name_ka ?? "",
      iso2: (rs.iso2 ?? "").toUpperCase(),
      iso3: (rs.iso3 ?? "").toUpperCase(),
      unCode: typeof rs.un_code === "number" ? rs.un_code : rs.un_code ? Number(rs.un_code) || 0 : 0,
      country: rs.name_en + (rs.iso2 ? ` - ${rs.iso2.toUpperCase()}` : ""),
      isActive: true,
    } as FigmaCountry;
  });

  // Add bottom padding so fixed bottom scroller doesn't overlap last rows
  return (
    <div className="pb-8">
      <FigmaCountriesTable data={mapped} />
    </div>
  );
}
