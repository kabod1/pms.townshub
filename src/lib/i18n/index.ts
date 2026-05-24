/**
 * i18n — lightweight built-in translation system.
 * Wraps i18next under the hood. Languages: English (en), Greek (el), Russian (ru).
 *
 * Usage (in components):
 *   import { useTranslation } from '@/lib/i18n'
 *   const { t } = useTranslation()
 *   t('common.save')  // → 'Save' | 'Αποθήκευση' | 'Сохранить'
 */

import i18n from 'i18next'
import { initReactI18next, useTranslation as useI18nTranslation } from 'react-i18next'
import en from './en'
import el from './el'
import ru from './ru'

const STORAGE_KEY = 'pms_lang'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'el', label: 'Ελληνικά', flag: '🇨🇾' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
] as const

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]['code']

const savedLang = (localStorage.getItem(STORAGE_KEY) ?? 'en') as SupportedLang

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el },
    ru: { translation: ru },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function changeLanguage(lang: SupportedLang) {
  localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export function getCurrentLanguage(): SupportedLang {
  return (i18n.language ?? 'en') as SupportedLang
}

// Re-export hook under the project's own import path
export { useI18nTranslation as useTranslation }
export { i18n }
