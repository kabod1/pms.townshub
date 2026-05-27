/**
 * i18n — react-i18next configuration.
 * Languages: EN, AR, EL, FR, DE, ES, IT, PT, NL, PL, RO, CS, HU, SV, TR, RU
 * Arabic uses RTL layout — apply dir="rtl" to <html> when lang === 'ar'.
 *
 * Usage (in components):
 *   import { useTranslation } from '@/lib/i18n'
 *   const { t } = useTranslation()
 *   t('common.save')  // → locale-specific string
 */

import i18n from 'i18next'
import { initReactI18next, useTranslation as useI18nTranslation } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

export const STORAGE_KEY = 'townshub_lang'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧', rtl: false },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦', rtl: true  },
  { code: 'el', label: 'Ελληνικά',   flag: '🇬🇷', rtl: false },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', rtl: false },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', rtl: false },
  { code: 'es', label: 'Español',    flag: '🇪🇸', rtl: false },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹', rtl: false },
  { code: 'pt', label: 'Português',  flag: '🇵🇹', rtl: false },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', rtl: false },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱', rtl: false },
  { code: 'ro', label: 'Română',     flag: '🇷🇴', rtl: false },
  { code: 'cs', label: 'Čeština',    flag: '🇨🇿', rtl: false },
  { code: 'hu', label: 'Magyar',     flag: '🇭🇺', rtl: false },
  { code: 'sv', label: 'Svenska',    flag: '🇸🇪', rtl: false },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷', rtl: false },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺', rtl: false },
] as const

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]['code']

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)

/** Resolve the initial language: stored pref → browser lang → 'en' */
function resolveInitialLang(): SupportedLang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_CODES.includes(stored as SupportedLang)) {
    return stored as SupportedLang
  }
  const browser = navigator.language.slice(0, 2)
  if (SUPPORTED_CODES.includes(browser as SupportedLang)) {
    return browser as SupportedLang
  }
  return 'en'
}

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: resolveInitialLang(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_CODES,
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    detection: {
      // We manage detection ourselves; disable automatic write-back
      order: [],
      caches: [],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })

/** Apply or remove RTL direction on the root <html> element */
function applyRtl(lang: string) {
  const isRtl = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.rtl ?? false
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', lang)
}

// Apply on init
applyRtl(resolveInitialLang())

export function changeLanguage(lang: SupportedLang) {
  localStorage.setItem(STORAGE_KEY, lang)
  applyRtl(lang)
  i18n.changeLanguage(lang)
}

export function getCurrentLanguage(): SupportedLang {
  const lang = i18n.language?.slice(0, 2) ?? 'en'
  return (SUPPORTED_CODES.includes(lang as SupportedLang) ? lang : 'en') as SupportedLang
}

export function isRTL(lang?: string): boolean {
  const code = (lang ?? getCurrentLanguage()) as SupportedLang
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false
}

// Re-export hook under the project's own import path
export { useI18nTranslation as useTranslation }
export { i18n }
