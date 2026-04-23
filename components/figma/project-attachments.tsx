'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Attachment = {
  linkUuid: string;
  attachmentUuid: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storageBucket: string | null;
  storagePath: string;
  documentTypeUuid: string | null;
  documentDate: string | null;
  documentNo: string | null;
  documentValue: number | null;
  documentCurrencyUuid: string | null;
  isPrimary: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
};

type DocumentType = {
  uuid: string;
  name: string;
  requireDate?: boolean;
  requireValue?: boolean;
  requireCurrency?: boolean;
  requireDocumentNo?: boolean;
  requireProject?: boolean;
};
type Currency = { uuid: string; code: string; name: string };

export type ProjectAttachmentsProps = {
  projectUuid: string;
  projectName?: string | null;
  /** Defer fetching the count until the badge scrolls into view (default true). */
  lazyLoad?: boolean;
  /** Open the dialog automatically on mount (used by the create-project flow). */
  initiallyOpen?: boolean;
  /** Callback when the dialog open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Callback whenever the count changes. */
  onAttachmentsChange?: (count: number) => void;
  /** If true, render only an icon trigger (no count chip). */
  iconOnly?: boolean;
  /** Optional initial count (e.g. from a bulk-counts fetch) to skip the per-row API call. */
  initialCount?: number | null;
  /** Optional className for the trigger button wrapper. */
  className?: string;
  /** Optional title for the trigger button. */
  triggerTitle?: string;
  /** When true, render only the dialog (no trigger button). Pair with `initiallyOpen` and `onOpenChange` for controlled use. */
  hideTrigger?: boolean;
  /** When true, hide the upload form / "Add" button so users cannot create new project attachments from this surface. */
  disableUpload?: boolean;
};

