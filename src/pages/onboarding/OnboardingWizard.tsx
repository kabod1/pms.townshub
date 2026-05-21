import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ArrowRight, Trash2, Loader2, Check, Sparkles } from 'lucide-react'
import { useCreateRoomType } from '@/hooks/useRooms'
import { useAuthStore } from '@/store/authStore'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

type SuggestedRoomType = {
  name: string
  description: string
  base_price: number
  max_occupancy: number
  max_children: number
  bed_type: string
  size_sqm: number | null
  amenities: string[]
}

const STEPS = ['Describe', 'Review', 'Done']

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { tenant, isLoading, isInitialized } = useAuthStore()
  const createRoomType = useCreateRoomType()

  if (!isInitialized || isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-light"><LoadingSpinner /></div>
  }
  if (!tenant) {
    navigate('/auth/login', { replace: true })
    return null
  }

  const [step, setStep] = useState(0)
  const [description, setDescription] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedRoomType[]>([])
  const [saving, setSaving] = useState(false)

  async function handleAnalyse() {
    if (!description.trim()) return
    setAnalysing(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!data.roomTypes?.length) throw new Error('No suggestions returned')
      setSuggestions(data.roomTypes)
      setStep(1)
    } catch {
      toast.error('Could not generate suggestions. Please try again.')
    } finally {
      setAnalysing(false)
    }
  }

  async function handleSave() {
    if (!suggestions.length || !tenant) return
    setSaving(true)
    try {
      for (let i = 0; i < suggestions.length; i++) {
        const rt = suggestions[i]
        await createRoomType.mutateAsync({
          name: rt.name,
          description: rt.description || null,
          base_price: rt.base_price,
          max_occupancy: rt.max_occupancy,
          max_children: rt.max_children ?? 1,
          bed_type: rt.bed_type || null,
          size_sqm: rt.size_sqm ?? null,
          amenities: rt.amenities ?? [],
          is_active: true,
          sort_order: i,
          photos: null,
        })
      }
      setStep(2)
    } catch {
      toast.error('Failed to save room types. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof SuggestedRoomType>(
    index: number,
    field: K,
    value: SuggestedRoomType[K]
  ) {
    setSuggestions((prev) =>
      prev.map((rt, i) => (i === index ? { ...rt, [field]: value } : rt))
    )
  }

  return (
    <div className="min-h-screen bg-light flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <Bot size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-body">Welcome to TownsHub PMS</h1>
          <p className="text-subtext mt-1 text-sm">Set up your property in under 2 minutes with AI</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step > i
                      ? 'bg-green-500 text-white'
                      : step === i
                      ? 'bg-gold text-white'
                      : 'bg-mid text-subtext'
                  }`}
                >
                  {step > i ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-sm ${step === i ? 'text-body font-medium' : 'text-subtext'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-px ${step > i ? 'bg-green-400' : 'bg-mid'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 — Describe */}
        {step === 0 && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-mid p-6">
            <h2 className="text-base font-semibold text-body mb-1">Tell us about your property</h2>
            <p className="text-sm text-subtext mb-4">
              Describe your hotel — location, star rating, room types, and typical price range. Our
              AI will suggest room types and pricing for you.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g. We're a 4-star beachfront hotel in Limassol, Cyprus with 45 rooms: standard sea-view doubles, superior balcony rooms, junior suites, and 2 presidential suites. Nightly rates range from €120 to €600."
              className="w-full rounded-xl border border-mid px-3 py-2.5 text-sm text-body placeholder:text-subtext focus:outline-none focus:ring-2 focus:ring-gold resize-none"
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-subtext hover:text-body transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleAnalyse}
                disabled={analysing || !description.trim()}
                className="flex items-center gap-2 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                {analysing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Generate Room Types
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Review & edit suggestions */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Here are your AI-suggested room types. Edit any detail inline before saving.
              </p>
            </div>

            {suggestions.map((rt, i) => (
              <div key={i} className="bg-white rounded-xl ring-1 ring-mid p-5">
                <div className="flex items-start gap-2 mb-3">
                  <input
                    value={rt.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    className="flex-1 font-semibold text-body bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none text-base"
                  />
                  <button
                    onClick={() => setSuggestions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-subtext hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <input
                  value={rt.description}
                  onChange={(e) => update(i, 'description', e.target.value)}
                  placeholder="Description"
                  className="text-sm text-subtext bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none w-full mb-4"
                />

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-subtext mb-0.5">Price / night</p>
                    <div className="flex items-center gap-0.5">
                      <span className="text-xs text-subtext">€</span>
                      <input
                        type="number"
                        value={rt.base_price}
                        onChange={(e) => update(i, 'base_price', Number(e.target.value))}
                        className="w-full text-sm font-bold text-navy bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-subtext mb-0.5">Max Adults</p>
                    <input
                      type="number"
                      value={rt.max_occupancy}
                      onChange={(e) => update(i, 'max_occupancy', Number(e.target.value))}
                      className="w-full text-sm bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-subtext mb-0.5">Max Children</p>
                    <input
                      type="number"
                      value={rt.max_children}
                      onChange={(e) => update(i, 'max_children', Number(e.target.value))}
                      className="w-full text-sm bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-subtext mb-0.5">Size (m²)</p>
                    <input
                      type="number"
                      value={rt.size_sqm ?? ''}
                      onChange={(e) =>
                        update(i, 'size_sqm', e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full text-sm bg-transparent border-b border-transparent hover:border-mid focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>

                {rt.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {rt.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-light px-2 py-0.5 text-xs text-subtext">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep(0)}
                className="text-sm text-subtext hover:text-body transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || suggestions.length === 0}
                className="flex items-center gap-2 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Save {suggestions.length} Room Type{suggestions.length !== 1 ? 's' : ''}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
          <div className="bg-white rounded-2xl ring-1 ring-mid p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-body mb-2">You're all set!</h2>
            <p className="text-subtext text-sm mb-6">
              {suggestions.length} room type{suggestions.length !== 1 ? 's' : ''} created. Now add
              individual rooms and you're ready to take bookings.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/rooms/types')}
                className="text-sm border border-mid rounded-xl px-4 py-2.5 text-body hover:bg-light transition-colors"
              >
                View Room Types
              </button>
              <button
                onClick={() => navigate('/rooms')}
                className="text-sm bg-gold text-white rounded-xl px-4 py-2.5 hover:bg-gold/90 transition-colors font-medium"
              >
                Add Rooms →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
