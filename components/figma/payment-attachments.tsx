'use client';

import React, { useState, useEffect } from 'react';
import { Paperclip, Upload, Trash2, Download, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Attachment = {
  linkUuid: string;
  attachmentUuid: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storageBucket: string | null;
  storagePath: string;
  documentTypeUuid: string | null;
  isPrimary: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
};

type PaymentAttachmentsProps = {
  paymentId: string;
  onAttachmentsChange?: (count: number) => void;
};

export function PaymentAttachments({ paymentId, onAttachmentsChange }: PaymentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadAttachments = async () => {
    if (!paymentId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/payments/attachments?paymentId=${encodeURIComponent(paymentId)}`);
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

  useEffect(() => {
    if (isDialogOpen) {
      loadAttachments();
    }
  }, [isDialogOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !paymentId) return;

    setUploading(true);
    try {
      // Step 1: Get signed upload URL
      const uploadUrlResponse = await fetch('/api/payments/attachments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          fileName: selectedFile.name,
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
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      // Success - reload attachments
      await loadAttachments();
      setSelectedFile(null);
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      alert(error?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete attachment "${attachment.fileName}"?`)) return;

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

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await fetch(
        `/api/payments/attachments/download?bucket=${encodeURIComponent(attachment.storageBucket || '')}&path=${encodeURIComponent(attachment.storagePath)}`
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { signedUrl } = await response.json();
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Paperclip className="h-4 w-4" />
            {attachments.length > 0 && (
              <span className="text-xs">({attachments.length})</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attachments for {paymentId}</DialogTitle>
            <DialogDescription>
              Upload and manage documents related to this payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label htmlFor="file-upload" className="text-sm font-medium">
                Upload New Attachment
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              {selectedFile && (
                <div className="text-xs text-muted-foreground">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              )}
            </div>

            {/* Attachments List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Existing Attachments ({attachments.length})
              </Label>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No attachments yet</div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.linkUuid}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {attachment.fileName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSizeBytes)}
                            {attachment.isPrimary && (
                              <span className="ml-2 text-blue-600 font-medium">Primary</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(attachment)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(attachment)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
