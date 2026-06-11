'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import TroubleshootingModal from './troubleshooting-modal';
import { Sparkles } from 'lucide-react';

interface FloatingAIButtonProps {
  pageContext?: string;
}

export function FloatingAIButton({ pageContext }: FloatingAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  if (!session?.user?.email) {
    return null; // Hide if not authenticated
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white z-40"
        title="Open AI troubleshooting assistant"
        aria-label="Troubleshooting assistant"
      >
        <Sparkles size={20} />
        <span className="hidden sm:inline font-medium">Need Help?</span>
      </button>

      {/* Modal */}
      <TroubleshootingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        pageContext={pageContext}
        userEmail={session.user.email}
      />
    </>
  );
}

export default FloatingAIButton;
