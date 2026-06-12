'use client';

import { useSession } from 'next-auth/react';
import { MessageCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useComponentLogger } from '@/lib/logging/component-logger';

export function FloatingAIButton() {
  const log = useComponentLogger('FloatingAIButton');
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();

  // Define callbacks before any early returns
  const handleClick = useCallback(() => {
    setIsOpen((prev) => {
      log.info('Button Clicked', { wasOpen: prev, willOpen: !prev });
      return !prev;
    });
  }, [log]);

  const handleOpenChange = useCallback((open: boolean) => {
    log.info('Open State Changed', { open });
    setIsOpen(open);
  }, [log]);

  // Track mounting - run once on mount
  useEffect(() => {
    log.trackMount({
      sessionStatus: status,
      hasSession: !!session,
    });
    setMounted(true);

    return () => {
      log.trackUnmount({
        wasOpen: isOpen,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track render on prop changes
  useEffect(() => {
    if (mounted) {
      log.trackRender({
        status,
        hasSession: !!session,
        isOpen,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, isOpen, mounted]);

  // Track session status changes
  useEffect(() => {
    log.info('Session Status Changed', {
      status,
      email: session?.user?.email,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email]);

  // Don't render until hydration complete
  if (!mounted) {
    log.debug('Not Mounted Yet', { hydrationPending: true });
    return null;
  }

  // Only render if authenticated
  if (!session?.user) {
    log.debug('No User Session', { status });
    return null;
  }

  return (
    <div
      data-component="floating-ai-button"
      className="fixed bottom-6 right-6 z-40"
      suppressHydrationWarning
    >
      <button
        onClick={handleClick}
        title="Ask AI Assistant"
        className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white shadow-lg hover:shadow-xl transition-shadow"
        aria-label="AI Assistant"
      >
        <MessageCircle size={24} />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-20 right-0 w-80 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
          suppressHydrationWarning
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <button
              onClick={() => handleOpenChange(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 p-4 text-gray-600 text-sm">
            <p>Hi {session.user.name || 'there'}! How can I help you today?</p>
          </div>
          <div className="p-4 border-t border-gray-200">
            <input
              type="text"
              placeholder="Ask a question..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() =>
                log.debug('Input Focused', { isOpen })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
