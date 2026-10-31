import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function App() {
  const { i18n, t } = useTranslation()

  useEffect(() => {
    document.title = t('documentTitle')
  }, [i18n.language, t])

  const changeLanguage = (language: 'en' | 'pl') => {
    window.localStorage.setItem('family-tree-language', language)
    void i18n.changeLanguage(language)
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          {t('appName')}
        </a>
        <div
          className="language-toggle"
          role="group"
          aria-label={t('language')}
        >
          <button
            type="button"
            aria-pressed={i18n.language === 'en'}
            onClick={() => changeLanguage('en')}
          >
            {t('englishShort')}
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            aria-pressed={i18n.language === 'pl'}
            onClick={() => changeLanguage('pl')}
          >
            {t('polishShort')}
          </button>
        </div>
      </header>

      <main className="empty-state">
        <div className="empty-state__content">
          <h1>{t('welcomeTitle')}</h1>
          <p>{t('welcomeDescription')}</p>
          <div className="empty-state__actions">
            <button
              className="button button--primary"
              type="button"
              disabled
              aria-disabled="true"
            >
              {t('startTree')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled
              aria-disabled="true"
            >
              {t('importFile')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
