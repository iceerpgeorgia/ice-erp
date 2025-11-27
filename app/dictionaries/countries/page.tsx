"use client";

import CountriesTableFigma from "./CountriesTableFigma";
import { useEffect, useState } from "react";

export default function CountriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCountries() {
      setLoading(true);
      try {
        const res = await fetch("/api/countries");
        const data = await res.json();
        setRows(data);
      } catch (err) {
        console.error("Error fetching countries:", err);
        setRows([]);
      }
      setLoading(false);
    }
    fetchCountries();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading countries...</div>
      </div>
    );
  }

  return <CountriesTableFigma rows={rows} />;
}