export function ProjectAttachments({
  projectUuid,
  projectName,
  lazyLoad = true,
  initiallyOpen = false,
  onOpenChange,
  onAttachmentsChange,
  iconOnly = false,
  initialCount = null,
  className,
  triggerTitle,
  hideTrigger = false,
  disableUpload = false,
}: ProjectAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [count, setCount] = useState<number>(initialCount ?? 0);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(initiallyOpen);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>('');
  const [documentNo, setDocumentNo] = useState<string>('');
  const [documentValue, setDocumentValue] = useState<string>('');
  const [documentCurrency, setDocumentCurrency] = useState<string>('');
  const [dialogMounted, setDialogMounted] = useState(initiallyOpen);
  const [isMounted, setIsMounted] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync initialCount changes (when bulk-counts arrive)
  useEffect(() => {
    if (initialCount !== null && initialCount !== undefined) {
      setCount(initialCount);
      hasFetchedRef.current = true;
    }
  }, [initialCount]);

  // Lazy-load count via IntersectionObserver
  useEffect(() => {
    if (!lazyLoad) return;
    if (initialCount !== null && initialCount !== undefined) return;
    hasFetchedRef.current = false;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasFetchedRef.current) {
          hasFetchedRef.current = true;
          loadAttachmentCount();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, lazyLoad, initialCount]);

  const loadAttachmentCount = async () => {
    if (!projectUuid) return;
    try {
      const response = await fetch(
        `/api/projects/attachments?projectUuid=${encodeURIComponent(projectUuid)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const data = await response.json();
      const list = data.attachments || [];
      setAttachments(list);
      setCount(list.length);
      onAttachmentsChange?.(list.length);
    } catch (error) {
      console.error('Error loading project attachment count:', error);
    }
  };

  const loadAttachments = async () => {
    if (!projectUuid) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/attachments?projectUuid=${encodeURIComponent(projectUuid)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Failed to load attachments');
      const data = await response.json();
      setAttachments(data.attachments || []);
      setCount((data.attachments || []).length);
      onAttachmentsChange?.((data.attachments || []).length);
    } catch (error) {
      console.error('Error loading project attachments:', error);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/document-types');
      if (!response.ok) throw new Error('Failed to load document types');
      const result = await response.json();
      setDocumentTypes(result.documentTypes || []);
    } catch {
      setDocumentTypes([]);
    }
  };

  const loadCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      if (!response.ok) throw new Error('Failed to load currencies');
      const result = await response.json();
      setCurrencies(result.data || result.currencies || []);
    } catch {
      setCurrencies([]);
    }
  };

  const openDialog = () => {
    setDialogMounted(true);
    setIsDialogOpen(true);
    onOpenChange?.(true);
  };
  const closeDialog = (open: boolean) => {
    setIsDialogOpen(open);
    onOpenChange?.(open);
  };

  useEffect(() => {
    if (isDialogOpen && dialogMounted) {
      loadAttachments();
      loadDocumentTypes();
      loadCurrencies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, dialogMounted]);

  // Honor initiallyOpen prop changes (e.g. when create-project triggers)
  useEffect(() => {
    if (initiallyOpen && !isDialogOpen) {
      openDialog();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectUuid) return;
    if (!selectedDocumentType) { alert('Please select a document type'); return; }

    const activeDocType = documentTypes.find(d => d.uuid === selectedDocumentType);
    if (activeDocType?.requireDate && !documentDate) { alert('Document Date is required for this document type'); return; }
    if (activeDocType?.requireValue && !documentValue) { alert('Value is required for this document type'); return; }
    if (activeDocType?.requireCurrency && !documentCurrency) { alert('Currency is required for this document type'); return; }
    if (activeDocType?.requireDocumentNo && !documentNo) { alert('Document Number is required for this document type'); return; }

    setUploading(true);
    try {
      const uploadUrlResponse = await fetch('/api/projects/attachments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid,
          fileName: selectedFile.name,
          documentTypeUuid: selectedDocumentType,
          documentDate,
          documentNo: documentNo || undefined,
          documentValue: documentValue ? parseFloat(documentValue) : undefined,
          documentCurrencyUuid: documentCurrency || undefined,
        }),
      });
      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get upload URL.');
      }
      const uploadData = await uploadUrlResponse.json();

      const uploadResponse = await fetch(uploadData.signedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      const confirmResponse = await fetch('/api/projects/attachments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid,
          storagePath: uploadData.path,
          storageBucket: uploadData.bucket,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSizeBytes: selectedFile.size,
          documentTypeUuid: selectedDocumentType,
          documentDate,
          documentNo: documentNo || undefined,
          documentValue: documentValue ? parseFloat(documentValue) : undefined,
          documentCurrencyUuid: documentCurrency || undefined,
        }),
      });
      if (!confirmResponse.ok) throw new Error('Failed to confirm upload');

      await loadAttachments();
      setSelectedFile(null);
      setSelectedDocumentType('');
      setDocumentDate('');
      setDocumentNo('');
      setDocumentValue('');
      setDocumentCurrency('');
      setShowUploadForm(false);
    } catch (error: any) {
      console.error('Error uploading project attachment:', error);
      alert(error?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (attachment: Attachment) => {
    try {
      // Reuse generic download endpoint (only takes bucket+path)
      const response = await fetch(
        `/api/payments/attachments/download?bucket=${encodeURIComponent(attachment.storageBucket || '')}&path=${encodeURIComponent(attachment.storagePath)}`,
      );
      if (!response.ok) throw new Error('Failed to get view URL');
      const { signedUrl } = await response.json();
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing attachment:', error);
      alert('Failed to view attachment');
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await fetch(
        `/api/payments/attachments/download?bucket=${encodeURIComponent(attachment.storageBucket || '')}&path=${encodeURIComponent(attachment.storagePath)}`,
      );
      if (!response.ok) throw new Error('Failed to get download URL');
      const { signedUrl } = await response.json();
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      const response = await fetch(
        `/api/projects/attachments/delete?linkUuid=${encodeURIComponent(attachment.linkUuid)}&storageBucket=${encodeURIComponent(attachment.storageBucket || '')}&storagePath=${encodeURIComponent(attachment.storagePath)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Failed to delete attachment');
      await loadAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Failed to delete attachment');
    }
  };

  const handleEdit = (attachment: Attachment) => {
    setEditingAttachment(attachment);
    setSelectedDocumentType(attachment.documentTypeUuid || '');
    setDocumentDate(attachment.documentDate ? new Date(attachment.documentDate).toISOString().split('T')[0] : '');
    setDocumentNo(attachment.documentNo || '');
    setDocumentValue(attachment.documentValue?.toString() || '');
    setDocumentCurrency(attachment.documentCurrencyUuid || '');
    setShowUploadForm(true);
  };

  const handleCancelEdit = () => {
    setEditingAttachment(null);
    setSelectedFile(null);
    setSelectedDocumentType('');
    setDocumentDate('');
    setDocumentNo('');
    setDocumentValue('');
    setDocumentCurrency('');
    setShowUploadForm(false);
  };

  const handleUpdateAttachment = async () => {
    if (!editingAttachment) return;
    if (!selectedDocumentType) { alert('Please select a document type'); return; }
    const activeDocType = documentTypes.find(d => d.uuid === selectedDocumentType);
    if (activeDocType?.requireDate && !documentDate) { alert('Document Date is required for this document type'); return; }
    if (activeDocType?.requireValue && !documentValue) { alert('Value is required for this document type'); return; }
    if (activeDocType?.requireCurrency && !documentCurrency) { alert('Currency is required for this document type'); return; }
    if (activeDocType?.requireDocumentNo && !documentNo) { alert('Document Number is required for this document type'); return; }
    setUploading(true);
    try {
      // Reuse generic payments update endpoint (only updates attachments table by uuid)
      const response = await fetch('/api/payments/attachments/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentUuid: editingAttachment.attachmentUuid,
          documentTypeUuid: selectedDocumentType,
          documentDate,
          documentNo: documentNo || null,
          documentValue: documentValue ? parseFloat(documentValue) : null,
          documentCurrencyUuid: documentCurrency || null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update attachment');
      }
      await loadAttachments();
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating attachment:', error);
      alert(`Failed to update attachment: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const getDocumentTypeName = (uuid: string | null): string => {
    if (!uuid) return 'Unknown';
    return documentTypes.find((t) => t.uuid === uuid)?.name || 'Unknown';
  };
  const getCurrencyCode = (uuid: string | null): string => {
    if (!uuid) return '';
    return currencies.find((c) => c.uuid === uuid)?.code || '';
  };
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No date';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateString; }
  };
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isMounted) return null;

  return (
    <div ref={containerRef} className={`flex items-center gap-2 ${className || ''}`}>
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={openDialog}
          title={triggerTitle || 'Project attachments'}
        >
          {count > 0 && <span className="text-xs font-medium">{count}</span>}
          <Paperclip className="h-4 w-4" />
        </Button>
      )}

      {dialogMounted && (
        <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
          <DialogContent className="!w-[95vw] !max-w-[95vw] max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Attachments for project {projectName ? `"${projectName}"` : projectUuid}</DialogTitle>
              <DialogDescription>View and manage documents related to this project.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-x-auto overflow-y-auto max-h-[calc(80vh-120px)]">
              {loading ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
              ) : attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No attachments yet. Click &quot;Add Attachment&quot; to upload a document.
                </div>
              ) : (
                <div className="space-y-2 min-w-[900px]">
                  <div className="grid grid-cols-[130px_150px_150px_180px_80px_1fr] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                    <div>Date</div>
                    <div>Document Type</div>
                    <div>Document No</div>
                    <div>Value</div>
                    <div>Currency</div>
                    <div className="text-right">Actions</div>
                  </div>
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.linkUuid}
                      className="grid grid-cols-[130px_150px_150px_180px_80px_1fr] gap-3 items-center p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="text-sm">{formatDate(attachment.documentDate)}</div>
                      <div className="text-sm font-medium">{getDocumentTypeName(attachment.documentTypeUuid)}</div>
                      <div className="text-sm text-muted-foreground">{attachment.documentNo || '—'}</div>
                      <div className="text-sm text-muted-foreground">
                        {attachment.documentValue != null ? attachment.documentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">{getCurrencyCode(attachment.documentCurrencyUuid) || '—'}</div>
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleView(attachment)} className="text-sm text-primary hover:underline font-medium">View</button>
                        <button onClick={() => handleDownload(attachment)} className="text-sm text-primary hover:underline font-medium">Download</button>
                        <button onClick={() => handleEdit(attachment)} className="text-sm text-primary hover:underline font-medium">Edit</button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(attachment)} title="Delete" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!showUploadForm && !disableUpload && (
                <Button onClick={() => setShowUploadForm(true)} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attachment
                </Button>
              )}

              {showUploadForm && (
                <div className="border rounded-lg p-4 space-y-4 bg-accent/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{editingAttachment ? 'Edit Attachment' : 'New Attachment'}</Label>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-6 w-6 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {!editingAttachment && (
                      <div className="space-y-2">
                        <Label htmlFor="proj-file-upload" className="text-sm">File <span className="text-destructive">*</span></Label>
                        <Input id="proj-file-upload" type="file" onChange={handleFileSelect} disabled={uploading} />
                        {selectedFile && (
                          <div className="text-xs text-muted-foreground">{selectedFile.name} ({formatFileSize(selectedFile.size)})</div>
                        )}
                      </div>
                    )}
                    {editingAttachment && (
                      <div className="space-y-2">
                        <Label className="text-sm">File</Label>
                        <div className="text-sm text-muted-foreground p-2 border rounded bg-muted/30">{editingAttachment.fileName}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="proj-document-type" className="text-sm">Document Type <span className="text-destructive">*</span></Label>
                        <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType} disabled={uploading}>
                          <SelectTrigger id="proj-document-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.uuid} value={type.uuid}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proj-document-date" className="text-sm">Document Date{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireDate && <span className="text-destructive"> *</span>}</Label>
                        <Input id="proj-document-date" type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} disabled={uploading} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proj-document-no" className="text-sm">Document Number{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireDocumentNo && <span className="text-destructive"> *</span>}</Label>
                      <Input id="proj-document-no" type="text" placeholder="e.g., CTR-2026-001" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} disabled={uploading} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="proj-document-value" className="text-sm">Value{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireValue && <span className="text-destructive"> *</span>}</Label>
                        <Input id="proj-document-value" type="number" step="0.01" placeholder="0.00" value={documentValue} onChange={(e) => setDocumentValue(e.target.value)} disabled={uploading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proj-document-currency" className="text-sm">Currency{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireCurrency && <span className="text-destructive"> *</span>}</Label>
                        <Select value={documentCurrency} onValueChange={setDocumentCurrency} disabled={uploading}>
                          <SelectTrigger id="proj-document-currency"><SelectValue placeholder="Select currency" /></SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.uuid} value={c.uuid}>{c.code} — {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={handleCancelEdit} disabled={uploading}>Cancel</Button>
                      {editingAttachment ? (
                        <Button onClick={handleUpdateAttachment} disabled={uploading}>{uploading ? 'Saving...' : 'Save Changes'}</Button>
                      ) : (
                        <Button onClick={handleUpload} disabled={uploading || !selectedFile}>{uploading ? 'Uploading...' : 'Upload'}</Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ProjectAttachments;
