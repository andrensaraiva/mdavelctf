import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { NeonButton } from './NeonButton';

interface Message {
  id: string;
  uid: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
}

interface ChatPanelProps {
  teamId: string;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ChatPanel({ teamId }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const loadMessages = useCallback(async () => {
    try {
      const res = await apiGet('/team/chat?limit=50');
      setMessages(res.messages || []);
      setNextCursor(res.nextCursor || null);
    } catch {}
  }, []);

  const loadOlder = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiGet(`/team/chat?limit=30&cursor=${encodeURIComponent(nextCursor)}`);
      const older: Message[] = res.messages || [];
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setNextCursor(res.nextCursor || null);
      } else {
        setNextCursor(null);
      }
    } catch {}
    setLoadingMore(false);
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [teamId, loadMessages]);

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottom.current = distFromBottom < 80;
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await apiPost('/team/chat/send', { text: text.trim() });
      setText('');
      isNearBottom.current = true;
      await loadMessages();
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by day
  let lastDay = '';

  return (
    <div className="flex flex-col" style={{ height: 'min(24rem, 60vh)' }}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 p-3 border border-accent/10 mb-2 bg-black/20 rounded-sm"
      >
        {/* Load more button */}
        {nextCursor && (
          <div className="text-center py-2">
            <button
              onClick={loadOlder}
              disabled={loadingMore}
              className="text-xs text-accent/60 hover:text-accent transition-colors font-medium uppercase tracking-wider"
            >
              {loadingMore ? 'Loading...' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="text-center text-hud-text/30 text-sm py-8">No messages yet. Say hi!</p>
        )}

        {messages.map((msg) => {
          const isMe = msg.uid === user?.uid;
          const day = formatDay(msg.createdAt);
          const showDaySep = day !== lastDay;
          lastDay = day;

          return (
            <React.Fragment key={msg.id}>
              {showDaySep && (
                <div className="chat-day-sep">
                  <span>{day}</span>
                </div>
              )}
              <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    isMe ? 'bg-accent/20 text-accent' : 'bg-accent2/20 text-accent2'
                  }`}
                >
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (msg.displayName || '?')[0].toUpperCase()
                  )}
                </div>
                <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                  <div className="text-[10px] text-hud-text/40 mb-0.5">
                    <span className="font-medium">{msg.displayName}</span>
                    <span className="ml-2 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`inline-block text-sm px-3 py-1.5 rounded-sm ${
                      isMe
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'bg-panel border border-accent/10 text-hud-text/80'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input — fixed at bottom */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="terminal-input flex-1 px-3 py-2.5 text-sm"
          maxLength={500}
        />
        <NeonButton size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
          Send
        </NeonButton>
      </div>
    </div>
  );
}
