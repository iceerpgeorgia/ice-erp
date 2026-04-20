'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  DollarSign,
  Hash,
  Building2,
  CreditCard,
  Briefcase,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

type EntityLink = {
  link_uuid: string;
  owner_table: string;
  owner_uuid: string;
  owner_field: string | null;
  is_primary: boolean;
  created_at: string;
  entity_details: any;
};

type Attachment = {
  uuid: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  fileHashSha256: string | null;
  storageProvider: string;
  storageBucket: string | null;
  storagePath: string;
  documentType: {
    uuid: string;
    name: string;
    code: string;
  } | null;
  documentDate: string | null;
  documentNo: string | null;
  documentValue: number | null;
  currency: {
    uuid: string;
    code: string;
    name: string;
    symbol: string;
  } | null;
  metadata: any;
  uploadedByUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  links: EntityLink[];
};

export default function AttachmentsPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [ownerTable, setOwnerTable] = useState<string>('all');
  const limit = 50;

  useEffect(() => {
    fetchAttachments();
  }, [page, ownerTable]);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append('search', search);
      }

      if (ownerTable && ownerTable !== 'all') {
        params.append('ownerTable', ownerTable);
      }

      const response = await fetch(`/api/attachments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch attachments');

      const data = await response.json();
      setAttachments(data.attachments);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchAttachments();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  const getEntityIcon = (ownerTable: string) => {
    switch (ownerTable) {
      case 'projects':
        return <Building2 className="h-4 w-4" />;
      case 'payments':
        return <CreditCard className="h-4 w-4" />;
      case 'jobs':
        return <Briefcase className="h-4 w-4" />;
      case 'counteragents':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const renderEntityDetails = (link: EntityLink) => {
    const { owner_table, entity_details } = link;

    if (!entity_details) {
      return <span className="text-sm text-muted-foreground">No details</span>;
    }

    switch (owner_table) {
      case 'projects':
        return (
          <div className="space-y-1">
            <div className="font-medium">{entity_details.project_name}</div>
            {entity_details.contract_no && (
              <div className="text-sm text-muted-foreground">Contract: {entity_details.contract_no}</div>
            )}
            {entity_details.counteragent && (
              <div className="text-sm text-muted-foreground">Client: {entity_details.counteragent}</div>
            )}
          </div>
        );
      case 'payments':
        return (
          <div className="space-y-1">
            <div className="font-medium">ID: {entity_details.payment_id}</div>
            {entity_details.label && (
              <div className="text-sm text-muted-foreground">{entity_details.label}</div>
            )}
            {entity_details.income_tax && (
              <div className="text-xs">
                <Badge variant="secondary">Income Tax</Badge>
              </div>
            )}
          </div>
        );
      case 'jobs':
        return (
          <div className="space-y-1">
            <div className="font-medium">{entity_details.job_name}</div>
            {entity_details.floors && (
              <div className="text-sm text-muted-foreground">Floors: {entity_details.floors}</div>
            )}
            {entity_details.is_ff && (
              <div className="text-xs">
                <Badge variant="secondary">FF</Badge>
              </div>
            )}
          </div>
        );
      case 'counteragents':
        return (
          <div className="space-y-1">
            <div className="font-medium">{entity_details.name}</div>
            {entity_details.identification_number && (
              <div className="text-sm text-muted-foreground">INN: {entity_details.identification_number}</div>
            )}
            {entity_details.entity_type && (
              <div className="text-xs">
                <Badge variant="outline">{entity_details.entity_type}</Badge>
              </div>
            )}
          </div>
        );
      default:
        return <span className="text-sm text-muted-foreground">{owner_table}</span>;
    }
  };

  const handleDownload = async (bucket: string | null, path: string) => {
    try {
      const params = new URLSearchParams({
        bucket: bucket || 'payment-attachments',
        path: path,
      });
      
      const response = await fetch(`/api/payments/attachments/download?${params}`);
      if (!response.ok) throw new Error('Failed to get download URL');
      
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attachments</h1>
          <p className="text-muted-foreground">
            Manage and view all system attachments
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter attachments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by file name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={ownerTable} onValueChange={setOwnerTable}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="projects">Projects</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
                <SelectItem value="jobs">Jobs</SelectItem>
                <SelectItem value="counteragents">Counteragents</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attachments ({total})</CardTitle>
              <CardDescription>Showing {attachments.length} of {total} attachments</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading attachments...</div>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>No attachments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Document Info</TableHead>
                    <TableHead>Linked To</TableHead>
                    <TableHead>File Details</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attachments.map((attachment) => (
                    <TableRow key={attachment.uuid}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-xs truncate">{attachment.fileName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attachment.mimeType || 'Unknown type'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {attachment.documentType && (
                            <Badge variant="outline" className="mb-1">
                              {attachment.documentType.name}
                            </Badge>
                          )}
                          {attachment.documentDate && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(attachment.documentDate)}
                            </div>
                          )}
                          {attachment.documentNo && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Hash className="h-3 w-3" />
                              {attachment.documentNo}
                            </div>
                          )}
                          {attachment.documentValue && attachment.currency && (
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <DollarSign className="h-3 w-3" />
                              {attachment.documentValue.toLocaleString()} {attachment.currency.code}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {attachment.links.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No links</span>
                          ) : (
                            attachment.links.map((link) => (
                              <div key={link.link_uuid} className="flex items-start gap-2">
                                <div className="mt-1">
                                  {getEntityIcon(link.owner_table)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {link.owner_table}
                                    </Badge>
                                    {link.is_primary && (
                                      <Badge variant="default" className="text-xs">
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                  {renderEntityDetails(link)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="text-muted-foreground">
                            Size: {formatFileSize(attachment.fileSizeBytes)}
                          </div>
                          {attachment.fileHashSha256 && (
                            <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                              Hash: {attachment.fileHashSha256.substring(0, 16)}...
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {attachment.storageProvider}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(attachment.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(attachment.storageBucket, attachment.storagePath)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
