'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Phone, Sparkles, AlertCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export default function AiSupportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'Namaste! Welcome to Jainam Traders. How can I help you today? You can ask me about product prices, store opening hours, pickup instructions, or order status.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/support/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'Thank you for your message. How else may I assist you?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data.escalateToHuman) {
        setShowEscalation(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: 'Our AI assistant is temporarily unavailable. Please call us at +91 98765 43210 or chat with us on WhatsApp.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 bg-gradient-to-r from-brand-600 to-amber-600 text-white p-3.5 rounded-full shadow-elevated hover:shadow-brand-500/30 hover:scale-105 active-press transition-all flex items-center gap-2 ${
          isOpen ? 'hidden' : 'flex'
        }`}
        title="Jainam AI Assistant"
      >
        <Bot className="w-5 h-5" />
        <span className="text-xs font-bold hidden sm:inline">Store Assistant</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[92vw] sm:w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-stone-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-amber-400 font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  Jainam Traders Assistant
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </h3>
                <p className="text-[11px] text-stone-400">Live store catalog & pickup guide</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-white p-1 rounded-full hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick chips */}
          <div className="bg-stone-100/90 px-3 py-2 flex items-center gap-1.5 overflow-x-auto text-[11px] border-b border-stone-200 no-scrollbar">
            <button
              type="button"
              onClick={() => handleSendMessage('What are your store hours and address?')}
              className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-full font-medium whitespace-nowrap text-stone-700 transition-colors"
            >
              Store Hours
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Show me photo frames and prices')}
              className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-full font-medium whitespace-nowrap text-stone-700 transition-colors"
            >
              Photo Frames
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('What is your return and pickup policy?')}
              className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-full font-medium whitespace-nowrap text-stone-700 transition-colors"
            >
              Return Policy
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-stone-900 text-amber-400 flex items-center justify-center shrink-0 text-xs shadow-sm">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-none shadow-sm'
                      : 'bg-white text-stone-800 border border-stone-200/90 rounded-tl-none shadow-sm whitespace-pre-line'
                  }`}
                >
                  {m.text}
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      m.sender === 'user' ? 'text-brand-100' : 'text-stone-400'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>

                {m.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center text-xs text-stone-500 py-1">
                <Bot className="w-4 h-4 text-stone-400 animate-spin" />
                <span>Checking store database...</span>
              </div>
            )}

            {showEscalation && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600" /> Need human store assistance?
                </div>
                <div className="flex gap-2">
                  <a
                    href="https://wa.me/919876543210"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 text-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                  >
                    WhatsApp Shop
                  </a>
                  <a
                    href="tel:+919876543210"
                    className="flex-1 py-1.5 text-center bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-bold"
                  >
                    Call Store
                  </a>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-stone-200 flex gap-2"
          >
            <input
              type="text"
              placeholder="Ask about items, timings, or orders..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-100 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-2 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white rounded-xl shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
