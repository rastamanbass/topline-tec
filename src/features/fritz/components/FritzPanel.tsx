import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot } from 'lucide-react';
import { useModal } from '../../../hooks/useModal';
import { useFritzStore } from '../stores/fritzStore';
import { useFritz } from '../hooks/useFritz';
import type { FritzMessage } from '../types';

export function FritzPanel() {
  const { isOpen, setOpen, messages, isLoading } = useFritzStore();
  const { sendMessage } = useFritz();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { dialogRef } = useModal(() => setOpen(false));

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-[55] md:inset-auto md:bottom-20 md:right-4 md:w-[400px] md:h-[70vh] flex flex-col">
      {/* Backdrop on mobile */}
      <div className="md:hidden absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />

      <div
        ref={dialogRef}
        className="relative flex flex-col bg-[#0f0a2e] rounded-t-2xl md:rounded-2xl
          shadow-2xl overflow-hidden mt-auto md:mt-0 max-h-[85vh] md:max-h-full h-[80vh] md:h-full
          animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-900/50 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
            flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-white text-sm font-bold">Fritz</div>
            <div className="text-green-400 text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Online
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-50" />
              <p className="text-indigo-300 text-sm">
                Hola, soy Fritz. Decime en qué te ayudo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {[
                  'cuántos phones hay en stock?',
                  'ventas de hoy',
                  'alertas pendientes',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-3 py-1.5 text-xs bg-indigo-900/50 text-indigo-300
                      rounded-lg hover:bg-indigo-800/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-2 bg-indigo-950 rounded-xl px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribile a Fritz..."
              maxLength={500}
              disabled={isLoading}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-indigo-400/50
                outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center
                text-white hover:bg-indigo-500 transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: FritzMessage }) {
  const isUser = message.role === 'user';

  if (message.isLoading) {
    return (
      <div className="flex justify-start">
        <div className="bg-indigo-950 rounded-xl rounded-bl-sm px-4 py-3 max-w-[85%]">
          <div className="flex items-center gap-2 text-indigo-300 text-xs">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse delay-100" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse delay-200" />
            </div>
            Pensando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-indigo-950 text-gray-200 rounded-bl-sm'
        }`}
      >
        {message.content}

        {/* Info card */}
        {message.action?.type === 'info_card' && (
          <div className="mt-2 p-2 bg-indigo-900/50 rounded-lg text-xs text-indigo-200">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(message.action.data, null, 2)}
            </pre>
          </div>
        )}

        {/* Confirmation card */}
        {message.action?.type === 'confirmation' && (
          <div className="mt-2 flex items-center gap-2 bg-green-900/30 rounded-lg px-3 py-2">
            <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
              ✓
            </span>
            <span className="text-green-300 text-xs font-medium">Operación completada</span>
          </div>
        )}
      </div>
    </div>
  );
}
