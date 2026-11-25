'use client';

import { useSession } from 'next-auth/react';
import { MessageCircle, Send, GripHorizontal, Download, Copy, Check, RotateCcw, FileCheck2, Inbox } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useComponentLogger } from '@/lib/logging/component-logger';

interface ClarifyingQuestion {
  question: string;
  options: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Text sent back to the server as conversation history. */
  content: string;
  /** Text shown in the bubble (assistant turns show the message, questions render separately). */
  display: string;
  kind?: 'question' | 'answer' | 'request' | 'error';
  questions?: ClarifyingQuestion[];
  requestTitle?: string;
  requestType?: string;
  requestMarkdown?: string | null;
  language?: 'georgian' | 'english';
  timestamp: Date;
}

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  improvement: 'bg-blue-100 text-blue-700',
  upgrade: 'bg-purple-100 text-purple-700',
};

function hasGeorgian(text: string) {
  return /[Ⴀ-ჿ]/.test(text);
}

type SubmitState = { status: 'idle' | 'sending' | 'sent' | 'error'; id?: number; emailed?: boolean; error?: string };

// The finished wording is saved only after the user explicitly answers "Yes, save it" to the
// "is this ready?" question on the card; the save endpoint also requires confirmed: true.
function RequestCard({
  message,
  georgian,
  isLatest,
  onSubmit,
  onChangeRequested,
}: {
  message: ChatMessage;
  georgian: boolean;
  isLatest: boolean;
  onSubmit: (message: ChatMessage) => Promise<{ id: number; emailed: boolean }>;
  onChangeRequested: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const markdown = message.requestMarkdown ?? '';

  const save = async () => {
    setSubmit({ status: 'sending' });
    try {
      const result = await onSubmit(message);
      setSubmit({ status: 'sent', id: result.id, emailed: result.emailed });
    } catch (error) {
      setSubmit({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
  const askToSave = isLatest && (submit.status === 'idle' || submit.status === 'error');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(georgian ? 'კოპირება ვერ მოხერხდა' : 'Could not copy');
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`w-full rounded-lg border bg-white shadow-sm overflow-hidden ${
        isLatest || submit.status === 'sent' ? 'border-green-300' : 'border-gray-200 opacity-70'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-green-200 bg-green-50">
        <FileCheck2 size={16} className="text-green-700 shrink-0" />
        {message.requestType && (
          <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${TYPE_STYLES[message.requestType] ?? 'bg-gray-100 text-gray-700'}`}>
            {message.requestType}
          </span>
        )}
        <span className="text-sm font-medium text-gray-900 truncate">{message.requestTitle}</span>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-gray-800 font-sans">
        {markdown}
      </pre>
      <div className="flex flex-col gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50">
        {askToSave && (
          <>
            <p className="text-sm font-medium text-gray-900">
              {georgian
                ? 'ეს ფორმულირება მზადაა შესანახად და ადმინისტრატორებისთვის გასაგზავნად?'
                : 'Is this wording ready to be saved and sent to the admins?'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
              >
                <Inbox size={14} />
                {georgian ? 'დიახ, შეინახე' : 'Yes, save it'}
              </button>
              <button
                onClick={onChangeRequested}
                className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-800 hover:bg-gray-100"
              >
                {georgian ? 'რაღაცის შეცვლა' : 'Change something'}
              </button>
            </div>
          </>
        )}
        {!isLatest && submit.status !== 'sent' && (
          <p className="text-xs text-gray-500">{georgian ? 'ქვემოთ არის ახალი ვერსია.' : 'Replaced by a newer version below.'}</p>
        )}
        {submit.status === 'sending' && <p className="text-xs text-gray-600">{georgian ? 'ინახება…' : 'Saving…'}</p>}
        {submit.status === 'sent' && (
          <p className="flex items-center gap-1 text-xs text-green-700">
            <Check size={14} className="shrink-0" />
            {georgian ? `გაიგზავნა ადმინისტრატორებთან (#${submit.id})` : `Sent to the admins (#${submit.id})`}
            {!submit.emailed &&
              (georgian ? ' — ელფოსტა ვერ გაიგზავნა, მაგრამ მოთხოვნა შენახულია.' : ' — the email was not sent, but the request is saved.')}
          </p>
        )}
        {submit.status === 'error' && (
          <p className="text-xs text-red-600">
            {georgian ? 'ვერ შეინახა: ' : 'Could not save: '}
            {submit.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? (georgian ? 'დაკოპირდა' : 'Copied') : georgian ? 'კოპირება' : 'Copy'}
        </button>
        <button
          onClick={download}
          className="flex items-center gap-1 rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700"
        >
          <Download size={14} />
          {georgian ? 'ჩამოტვირთვა (.md)' : 'Download (.md)'}
        </button>
        </div>
      </div>
    </div>
  );
}

export function FloatingAIButton() {
  const log = useComponentLogger('FloatingAIButton');
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dialogSize, setDialogSize] = useState({ width: 420, height: 560 });
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'se' | 'sw' | 'w'>('se');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { data: session, status } = useSession();

  const georgian = messages.some((m) => m.role === 'user' && hasGeorgian(m.content)) || hasGeorgian(inputValue);

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

  const sendToAssistant = useCallback(
    async (history: ChatMessage[], forceFinal: boolean) => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.filter((m) => m.kind !== 'error').map((m) => ({ role: m.role, content: m.content })),
            forceFinal,
            context: {
              pathname: window.location.pathname,
              search: window.location.search,
              pageTitle: document.title,
              viewport: `${window.innerWidth}x${window.innerHeight}`,
            },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        const assistantMessage: ChatMessage = {
          id: `${Date.now()}-a`,
          role: 'assistant',
          content: data.content,
          display: data.message ?? data.content,
          kind: data.kind,
          questions: data.questions ?? [],
          requestTitle: data.request?.title,
          requestType: data.request?.type,
          requestMarkdown: data.requestMarkdown ?? null,
          language: data.language,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        log.info('Response Received', { kind: data.kind });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Message Send Failed', { error: errorMessage });
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-e`,
            role: 'assistant',
            content: '',
            display: `Sorry, something went wrong: ${errorMessage}. Please try again.`,
            kind: 'error',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [log]
  );

  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      display: text,
      timestamp: new Date(),
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInputValue('');
    await sendToAssistant(history, false);
  }, [inputValue, isLoading, messages, sendToAssistant]);

  const handleWriteNow = useCallback(async () => {
    if (isLoading) return;
    const text = inputValue.trim() || (georgian ? 'დაწერე მოთხოვნა ახლავე.' : 'Write the request now.');
    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      display: text,
      timestamp: new Date(),
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInputValue('');
    await sendToAssistant(history, true);
  }, [georgian, inputValue, isLoading, messages, sendToAssistant]);

  const handleSubmitRequest = useCallback(
    async (requestMessage: ChatMessage) => {
      const upTo = messages.findIndex((m) => m.id === requestMessage.id);
      const conversation = (upTo >= 0 ? messages.slice(0, upTo + 1) : messages)
        .filter((m) => m.kind !== 'error')
        .map((m) => ({ role: m.role, content: m.content }));
      const language = requestMessage.language ?? (georgian ? 'georgian' : 'english');
      const response = await fetch('/api/ai-chat/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only sent from the card's explicit "Yes, save it" answer.
          confirmed: true,
          type: requestMessage.requestType,
          language: language === 'georgian' ? 'ka' : 'en',
          title: requestMessage.requestTitle,
          prompt: requestMessage.requestMarkdown,
          pathname: window.location.pathname,
          conversation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status !== 201) throw new Error(data.error || `HTTP ${response.status}`);
      log.info('Request Saved', { id: data.id, emailed: data.emailed });
      return { id: data.id as number, emailed: data.emailed === true };
    },
    [georgian, log, messages]
  );

  const handleChangeRequested = useCallback(() => {
    setInputValue((prev) => prev || (georgian ? 'შეცვალე: ' : 'Please change: '));
    inputRef.current?.focus();
  }, [georgian]);

  const handleOptionClick = useCallback((question: ClarifyingQuestion, option: string, questionCount: number) => {
    const line = questionCount > 1 ? `${question.question} — ${option}` : option;
    setInputValue((prev) => (prev.trim() ? `${prev.trimEnd()}\n${line}` : line));
    inputRef.current?.focus();
  }, []);

  const handleNewConversation = useCallback(() => {
    if (messages.length > 0 && !confirm(georgian ? 'დავიწყოთ თავიდან?' : 'Start a new conversation?')) return;
    setMessages([]);
    setInputValue('');
  }, [georgian, messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) {
      alert('No messages to export');
      return;
    }
    const exportContent = messages
      .map((msg) => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.role === 'user' ? 'You' : 'AI Assistant';
        return `[${timestamp}] ${role}:\n${msg.content || msg.display}\n`;
      })
      .join('\n---\n\n');
    const fullContent = `ice-erp AI Assistant Chat Export
Generated: ${new Date().toLocaleString()}
Messages: ${messages.length}

${'---\n\n'}${exportContent}`;
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log.info('Chat Exported', { messageCount: messages.length });
  }, [messages, log]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-direction]')) return;
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - dialogPos.x, y: e.clientY - dialogPos.y });
  }, [dialogPos]);

  const handleMouseMoveDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !dialogRef.current) return;
    setDialogPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUpDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    const direction = (e.currentTarget as HTMLElement).dataset.direction as 'se' | 'sw' | 'w' || 'se';
    setIsResizing(true);
    setResizeDirection(direction);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMoveResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !dialogRef.current) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setDialogSize((prev) => {
      let newWidth = prev.width;
      let newHeight = prev.height;
      if (resizeDirection === 'se') {
        newWidth = Math.max(320, prev.width + deltaX);
        newHeight = Math.max(360, prev.height + deltaY);
      } else if (resizeDirection === 'sw') {
        newWidth = Math.max(320, prev.width - deltaX);
        newHeight = Math.max(360, prev.height + deltaY);
      } else if (resizeDirection === 'w') {
        newWidth = Math.max(320, prev.width - deltaX);
      }
      return { width: newWidth, height: newHeight };
    });
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isResizing, dragStart, resizeDirection]);

  const handleMouseUpResize = useCallback(() => {
    setIsResizing(false);
  }, []);

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

  useEffect(() => {
    log.trackMount({ sessionStatus: status, hasSession: !!session });
    setMounted(true);
    return () => {
      log.trackUnmount({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;
  if (!session?.user) return null;

  const lastMessage = messages[messages.length - 1];
  const latestRequestId = [...messages].reverse().find((m) => m.kind === 'request')?.id;
  const canWriteNow = messages.some((m) => m.role === 'user') && lastMessage?.kind !== 'request';

  return (
    <div data-component="floating-ai-button" className="fixed top-3 right-16 z-40" suppressHydrationWarning>
      <button
        onClick={handleClick}
        title="Report a problem or suggest an improvement"
        className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-3 text-white shadow-lg hover:shadow-xl transition-shadow hover:scale-110"
        aria-label="AI Assistant"
      >
        <MessageCircle size={20} />
      </button>

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
          <div
            onMouseDown={handleMouseDownDrag}
            className="flex justify-between items-center p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 cursor-move"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <GripHorizontal size={16} className="text-gray-400 shrink-0" />
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {georgian ? 'პრობლემა ან იდეა' : 'Report a problem or idea'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewConversation}
                className="text-gray-400 hover:text-gray-700"
                aria-label="New conversation"
                title={georgian ? 'ახალი საუბარი' : 'New conversation'}
              >
                <RotateCcw size={15} />
              </button>
              <button onClick={() => handleOpenChange(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-600 text-sm py-6 px-2 space-y-2">
                <p>Hi {session.user.name || 'there'}! 👋</p>
                <p>
                  Tell me in your own words what is wrong or what you would like to change. I will ask a few short
                  questions and write a clear request for the developers.
                </p>
                <p className="text-gray-500">
                  მომწერეთ თქვენი სიტყვებით, რა არ მუშაობს ან რისი შეცვლა გსურთ. დაგისვამთ რამდენიმე მოკლე კითხვას და
                  დავწერ მკაფიო მოთხოვნას.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-blue-500 text-white whitespace-pre-wrap break-words">
                        {msg.display}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex flex-col items-start gap-2">
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        msg.kind === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      {msg.display}
                    </div>
                    {msg.kind === 'question' && msg.questions && msg.questions.length > 0 && (
                      <div className="w-[90%] space-y-2">
                        {msg.questions.map((q, qi) => (
                          <div key={qi} className="rounded-lg border border-blue-200 bg-white px-3 py-2">
                            <p className="text-sm text-gray-900">
                              {msg.questions!.length > 1 ? `${qi + 1}. ` : ''}
                              {q.question}
                            </p>
                            {q.options.length > 0 && msg.id === lastMessage?.id && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {q.options.map((option, oi) => (
                                  <button
                                    key={oi}
                                    onClick={() => handleOptionClick(q, option, msg.questions!.length)}
                                    disabled={isLoading}
                                    className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.kind === 'request' && msg.requestMarkdown && (
                      <RequestCard
                        message={msg}
                        georgian={georgian}
                        isLatest={msg.id === latestRequestId}
                        onSubmit={handleSubmitRequest}
                        onChangeRequested={handleChangeRequested}
                      />
                    )}
                  </div>
                );
              })
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200 bg-white space-y-2">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={2}
                placeholder={georgian ? 'დაწერეთ აქ…' : 'Describe the problem or idea…'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleWriteNow}
                disabled={!canWriteNow || isLoading}
                className="flex items-center gap-1 rounded border border-green-600 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={georgian ? 'კითხვების გარეშე, ახლავე დაწერე მოთხოვნა' : 'Stop asking and write the request now'}
              >
                <FileCheck2 size={14} />
                {georgian ? 'მოთხოვნის დაწერა ახლავე' : 'Write request now'}
              </button>
              <button
                onClick={handleExportChat}
                disabled={messages.length === 0}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40"
                title="Export chat to text file"
              >
                <Download size={14} />
                {georgian ? 'საუბრის ექსპორტი' : 'Export chat'}
              </button>
            </div>
          </div>

          <div
            data-direction="se"
            onMouseDown={handleMouseDownResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gradient-to-tl from-blue-500 to-transparent opacity-50 hover:opacity-100 transition-opacity rounded-tl"
            title="Drag to resize"
          />
          <div
            data-direction="w"
            onMouseDown={handleMouseDownResize}
            className="absolute top-0 left-0 w-1 h-full cursor-ew-resize bg-blue-400 opacity-0 hover:opacity-30 transition-opacity"
            title="Drag left to resize"
          />
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
