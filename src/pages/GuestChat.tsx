import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Bot, User, Loader2, MessageCircle } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  "What's on the menu?",
  'Beach recommendations?',
  'Can I get room service?',
  'What time is breakfast?',
]

export default function GuestChat() {
  const { slug } = useParams<{ slug: string }>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [setupDone, setSetupDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(`chat_${slug}`)
    if (saved) {
      try {
        const { sessionId: sid, guestName: gn, roomNumber: rn, messages: msgs } = JSON.parse(saved)
        setSessionId(sid)
        setGuestName(gn ?? '')
        setRoomNumber(rn ?? '')
        setMessages(msgs ?? [])
        setSetupDone(true)
      } catch {
        // ignore parse errors
      }
    }
  }, [slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(content: string) {
    const text = content.trim()
    if (!text || loading) return

    const updated: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai?action=chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slug,
          messages: updated,
          sessionId,
          guestName: guestName || undefined,
          roomNumber: roomNumber || undefined,
        }),
      })

      const data = await res.json()
      const withReply: ChatMessage[] = [
        ...updated,
        { role: 'assistant', content: data.message ?? "I'm sorry, I couldn't process that. Please try again." },
      ]
      setMessages(withReply)

      const activeSid = data.sessionId ?? sessionId
      if (activeSid && !sessionId) setSessionId(activeSid)

      localStorage.setItem(
        `chat_${slug}`,
        JSON.stringify({ sessionId: activeSid, guestName, roomNumber, messages: withReply })
      )
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "I'm having trouble connecting right now. Please try again or contact the front desk.",
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function startChat(skipIntro = false) {
    setSetupDone(true)
    if (!skipIntro) {
      const greeting = guestName
        ? `Hello! I'm ${guestName}${roomNumber ? `, staying in room ${roomNumber}` : ''}. I'd love to know more about the hotel and your services!`
        : "Hello! I just arrived and I'd love to know more about the hotel and your services!"
      sendMessage(greeting)
    }
  }

  if (!setupDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
              <Bot size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">AI Concierge</h1>
            <p className="text-slate-400 mt-1 text-sm">Your personal hotel assistant</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <p className="text-sm text-gray-500 mb-4 text-center">
              Optionally tell us who you are to personalise your experience
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Your name
                </label>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startChat()}
                  placeholder="e.g. John Smith"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Room number
                </label>
                <input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startChat()}
                  placeholder="e.g. 204"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <button
              onClick={() => startChat()}
              className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 transition-colors shadow-md"
            >
              Start Chatting
            </button>
            <button
              onClick={() => { setSetupDone(true) }}
              className="mt-2 w-full text-sm text-gray-400 hover:text-gray-600 py-1 transition-colors"
            >
              Skip →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center gap-3 border-b border-slate-700 shrink-0">
        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-md">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm leading-tight">AI Concierge</p>
          <p className="text-slate-400 text-xs">Always here to help</p>
        </div>
        {guestName && (
          <span className="text-xs text-amber-400 font-medium">
            Hi, {guestName.split(' ')[0]}!
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <MessageCircle size={36} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-5">How can I help you today?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-white rounded-br-sm'
                  : 'bg-slate-700 text-slate-100 rounded-bl-sm'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 bg-slate-600 rounded-lg flex items-center justify-center shrink-0">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-end">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Ask me anything…"
            className="flex-1 bg-slate-700 text-white placeholder:text-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
