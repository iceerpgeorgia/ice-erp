'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Trash2, Download, Eye, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Attachment = {
  linkUuid: string;
  attachmentUuid: string;
  ownerTable: string;
  ownerUuid: string;
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

type Currency = {
  uuid: string;
  code: string;
  name: string;
};

type Project = {
  project_uuid: string;
  name: string;
};

type PaymentAttachmentsProps = {
  paymentId: string;
  onAttachmentsChange?: (count: number) => void;
  /** When true, render only the dialog (no trigger button). Pair with `initiallyOpen` and `onOpenChange` for controlled use. */
  hideTrigger?: boolean;
  /** Open the dialog as soon as the component mounts. */
  initiallyOpen?: boolean;
  /** Notified whenever the dialog open state changes. */
  onOpenChange?: (open: boolean) => void;
};

export function PaymentAttachments({ paymentId, onAttachmentsChange, hideTrigger = false, initiallyOpen = false, onOpenChange }: PaymentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [dialogMounted, setDialogMounted] = useState(initiallyOpen);
  const [isMounted, setIsMounted] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lazy-load attachment count when the component scrolls into view
  useEffect(() => {
    setIsMounted(true);
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
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [paymentId]);

  const loadAttachmentCount = async () => {
    if (!paymentId) return;
    
    try {
      const response = await fetch(`/api/payments/attachments?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
      if (!response.ok) return;
      
      const data = await response.json();
      const count = data.attachments?.length || 0;
      setAttachments(data.attachments || []);
      onAttachmentsChange?.(count);
    } catch (error) {
      console.error('Error loading attachment count:', error);
    }
  };

  const loadAttachments = async () => {
    if (!paymentId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/payments/attachments?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load attachments');
      
      const data = await response.json();
      setAttachments(data.attachments || []);
      onAttachmentsChange?.(data.attachments?.length || 0);
    } catch (error) {
      console.error('Error loading attachments:', error);
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
      console.log('[Attachments] Document types loaded:', result);
      setDocumentTypes(result.documentTypes || []);
    } catch (error) {
      console.error('Error loading document types:', error);
      setDocumentTypes([]);
    }
  };

  const loadCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      if (!response.ok) throw new Error('Failed to load currencies');
      
      const result = await response.json();
      console.log('[Attachments] Currencies loaded:', result);
      // API returns { data: [...] }
      const currenciesData = result.data || result.currencies || [];
      setCurrencies(currenciesData);
    } catch (error) {
      console.error('Error loading currencies:', error);
      setCurrencies([]);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) return;
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    }
  };

  const handleOpenDialog = () => {
    setDialogMounted(true);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (isDialogOpen && dialogMounted) {
      loadAttachments();
      loadDocumentTypes();
      loadCurrencies();
      loadProjects();
    }
  }, [isDialogOpen, dialogMounted]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDropZoneDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!uploading) setIsDraggingFile(true);
  };

  const handleDropZoneDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
    setIsDraggingFile(false);
  };

  const handleDropZoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (uploading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setSelectedFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !paymentId) return;

    // Validate required fields
    if (!selectedDocumentType) {
      alert('Please select a document type');
      return;
    }

    const activeDocType = documentTypes.find(d => d.uuid === selectedDocumentType);
    if (activeDocType?.requireDate && !documentDate) { alert('Document Date is required for this document type'); return; }
    if (activeDocType?.requireValue && !documentValue) { alert('Value is required for this document type'); return; }
    if (activeDocType?.requireCurrency && !documentCurrency) { alert('Currency is required for this document type'); return; }
    if (activeDocType?.requireDocumentNo && !documentNo) { alert('Document Number is required for this document type'); return; }
    if (activeDocType?.requireProject && !selectedProject) { alert('Project is required for this document type'); return; }

    setUploading(true);
    try {
      // Step 1: Get signed upload URL
      const uploadUrlResponse = await fetch('/api/payments/attachments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          fileName: selectedFile.name,
          documentTypeUuid: selectedDocumentType,
          documentDate: documentDate,
          documentNo: documentNo || undefined,
          documentValue: documentValue ? parseFloat(documentValue) : undefined,
          documentCurrencyUuid: documentCurrency || undefined,
          linkedProjectUuid: selectedProject || undefined,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get upload URL. Please ensure the Supabase Storage bucket "payment-attachments" is created.');
      }

      const uploadData = await uploadUrlResponse.json();

      // Step 2: Upload file to Supabase Storage
      const uploadResponse = await fetch(uploadData.signedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Confirm upload and create database records
      const confirmResponse = await fetch('/api/payments/attachments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          storagePath: uploadData.path,
          storageBucket: uploadData.bucket,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSizeBytes: selectedFile.size,
          documentTypeUuid: selectedDocumentType,
          documentDate: documentDate,
          documentNo: documentNo || undefined,
          documentValue: documentValue ? parseFloat(documentValue) : undefined,
          documentCurrencyUuid: documentCurrency || undefined,
          linkedProjectUuid: selectedProject || undefined,
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      // Success - reload attachments and reset form
      await loadAttachments();
      setSelectedFile(null);
      setSelectedDocumentType('');
      setDocumentDate('');
      setDocumentNo('');
      setDocumentValue('');
      setDocumentCurrency('');
      setSelectedProject('');
      setShowUploadForm(false);
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      alert(error?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (attachment: Attachment) => {
    try {
      const response = await fetch(
        `/api/payments/attachments/download?bucket=${encodeURIComponent(attachment.storageBucket || '')}&path=${encodeURIComponent(attachment.storagePath)}`
      );

      if (!response.ok) {
        throw new Error('Failed to get view URL');
      }

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
        `/api/payments/attachments/download?bucket=${encodeURIComponent(attachment.storageBucket || '')}&path=${encodeURIComponent(attachment.storagePath)}`
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { signedUrl } = await response.json();
      
      // Create temporary anchor to trigger download
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

  const getDocumentTypeName = (uuid: string | null): string => {
    if (!uuid) return 'Unknown';
    const type = documentTypes.find(t => t.uuid === uuid);
    return type?.name || 'Unknown';
  };

  const getCurrencyCode = (uuid: string | null): string => {
    if (!uuid) return '';
    const currency = currencies.find(c => c.uuid === uuid);
    return currency?.code || '';
  };

  const formatValue = (value: number | null, currencyUuid: string | null): string => {
    if (value == null) return '—'; // Checks both null and undefined
    if (!currencyUuid) return value.toString();
    const currencyCode = getCurrencyCode(currencyUuid);
    return currencyCode ? `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}` : value.toString();
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No date';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete this attachment?`)) return;

    try {
      const response = await fetch(
        `/api/payments/attachments/delete?linkUuid=${encodeURIComponent(attachment.linkUuid)}&storageBucket=${encodeURIComponent(attachment.storageBucket || '')}&storagePath=${encodeURIComponent(attachment.storagePath)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

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
    setSelectedProject('');
    setShowUploadForm(false);
  };

  const handleUpdateAttachment = async () => {
    if (!editingAttachment) return;

    if (!selectedDocumentType) {
      alert('Please select a document type');
      return;
    }

    const activeDocType = documentTypes.find(d => d.uuid === selectedDocumentType);
    if (activeDocType?.requireDate && !documentDate) { alert('Document Date is required for this document type'); return; }
    if (activeDocType?.requireValue && !documentValue) { alert('Value is required for this document type'); return; }
    if (activeDocType?.requireCurrency && !documentCurrency) { alert('Currency is required for this document type'); return; }
    if (activeDocType?.requireDocumentNo && !documentNo) { alert('Document Number is required for this document type'); return; }

    setUploading(true);
    try {
      const response = await fetch('/api/payments/attachments/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentUuid: editingAttachment.attachmentUuid,
          documentTypeUuid: selectedDocumentType,
          documentDate: documentDate,
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const paymentLinkedAttachments = attachments.filter((attachment) => attachment.ownerTable === 'payments');
  const projectLinkedAttachments = attachments.filter((attachment) => attachment.ownerTable === 'projects');

  const renderAttachmentSection = (
    title: string,
    items: Attachment[],
    emptyMessage: string,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground px-3 py-4 border rounded-lg bg-background">
          {emptyMessage}
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
          {items.map((attachment) => (
            <div
              key={attachment.linkUuid}
              className="grid grid-cols-[130px_150px_150px_180px_80px_1fr] gap-3 items-center p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="text-sm">
                {formatDate(attachment.documentDate)}
              </div>
              <div className="text-sm font-medium">
                {getDocumentTypeName(attachment.documentTypeUuid)}
              </div>
              <div className="text-sm text-muted-foreground">
                {attachment.documentNo || '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                {attachment.documentValue != null ? attachment.documentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                {getCurrencyCode(attachment.documentCurrencyUuid) || '—'}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => handleView(attachment)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  View
                </button>
                <button
                  onClick={() => handleDownload(attachment)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => handleEdit(attachment)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Edit
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment)}
                  title="Delete"
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!isMounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={handleOpenDialog}
        >
          {attachments.length > 0 && (
            <span className="text-xs font-medium">{attachments.length}</span>
          )}
          <Paperclip className="h-4 w-4" />
        </Button>
      )}

      {dialogMounted && (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); onOpenChange?.(open); }}>
        <DialogContent className="!w-[95vw] !max-w-[95vw] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Attachments for {paymentId}</DialogTitle>
            <DialogDescription>
              View and manage documents linked directly to this payment and to its project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-x-auto overflow-y-auto max-h-[calc(80vh-120px)]">{/* Attachments List */}
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
            ) : attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No attachments yet. Click "Add Attachment" to upload a document.
              </div>
            ) : (
              <div className="space-y-4 min-w-[900px]">
                {renderAttachmentSection('Payment Attachments', paymentLinkedAttachments, 'No attachments are linked directly to this payment.')}
                {renderAttachmentSection('Project Attachments', projectLinkedAttachments, 'No attachments are linked through this payment\'s project.')}
              </div>
            )}

            {/* Add Attachment Button */}
            {!showUploadForm && (
              <Button
                onClick={() => setShowUploadForm(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Attachment
              </Button>
            )}

            {/* Upload/Edit Form (shown when Add Attachment or Edit is clicked) */}
            {showUploadForm && (
              <div className="border rounded-lg p-4 space-y-4 bg-accent/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {editingAttachment ? 'Edit Attachment' : 'New Attachment'}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* File Upload (only show when adding new) */}
                  {!editingAttachment && (
                    <div className="space-y-2">
                      <Label htmlFor="file-upload" className="text-sm">
                        File <span className="text-destructive">*</span>
                      </Label>
                      <div
                        className={`rounded-lg border border-dashed p-6 text-center transition-colors ${isDraggingFile ? 'border-primary bg-primary/5' : 'border-border bg-background'} ${uploading ? 'opacity-60' : 'cursor-pointer hover:border-primary/60 hover:bg-accent/30'}`}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        onDragOver={handleDropZoneDragOver}
                        onDragLeave={handleDropZoneDragLeave}
                        onDrop={handleDropZoneDrop}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">
                          Drag and drop a file here, or click to choose from a folder
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          One file per attachment
                        </div>
                        <Input
                          ref={fileInputRef}
                          id="file-upload"
                          type="file"
                          onChange={handleFileSelect}
                          disabled={uploading}
                          className="hidden"
                        />
                      </div>
                      {selectedFile && (
                        <div className="text-xs text-muted-foreground">
                          {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show current file name when editing */}
                  {editingAttachment && (
                    <div className="space-y-2">
                      <Label className="text-sm">File</Label>
                      <div className="text-sm text-muted-foreground p-2 border rounded bg-muted/30">
                        {editingAttachment.fileName}
                      </div>
                    </div>
                  )}

                  {/* Document Type and Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="document-type" className="text-sm">
                        Document Type <span className="text-destructive">*</span>
                      </Label>
                      <Select 
                        value={selectedDocumentType} 
                        onValueChange={setSelectedDocumentType}
                        disabled={uploading}
                      >
                        <SelectTrigger id="document-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.uuid} value={type.uuid}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="document-date" className="text-sm">
                        Document Date{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireDate && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input
                        id="document-date"
                        type="date"
                        value={documentDate}
                        onChange={(e) => setDocumentDate(e.target.value)}
                        disabled={uploading}
                      />
                    </div>
                  </div>

                  {/* Project selector — shown when document type requires project */}
                  {documentTypes.find(d => d.uuid === selectedDocumentType)?.requireProject && (
                    <div className="space-y-2">
                      <Label htmlFor="document-project" className="text-sm">
                        Project <span className="text-destructive">*</span>
                      </Label>
                      <Select value={selectedProject} onValueChange={setSelectedProject} disabled={uploading}>
                        <SelectTrigger id="document-project"><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.project_uuid} value={p.project_uuid}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Document Number */}
                  <div className="space-y-2">
                    <Label htmlFor="document-no" className="text-sm">Document Number{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireDocumentNo && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id="document-no"
                      type="text"
                      placeholder="e.g., INV-2024-001"
                      value={documentNo}
                      onChange={(e) => setDocumentNo(e.target.value)}
                      disabled={uploading}
                    />
                  </div>

                  {/* Value and Currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="document-value" className="text-sm">Value{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireValue && <span className="text-destructive"> *</span>}</Label>
                      <Input
                        id="document-value"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={documentValue}
                        onChange={(e) => setDocumentValue(e.target.value)}
                        disabled={uploading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="document-currency" className="text-sm">Currency{documentTypes.find(d => d.uuid === selectedDocumentType)?.requireCurrency && <span className="text-destructive"> *</span>}</Label>
                      <Select 
                        value={documentCurrency} 
                        onValueChange={setDocumentCurrency}
                        disabled={uploading}
                      >
                        <SelectTrigger id="document-currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.uuid} value={currency.uuid}>
                              {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Upload/Update Button */}
                  <Button
                    onClick={editingAttachment ? handleUpdateAttachment : handleUpload}
                    disabled={
                      editingAttachment 
                        ? (!selectedDocumentType || uploading)
                        : (!selectedFile || !selectedDocumentType || uploading)
                    }
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading 
                      ? (editingAttachment ? 'Updating...' : 'Uploading...') 
                      : (editingAttachment ? 'Update Attachment' : 'Upload Attachment')
                    }
                  </Button>
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
