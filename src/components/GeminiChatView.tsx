import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  HelpCircle,
  Flame,
} from 'lucide-react';
import type { DatabaseSchema } from '../store/database';
import { formatIST } from '../utils/deduplication';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface GeminiChatViewProps {
  db: DatabaseSchema;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
}

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  db,
  deliveryMenMap,
  usersMap,
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    return [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `Namaste! I am your AI Operations & Deduplication Specialist for **${db.settings.agencyName}**.\n\nI can assist you with:\n- Checking duplicate entries for today\n- Analyzing delivery boy performance\n- Explaining consumer number formats (BH-0, CX, DX, 10-digit)\n- LPG cylinder weights (14.2 kg net, 15.8 kg tare, 30.0 kg gross)\n- Gas safety, ethyl mercaptan odorant science, and emergency procedures.\n\nHow can I help you today?`,
        timestamp: formatIST().timeIST,
        modelUsed: 'gemini-3.8-flash',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite'>('gemini-3.8-flash');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const quickPrompts = [
    "What are today's duplicate cylinder entries?",
    'What is the standard tare and gross weight of a 14.2kg cylinder?',
    'Which delivery man has delivered the most cylinders today?',
    'Why is ethyl mercaptan added to LPG and what is its detection threshold?',
    'How do I bulk import 500+ customer records from Excel?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: formatIST().timeIST,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setErrorBanner(null);

    // Calculate current live statistics to give context to Gemini
    const todayIST = formatIST().dateIST;
    const todayEntries = db.consumer_entries.filter((e) => e.entry_date_ist === todayIST);
    const todayDuplicates = todayEntries.filter((e) => e.duplicate_today);

    const systemInstruction = `You are the operations assistant for ${db.settings.agencyName} (${db.settings.agencyCode}).
Live Agency Context:
- Current Date (IST): ${todayIST}
- Total registered customers: ${db.customers.length}
- Today's total cylinder delivery entries: ${todayEntries.length}
- Today's duplicate deliveries: ${todayDuplicates.length}
- Active delivery staff count: ${db.delivery_men.filter((d) => d.active).length}
- Supported consumer number formats: standard numeric (e.g., 0012345678), BH-0 prefixes (e.g., BH-01001), CX prefixes (e.g., CX2001), DX prefixes (e.g., DX3001).
Provide accurate, courteous, and actionable answers using this live context.`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemInstruction,
          model: selectedModel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server returned an error');
      }

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Response received.',
        timestamp: formatIST().timeIST,
        modelUsed: selectedModel,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorBanner(err.message || 'Could not connect to Gemini API.');

      // Add intelligent local fallback response
      let localFallback = "I'm currently unable to reach the live Gemini endpoint, but here is instant agency data:\n";
      if (text.toLowerCase().includes('duplicate')) {
        localFallback += `• Today (${todayIST}) there are **${todayDuplicates.length}** duplicate entries out of **${todayEntries.length}** total deliveries. You can review them in the **Daily Duplication** tab.`;
      } else if (text.toLowerCase().includes('weight') || text.toLowerCase().includes('tare')) {
        localFallback += `• Standard Domestic Cylinder Specifications:\n  - Tare Weight (Empty Cylinder): **15.8 kg**\n  - Net Gas Weight: **14.2 kg**\n  - Gross Weight (Filled): **30.0 kg** (±150g permissible tolerance).`;
      } else if (text.toLowerCase().includes('mercaptan') || text.toLowerCase().includes('smell') || text.toLowerCase().includes('odor')) {
        localFallback += `• LPG is naturally odorless and colorless. Ethyl Mercaptan (Ethanethiol, C2H5SH) is dosed at ~20 ppm by weight. The human olfactory threshold is extremely sensitive at **0.5 ppb**, allowing early detection long before the gas reaches its Lower Explosive Limit (LEL 2.1%).`;
      } else {
        localFallback += `• Agency: ${db.settings.agencyName}\n• Total Customers: ${db.customers.length}\n• Today's Entries: ${todayEntries.length}\n• Connect your Gemini API Key in Settings > Secrets for advanced generative conversations.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          role: 'assistant',
          content: localFallback,
          timestamp: formatIST().timeIST,
          modelUsed: `${selectedModel} (Local Knowledge)`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: `Chat history cleared. How can I assist you with your LPG operations?`,
        timestamp: formatIST().timeIST,
        modelUsed: selectedModel,
      },
    ]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Gemini Operations Assistant
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Multi-Turn AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Real-time operational queries, duplicate audits, and LPG gas technical support
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.8-flash')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedModel === 'gemini-3.8-flash'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                gemini-3.8-flash
              </button>
              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                gemini-3.1-flash-lite (Fast)
              </button>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-rose-600 transition cursor-pointer"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorBanner && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Suggestions:
        </span>
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs text-slate-700 whitespace-nowrap transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs ${
                    isUser
                      ? 'bg-slate-900'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`space-y-1.5 ${isUser ? 'items-end' : ''}`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-2xs ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-none'
                        : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{msg.modelUsed}</span>
                      </>
                    )}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-slate-600 transition cursor-pointer ml-1"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 rounded-tl-none flex items-center gap-2 text-xs text-slate-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Gemini is thinking ({selectedModel})...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about duplicate entries, cylinder specs, deliveries, or safety...`}
              disabled={isLoading}
              className="flex-1 min-h-[44px] px-4 py-2 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
