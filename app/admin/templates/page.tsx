'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Template {
  uuid: string;
  operation_type: string;
  file_name: string;
  file_size_bytes: number | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  created_by_user_id: string | null;
}

const OPERATIONS = ['handover', 'invoice', 'certificate'];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string>('handover');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shouldActivate, setShouldActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedOperation) {
      setError('Please select a file and operation type');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('operationType', selectedOperation);
      formData.append('file', selectedFile);
      formData.append('activate', shouldActivate.toString());

      const res = await fetch('/api/templates', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(`Template uploaded successfully for ${selectedOperation}`);
      setSelectedFile(null);
      await loadTemplates();
      
      // Reset form
      setTimeout(() => {
        setSelectedFile(null);
        setShouldActivate(true);
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (uuid: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/templates/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to activate');
      }

      setSuccess('Template activated');
      await loadTemplates();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleArchive = async (uuid: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/templates/${uuid}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to archive');
      }

      setSuccess('Template archived');
      await loadTemplates();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getActiveTemplate = (operationType: string) => {
    return templates.find(
      t => t.operation_type === operationType && t.is_active
    );
  };

  const getTemplatesForOperation = (operationType: string) => {
    return templates.filter(t => t.operation_type === operationType);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const kb = bytes / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Templates Management</h1>
        <p className="text-gray-600 mt-2">
          Upload and manage templates for different operations. Each operation must have exactly
          one active template.
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Upload New Template</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Operation Type *</label>
              <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map(op => (
                    <SelectItem key={op} value={op}>
                      {op.charAt(0).toUpperCase() + op.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Template File *</label>
              <Input
                type="file"
                accept=".xlsx"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shouldActivate}
                  onChange={e => setShouldActivate(e.target.checked)}
                  disabled={uploading}
                />
                <span className="text-sm">Set as active</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <Button type="submit" disabled={uploading || !selectedFile}>
            {uploading ? 'Uploading...' : 'Upload Template'}
          </Button>
        </form>
      </div>

      {/* Templates by Operation */}
      {loading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : (
        <div className="space-y-6">
          {OPERATIONS.map(operation => {
            const active = getActiveTemplate(operation);
            const allForOperation = getTemplatesForOperation(operation);

            return (
              <div key={operation} className="bg-white border rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold capitalize">
                    {operation} Templates
                  </h3>
                  {active ? (
                    <p className="text-sm text-gray-600 mt-1">
                      Active:{' '}
                      <span className="font-medium text-green-700">{active.file_name}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠ No active template! Please upload and activate one.
                    </p>
                  )}
                </div>

                {allForOperation.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No templates uploaded yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>File Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allForOperation.map(template => (
                        <TableRow key={template.uuid}>
                          <TableCell className="font-medium">
                            {template.file_name}
                          </TableCell>
                          <TableCell>{formatFileSize(template.file_size_bytes)}</TableCell>
                          <TableCell>
                            {template.is_active ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : template.archived_at ? (
                              <Badge className="bg-gray-100 text-gray-800">Archived</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(template.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!template.is_active && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleActivate(template.uuid)}
                                >
                                  Activate
                                </Button>
                              )}
                              {!template.archived_at && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        'Are you sure you want to archive this template?'
                                      )
                                    ) {
                                      handleArchive(template.uuid);
                                    }
                                  }}
                                >
                                  Archive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
