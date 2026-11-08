import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeFileName } from '../io/exportTree'

interface NameExportDialogProps {
  suggestedName: string
  onExport: (filename: string) => void
  onCancel: () => void
}

export default function NameExportDialog({
  suggestedName,
  onExport,
  onCancel,
}: NameExportDialogProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(suggestedName.replace(/\.json$/i, ''))
  const [error, setError] = useState<'empty' | 'tooLong' | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', cancelOnEscape, true)
    return () => window.removeEventListener('keydown', cancelOnEscape, true)
  }, [onCancel])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = normalizeFileName(name)
    if (!result.ok) {
      setError(result.reason)
      inputRef.current?.focus()
      return
    }
    onExport(result.name)
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="panel name-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-export-title"
      >
        <h2 id="name-export-title">{t('exportNameTitle')}</h2>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="export-file-name">{t('exportNameLabel')}</label>
            <div className="export-name-input">
              <input
                id="export-file-name"
                ref={inputRef}
                value={name}
                aria-invalid={error !== null}
                aria-describedby={
                  error ? 'export-name-error' : 'export-name-hint'
                }
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
              />
              <span aria-hidden="true">.json</span>
            </div>
            <span className="field__hint" id="export-name-hint">
              {t('exportDuplicateHint')}
            </span>
            {error && (
              <span
                className="field__error"
                id="export-name-error"
                role="alert"
              >
                {error === 'empty'
                  ? t('exportNameErrorEmpty')
                  : t('nameTooLong', { max: 100 })}
              </span>
            )}
          </div>
          <div className="form-actions">
            <button className="button button--primary" type="submit">
              {t('exportButton')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={onCancel}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
