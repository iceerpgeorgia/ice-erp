'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { JobAttachments } from './job-attachments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import type { Job } from './jobs-table';

type SortDirection = 'asc' | 'desc';
type ColumnKey = keyof Job;

type Column = {
  key: ColumnKey;
  label: string;
  width: number;
  sortable: boolean;
};

const COLUMNS: Column[] = [
  { key: 'jobName', label: 'Job Name', width: 160, sortable: true },
  { key: 'factoryNo', label: 'Factory No', width: 140, sortable: true },
  { key: 'brandName', label: 'Brand', width: 130, sortable: true },
  { key: 'floors', label: 'Floors', width: 90, sortable: true },
  { key: 'weight', label: 'Weight (kg)', width: 110, sortable: true },
  { key: 'sellingPrice', label: 'Selling Price', width: 130, sortable: true },
  { key: 'isFf', label: 'FF', width: 80, sortable: true },
];

type Project = { projectUuid: string; projectIndex: string; projectName: string };

export function HandoversTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('jobName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch projects once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/projects-v2');
        if (res.ok) {
          const data = await res.json();
          setProjects(
            data.map((p: any) => ({
              projectUuid: p.project_uuid,
              projectIndex: p.project_index,
              projectName: p.project_name,
            })),
          );
        }
      } catch (e) {
        console.error('Failed to fetch projects:', e);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  // Fetch jobs whenever the selected project changes
  useEffect(() => {
    if (!selectedProjectUuid) {
      setJobs([]);
      return;
    }
    (async () => {
      setLoadingJobs(true);
      try {
        const res = await fetch(`/api/jobs?projectUuid=${encodeURIComponent(selectedProjectUuid)}`);
        if (res.ok) {
          const data: any[] = await res.json();
          setJobs(
            data.map((job) => ({
              id: 0,
              jobUuid: job.jobUuid ?? job.job_uuid ?? '',
              jobName: job.jobName ?? job.job_name ?? '',
              factoryNo: job.factoryNo ?? job.factory_no ?? null,
              floors: job.floors ?? null,
              weight: job.weight ?? null,
              sellingPrice:
                job.sellingPrice !== undefined && job.sellingPrice !== null
                  ? Number(job.sellingPrice)
                  : null,
              isFf: job.isFf ?? job.is_ff ?? false,
              brandUuid: job.brandUuid ?? job.brand_uuid ?? null,
              brandName: job.brandName ?? job.brand_name ?? '',
              jobIndex: job.jobDisplay ?? '',
              projectUuid: selectedProjectUuid,
              projectIndex: '',
              projectName: '',
              bindingCount: 1,
              isActive: true,
              createdAt: '',
              updatedAt: '',
              _rowKey: job.jobUuid ?? job.job_uuid ?? '',
            })),
          );
        }
      } catch (e) {
        console.error('Failed to fetch jobs for project:', e);
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, [selectedProjectUuid]);

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: p.projectUuid,
        label: `${p.projectIndex} — ${p.projectName}`,
        keywords: `${p.projectIndex} ${p.projectName}`,
      })),
    [projects],
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.projectUuid === selectedProjectUuid) ?? null,
    [projects, selectedProjectUuid],
  );

  const handleSort = (col: ColumnKey) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const filteredSorted = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = jobs;
    if (term) {
      rows = rows.filter((j) =>
        [j.jobName, j.factoryNo, j.brandName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortColumn] ?? '';
      const bv = b[sortColumn] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [jobs, searchTerm, sortColumn, sortDirection]);

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Handovers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a project to view and manage its jobs for handover.
        </p>
      </div>

      {/* Project selector */}
      <div className="max-w-xl space-y-1">
        <label className="text-sm font-medium">Project</label>
        <Combobox
          options={projectOptions}
          value={selectedProjectUuid}
          onValueChange={setSelectedProjectUuid}
          placeholder={loadingProjects ? 'Loading projects...' : 'Select a project…'}
          searchPlaceholder="Search projects…"
          emptyText="No project found."
        />
      </div>

      {/* Jobs grid */}
      {selectedProjectUuid && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {loadingJobs
                ? 'Loading…'
                : `${filteredSorted.length} job${filteredSorted.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((col) => (
                      <TableHead
                        key={col.key}
                        style={{ width: col.width }}
                        className="bg-muted/50"
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {col.sortable && (
                            <button
                              onClick={() => handleSort(col.key)}
                              className="hover:bg-accent rounded p-1"
                            >
                              {sortColumn === col.key ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                )
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="bg-muted/50 w-24">Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingJobs ? (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length + 1} className="text-center py-8 text-muted-foreground">
                        Loading jobs…
                      </TableCell>
                    </TableRow>
                  ) : filteredSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length + 1} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'No jobs match your search.' : 'No jobs found for this project.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSorted.map((job) => (
                      <TableRow key={job._rowKey}>
                        {COLUMNS.map((col) => (
                          <TableCell key={col.key} style={{ width: col.width }}>
                            {col.key === 'isFf' ? (
                              <Badge variant={job.isFf ? 'default' : 'secondary'}>
                                {job.isFf ? 'FF' : 'NOT FF'}
                              </Badge>
                            ) : col.key === 'floors' ? (
                              <span>{job.floors == null ? '-' : `${job.floors} Floors`}</span>
                            ) : col.key === 'weight' ? (
                              <span>{job.weight == null ? '-' : `${job.weight} kg`}</span>
                            ) : col.key === 'sellingPrice' ? (
                              <span>
                                {job.sellingPrice == null ? '-' : job.sellingPrice.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-sm">
                                {String(job[col.key] ?? '-')}
                              </span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="w-24">
                          <JobAttachments
                            jobUuid={job.jobUuid}
                            jobName={job.jobName}
                            triggerTitle="Job attachments"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
