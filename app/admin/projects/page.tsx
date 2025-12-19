"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Project } from "@/components/figma/projects-table";

// Dynamically import the heavy table component
const ProjectsTableDynamic = dynamic(
  () => import("@/components/figma/projects-table").then(mod => ({ default: mod.ProjectsTable })),
  { ssr: false }
);

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error("[ProjectsPage] Load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <ProjectsTableDynamic data={projects} />
    </div>
  );
}
