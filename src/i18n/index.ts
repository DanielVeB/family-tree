import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import pl from './locales/pl.json'

const languageStorageKey = 'family-tree-language'
const storedLanguage = window.localStorage.getItem(languageStorageKey)

export function detectInitialLanguage(
  savedLanguage: string | null,
  browserLanguage: string,
): 'en' | 'pl' {
  if (savedLanguage === 'en' || savedLanguage === 'pl') {
    return savedLanguage
  }

  return browserLanguage.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

const initialLanguage = detectInitialLanguage(
  storedLanguage,
  window.navigator.language,
)

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

document.documentElement.lang = initialLanguage
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

export default i18n
