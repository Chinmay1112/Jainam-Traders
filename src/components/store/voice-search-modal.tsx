'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  Sparkles,
  Phone,
  MessageCircle,
  AlertCircle,
  Search,
} from 'lucide-react';
import { parseSearchQuery } from '@/lib/search/search-engine';
import { useShop } from '@/lib/context/shop-context';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceSearchModal({ isOpen, onClose }: VoiceSearchModalProps) {
  const router = useRouter();
  const { shop } = useShop();
  const [lang, setLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Tap the microphone and speak / माइक दबाकर बोलें');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  // Reference to native recognition instance
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const speakConfirmation = useCallback(
    (text: string) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang;
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        } catch {
          // Ignore speech synthesis failures
        }
      }
    },
    [lang]
  );

  const handleVoiceSubmit = useCallback(
    (spokenQuery: string) => {
      stopListening();
      const clean = spokenQuery.trim();
      if (!clean) return;

      const parsed = parseSearchQuery(clean);
      const queryText = parsed.cleanedText || clean;
      const spokenAck =
        lang === 'hi-IN'
          ? `दुकान में खोज रहे हैं: ${queryText}`
          : `Searching store catalogue for: ${queryText}`;
      speakConfirmation(spokenAck);

      onClose();
      const params = new URLSearchParams();
      params.set('q', queryText);
      if (parsed.inferredMaxPrice) {
        params.set('maxPrice', String(parsed.inferredMaxPrice));
      }
      if (parsed.inferredMinPrice) {
        params.set('minPrice', String(parsed.inferredMinPrice));
      }
      router.push(`/search?${params.toString()}`);
    },
    [lang, onClose, router, speakConfirmation, stopListening]
  );

  const startListening = useCallback(() => {
    setErrorMessage('');
    setTranscript('');
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRec();
      rec.lang = lang;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onstart = () => {
        setIsListening(true);
        setStatusMessage(
          lang === 'hi-IN'
            ? 'सुन रहे हैं... जैसे "फोटो फ्रेम दिखाओ" या "500 के अंदर गिफ्ट"'
            : 'Listening... say "Photo frame" or "Gifts under 500"'
        );
      };

      rec.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);

        if (event.results[current].isFinal) {
          handleVoiceSubmit(text);
        }
      };

      rec.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone in browser settings.');
        } else if (event.error === 'no-speech') {
          setErrorMessage('No speech detected. Please tap microphone to try again.');
        } else {
          setErrorMessage(`Speech recognition error: ${event.error}. You can use visual choices below.`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      setErrorMessage('Could not initialize microphone. Please choose an option below.');
    }
  }, [handleVoiceSubmit, lang]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      setStatusMessage('Voice recognition is not supported in this browser. Use buttons below.');
    }
  }, []);

  // Start listening automatically when opened
  useEffect(() => {
    if (isOpen && isSupported) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isOpen, isSupported, startListening, stopListening]);
  const handleDirectSearch = (keyword: string, maxPrice?: number) => {
    stopListening();
    onClose();
    if (maxPrice) {
      router.push(`/search?q=${encodeURIComponent(keyword)}&maxPrice=${maxPrice}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(keyword)}`);
    }
  };

  if (!isOpen) return null;

  const visualSuggestions = [
    { label: 'फोटो फ्रेम (Photo Frames)', icon: '🖼️', query: 'Photo Frame' },
    { label: 'दीवार घड़ी (Wall Clocks)', icon: '⏰', query: 'Clock' },
    { label: 'हाथ की घड़ी (Watches)', icon: '⌚', query: 'Watch' },
    { label: 'भगवान की मूर्ति (Idols)', icon: '🪔', query: 'Ganesha' },
    { label: 'पर्स / बेल्ट (Purses & Belts)', icon: '👜', query: 'Leather' },
    { label: 'परफ्यूम (Perfume)', icon: '✨', query: 'Perfume' },
    { label: '₹500 के अंदर गिफ्ट', icon: '🎁', query: 'Gift', maxPrice: 500 },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voice Search Assistant"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-stone-100 p-6 flex flex-col items-center text-center relative animate-slide-up">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopListening();
            onClose();
          }}
          aria-label="Close voice search modal"
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Language Switcher */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-full mb-4">
          <button
            type="button"
            onClick={() => setLang('hi-IN')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
              lang === 'hi-IN' ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            हिंदी (Hindi)
          </button>
          <button
            type="button"
            onClick={() => setLang('en-IN')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
              lang === 'en-IN' ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            English
          </button>
        </div>

        {/* Animated Microphone Target */}
        <div className="relative my-4">
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping duration-1000" />
          )}
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 ${
              isListening
                ? 'bg-gradient-to-tr from-brand-600 to-amber-600 text-white scale-105'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {isListening ? <Mic className="w-10 h-10 animate-pulse" /> : <MicOff className="w-10 h-10" />}
          </button>
        </div>

        {/* Live Status and Transcript */}
        <p className="text-sm font-semibold text-stone-700 min-h-[24px]">
          {isListening ? (
            <span className="text-brand-600 font-bold flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping" />
              {statusMessage}
            </span>
          ) : (
            statusMessage
          )}
        </p>

        {transcript ? (
          <div className="mt-3 p-3 bg-brand-50/70 border border-brand-200 rounded-xl w-full text-center">
            <span className="text-xs text-brand-800 font-medium block">सुनाई दिया (Heard):</span>
            <span className="text-base font-extrabold text-stone-900 mt-0.5 block">&ldquo;{transcript}&rdquo;</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl w-full flex items-center gap-2 text-rose-800 text-xs text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {/* Non-Voice Fallback Suggestions (Low-Literacy Friendly) */}
        <div className="w-full mt-6 border-t border-stone-100 pt-4 text-left">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2 text-center">
            या छूकर चुनें (Or Tap to Choose)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {visualSuggestions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleDirectSearch(item.query, item.maxPrice)}
                className="flex items-center gap-2 p-2.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-200 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 transition-all text-left active-press"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direct Human Help Links */}
        {(shop.phone || shop.whatsappNumber) && (
          <div className="w-full mt-4 pt-3 border-t border-stone-100 flex items-center justify-around text-xs font-bold text-stone-600">
            {shop.phone ? (
              <a
                href={`tel:${shop.phone.replace(/\s+/g, '')}`}
                className="flex items-center gap-1.5 hover:text-brand-600 p-2 rounded-lg"
              >
                <Phone className="w-4 h-4 text-emerald-600" /> दुकान पर कॉल करें (Call Shop)
              </a>
            ) : null}
            {shop.whatsappNumber ? (
              <a
                href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=Namaste%2C%20I%20need%20help%20with%20a%20product`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-brand-600 p-2 rounded-lg"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
