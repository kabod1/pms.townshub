/**
 * LanguageSwitcher
 * A polished flag-based language picker that works on all screen sizes.
 * Clicking the trigger opens a floating grid of all 16 supported languages.
 * Selecting a language persists it to localStorage, updates i18next, and
 * applies RTL direction for Arabic.
 */
import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import {
  SUPPORTED_LANGUAGES,
  changeLanguage,
  getCurrentLanguage,
  type SupportedLang,
} from '@/lib/i18n'

interface Props {
  /** 'topbar' = compact globe button (for dashboard header).
   *  'footer' = block list (e.g. landing page footer). */
  variant?: 'topbar' | 'footer'
}

export function LanguageSwitcher({ variant = 'topbar' }: Props) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<SupportedLang>(getCurrentLanguage)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function select(code: SupportedLang) {
    setCurrent(code)
    changeLanguage(code)
    setOpen(false)
  }

  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === current)

  // ── Footer variant — flat list ─────────────────────────────────────────────
  if (variant === 'footer') {
    return (
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => select(lang.code)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              current === lang.code
                ? 'bg-white/20 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/10'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // ── Topbar variant — globe button + floating dropdown ─────────────────────
  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-light ${
          open
            ? 'border-blue bg-light text-body'
            : 'border-mid bg-white text-subtext hover:text-body'
        }`}
        title="Change language"
        aria-label={`Language: ${activeLang?.label}`}
        aria-expanded={open}
      >
        <Globe size={13} />
        <span className="hidden sm:inline">{activeLang?.flag} {activeLang?.label}</span>
        <span className="sm:hidden">{activeLang?.flag}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl bg-white border border-mid shadow-xl overflow-hidden"
          role="listbox"
          aria-label="Select language"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-mid bg-gray-50">
            <p className="text-xs font-semibold text-subtext uppercase tracking-wider">
              Choose language
            </p>
          </div>

          {/* Language grid */}
          <div className="p-2 grid grid-cols-2 gap-1 max-h-72 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = current === lang.code
              return (
                <button
                  key={lang.code}
                  onClick={() => select(lang.code)}
                  role="option"
                  aria-selected={isActive}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                    isActive
                      ? 'bg-navy text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base leading-none">{lang.flag}</span>
                  <div className="min-w-0">
                    <p className={`font-medium text-xs truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
                      {lang.label}
                    </p>
                    <p className={`text-[10px] uppercase tracking-wide ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                      {lang.code}
                      {lang.rtl && <span className="ml-1 text-amber-500">RTL</span>}
                    </p>
                  </div>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="px-4 py-2 border-t border-mid bg-gray-50">
            <p className="text-[10px] text-gray-400">
              16 languages supported · preference saved locally
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
