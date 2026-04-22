'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PaymentAttachments } from './payment-attachments';
import { ProjectAttachments } from './project-attachments';

type RowAttachmentsProps = {
  /** Payment id to surface payment-bound attachments. Optional. */
  paymentId?: string | null;
  /** Project uuid to surface project-bound attachments. Optional. */
  projectUuid?: string | null;
  /** Project name shown in the project attachments dialog header. */
  projectName?: string | null;
  /** Whether the user can upload new project-bound attachments from this row.
   *  When false, the project dialog still opens for viewing/downloading but
   *  the "Add Attachment" form is hidden. */
  canAddProjectAttachment?: boolean;
};

/**
 * Single paperclip badge that surfaces both payment-bound and project-bound
 * attachments for a report row. Combined count is shown next to the icon; on
 * click, a small chooser opens letting the user pick which set to view.
 */
export function RowAttachments({
  paymentId,
  projectUuid,
  projectName,
  canAddProjectAttachment = false,
}: RowAttachmentsProps) {
  const [paymentCount, setPaymentCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [openTarget, setOpenTarget] = useState<'payment' | 'project' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lazy-load both counts when the badge scrolls into view.
  useEffect(() => {
    fetchedRef.current = false;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          if (paymentId) {
            fetch(`/api/payments/attachments?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => setPaymentCount(data?.attachments?.length ?? 0))
              .catch(() => setPaymentCount(0));
          } else {
            setPaymentCount(0);
          }
          if (projectUuid) {
            fetch(`/api/projects/attachments?projectUuid=${encodeURIComponent(projectUuid)}`, { cache: 'no-store' })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => setProjectCount(data?.attachments?.length ?? 0))
              .catch(() => setProjectCount(0));
          } else {
            setProjectCount(0);
          }
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [paymentId, projectUuid]);

  if (!isMounted) return null;
  if (!paymentId && !projectUuid) return null;

  const total = (paymentCount ?? 0) + (projectCount ?? 0);

  // Auto-route when only one source is available.
  const onlyPayment = Boolean(paymentId) && !projectUuid;
  const onlyProject = !paymentId && Boolean(projectUuid);

  const handleTriggerClick = () => {
    if (onlyPayment) {
      setOpenTarget('payment');
      return;
    }
    if (onlyProject) {
      setOpenTarget('project');
      return;
    }
    setMenuOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="inline-flex items-center">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleTriggerClick}
            title="Attachments (payment + project)"
          >
            {total > 0 && <span className="text-xs font-medium">{total}</span>}
            <Paperclip className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        {!onlyPayment && !onlyProject && (
          <PopoverContent align="end" className="w-56 p-1">
            {paymentId && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between"
                onClick={() => {
                  setMenuOpen(false);
                  setOpenTarget('payment');
                }}
              >
                <span>Payment attachments</span>
                <span className="text-xs text-muted-foreground">{paymentCount ?? '…'}</span>
              </button>
            )}
            {projectUuid && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between"
                onClick={() => {
                  setMenuOpen(false);
                  setOpenTarget('project');
                }}
              >
                <span>Project attachments</span>
                <span className="text-xs text-muted-foreground">{projectCount ?? '…'}</span>
              </button>
            )}
          </PopoverContent>
        )}
      </Popover>

      {openTarget === 'payment' && paymentId && (
        <PaymentAttachments
          key={`p-${paymentId}`}
          paymentId={paymentId}
          hideTrigger
          initiallyOpen
          onAttachmentsChange={(c) => setPaymentCount(c)}
          onOpenChange={(open) => {
            if (!open) setOpenTarget(null);
          }}
        />
      )}
      {openTarget === 'project' && projectUuid && (
        <ProjectAttachments
          key={`pr-${projectUuid}`}
          projectUuid={projectUuid}
          projectName={projectName ?? null}
          hideTrigger
          initiallyOpen
          lazyLoad={false}
          disableUpload={!canAddProjectAttachment}
          onAttachmentsChange={(c) => setProjectCount(c)}
          onOpenChange={(open) => {
            if (!open) setOpenTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default RowAttachments;
