"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Project } from "@/components/figma/projects-table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Helper function to map API response (snake_case) to Project interface (camelCase)
const mapProjectData = (row: any): Project => {
  return {
    id: row.id || 0,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    projectUuid: row.project_uuid || row.projectUuid || '',
    projectName: row.project_name || row.projectName || '',
    date: row.date || '', // Already formatted as dd.mm.yyyy by API
    value: row.value || 0,
    totalPayments: row.total_payments ?? row.totalPayments ?? null,
    balance: row.balance ?? null,
    oris1630: row.oris_1630 || row.oris1630 || null,
    counteragentUuid: row.counteragent_uuid || row.counteragentUuid || '',
    financialCodeUuid: row.financial_code_uuid || row.financialCodeUuid || '',
    currencyUuid: row.currency_uuid || row.currencyUuid || '',
    stateUuid: row.state_uuid || row.stateUuid || '',
    counteragent: row.counteragent || null,
    financialCode: row.financial_code || row.financialCode || null,
    currency: row.currency || null,
    state: row.state || null,
    contractNo: row.contract_no || row.contractNo || null,
    projectIndex: row.project_index || row.projectIndex || null,
    employees: row.employees || []
  };
};

// Dynamically import the heavy table component
const ProjectsTableDynamic = dynamic(
  () => import("@/components/figma/projects-table").then(mod => ({ default: mod.ProjectsTable })),
  { ssr: false }
);

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects-v2", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // Map snake_case API response to camelCase Project interface
      const mapped = data.map(mapProjectData);
      setProjects(mapped);
    } catch (err) {
      console.error("[ProjectsPage] Load error:", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadProjects();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadProjects]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProjects();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <ProjectsTableDynamic data={projects} />
    </div>
  );
}
