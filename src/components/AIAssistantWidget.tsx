import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, X, Send, Loader2, Minimize2, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME = `Hi! I'm your TownsHub AI assistant. I can help you:

• **Set up your property** — room types, rates, amenities
• **Learn any feature** — bookings, housekeeping, F&B, reports
• **Guest AI chat** — how to share the QR link with guests
• **Daily operations** — best practices and quick tips

What would you like to know?`

const QUICK = [
  'How do I add rooms?',
  'Set up the guest AI chat',
  'How do I create a booking?',
  'Run the onboarding wizard',
]

export function AIAssistantWidget() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open])

  async function send(content: string) {
    const text = content.trim()
    if (!text || loading) return

    // Handle onboarding wizard redirect client-side
    if (text.toLowerCase().includes('onboarding wizard')) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: 'Opening the onboarding wizard now! It will guide you step by step through setting up your property with AI suggestions.' },
      ])
      setInput('')
      setTimeout(() => { setOpen(false); navigate('/onboarding') }, 1200)
      return
    }

    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      setMessages([...updated, { role: 'assistant', content: data.message ?? 'Sorry, something went wrong. Please try again.' }])
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function renderContent(text: string) {
    // Simple markdown-like bold rendering
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ))
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden"
          style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-navy">
            <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">AI Assistant</p>
              <p className="text-white/60 text-xs">TownsHub Setup & Help</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-white/60 hover:text-white transition-colors">
              <Minimize2 size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {/* Welcome message */}
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 bg-gold rounded-md flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={12} className="text-white" />
              </div>
              <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm ring-1 ring-black/5 text-sm text-gray-800 max-w-[85%]">
                {renderContent(WELCOME)}
              </div>
            </div>

            {/* Quick prompts */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pl-8">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs bg-white border border-gray-200 hover:border-gold hover:text-gold text-gray-600 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-gold rounded-md flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-navy text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 shadow-sm ring-1 ring-black/5 rounded-tl-sm'
                }`}>
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 bg-gold rounded-md flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm ring-1 ring-black/5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 bg-white border-t border-gray-100 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Ask anything…"
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-gold hover:bg-gold/90 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => { setOpen((v) => !v); setPulse(false) }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-navy hover:bg-navy/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        style={{ padding: open ? '10px' : '10px 16px 10px 12px' }}
      >
        {open ? (
          <X size={20} />
        ) : (
          <>
            <div className="relative">
              <Bot size={20} />
              {pulse && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gold rounded-full">
                  <span className="absolute inset-0 rounded-full bg-gold animate-ping opacity-75" />
                </span>
              )}
            </div>
            <span className="text-sm font-medium">AI Assistant</span>
            <Sparkles size={14} className="text-gold" />
          </>
        )}
      </button>
    </>
  )
}
