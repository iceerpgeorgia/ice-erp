'use client';

import { useSession } from 'next-auth/react';
import { MessageCircle, Send, GripHorizontal } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useComponentLogger } from '@/lib/logging/component-logger';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function FloatingAIButton() {
  const log = useComponentLogger('FloatingAIButton');
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dialogSize, setDialogSize] = useState({ width: 320, height: 400 });
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'se' | 'sw' | 'w'>('se');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    log.info('Message Sent', { content: inputValue });

    try {
      // Call AI chat API
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      log.info('Response Received', { 
        messageId: assistantMessage.id,
        tokens: data.usage?.total_tokens,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Message Send Failed', { error: errorMessage });

      // Show error message to user
      const errorResponseMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponseMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, messages, log]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-direction]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - dialogPos.x, y: e.clientY - dialogPos.y });
    log.debug('Drag Started');
  }, [dialogPos, log]);

  const handleMouseMoveDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !dialogRef.current) return;
    setDialogPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUpDrag = useCallback(() => {
    setIsDragging(false);
    log.debug('Drag Ended');
  }, [log]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    const direction = (e.currentTarget as HTMLElement).dataset.direction as 'se' | 'sw' | 'w' || 'se';
    setIsResizing(true);
    setResizeDirection(direction);
    setDragStart({ x: e.clientX, y: e.clientY });
    log.debug('Resize Started', { direction });
  }, [log]);

  const handleMouseMoveResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !dialogRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setDialogSize((prev) => {
      let newWidth = prev.width;
      let newHeight = prev.height;

      // Handle different resize directions
      if (resizeDirection === 'se') {
        // Bottom-right: standard resize
        newWidth = Math.max(280, prev.width + deltaX);
        newHeight = Math.max(300, prev.height + deltaY);
      } else if (resizeDirection === 'sw') {
        // Bottom-left: resize from left and bottom
        newWidth = Math.max(280, prev.width - deltaX);
        newHeight = Math.max(300, prev.height + deltaY);
      } else if (resizeDirection === 'w') {
        // Left only: resize width from left
        newWidth = Math.max(280, prev.width - deltaX);
      }

      return { width: newWidth, height: newHeight };
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isResizing, dragStart, resizeDirection]);

  const handleMouseUpResize = useCallback(() => {
    setIsResizing(false);
    log.debug('Resize Ended');
  }, [log]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMoveDrag);
      window.addEventListener('mouseup', handleMouseUpDrag);
      return () => {
        window.removeEventListener('mousemove', handleMouseMoveDrag);
        window.removeEventListener('mouseup', handleMouseUpDrag);
      };
    }
  }, [isDragging, handleMouseMoveDrag, handleMouseUpDrag]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMoveResize);
      window.addEventListener('mouseup', handleMouseUpResize);
      return () => {
        window.removeEventListener('mousemove', handleMouseMoveResize);
        window.removeEventListener('mouseup', handleMouseUpResize);
      };
    }
  }, [isResizing, handleMouseMoveResize, handleMouseUpResize]);

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
        messageCount: messages.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, isOpen, mounted, messages.length]);

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
      className="fixed top-3 right-16 z-40"
      suppressHydrationWarning
    >
      {/* Floating Button - Always Visible */}
      <button
        onClick={handleClick}
        title="Ask AI Assistant"
        className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-3 text-white shadow-lg hover:shadow-xl transition-shadow hover:scale-110"
        aria-label="AI Assistant"
      >
        <MessageCircle size={20} />
      </button>

      {/* Dialog - Positioned relative to button */}
      {isOpen && (
        <div
          ref={dialogRef}
          className="absolute top-14 -right-16 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          suppressHydrationWarning
          style={{
            width: `${dialogSize.width}px`,
            height: `${dialogSize.height}px`,
            transform: `translate(${dialogPos.x}px, ${dialogPos.y}px)`,
          }}
        >
          {/* Title Bar - Draggable */}
          <div
            onMouseDown={handleMouseDownDrag}
            className="flex justify-between items-center p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 cursor-move hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1">
              <GripHorizontal size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">AI Assistant</h3>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <p>Hi {session.user.name || 'there'}! 👋</p>
                <p className="mt-2">How can I help you today?</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div 
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                      style={{ animationDelay: '0ms' }}
                    />
                    <div 
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                      style={{ animationDelay: '150ms' }}
                    />
                    <div 
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-200 bg-white space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="text-xs text-gray-400 text-right">Drag header • Resize corners/edges</div>
          </div>

          {/* Resize Handles */}
          {/* Bottom-right handle */}
          <div
            data-direction="se"
            onMouseDown={handleMouseDownResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gradient-to-tl from-blue-500 to-transparent opacity-50 hover:opacity-100 transition-opacity rounded-tl"
            title="Drag to resize"
          />
          
          {/* Left handle */}
          <div
            data-direction="w"
            onMouseDown={handleMouseDownResize}
            className="absolute top-0 left-0 w-1 h-full cursor-ew-resize bg-blue-400 opacity-0 hover:opacity-30 transition-opacity"
            title="Drag left to resize"
          />
          
          {/* Bottom-left handle */}
          <div
            data-direction="sw"
            onMouseDown={handleMouseDownResize}
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize bg-gradient-to-tr from-blue-500 to-transparent opacity-50 hover:opacity-100 transition-opacity rounded-tr"
            title="Drag to resize"
          />
        </div>
      )}
    </div>
  );
}
