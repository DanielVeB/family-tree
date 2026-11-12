import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface DriveLinkDialogProps {
  busy: boolean
  onOpen: (link: string) => void
  onCancel: () => void
}

export default function DriveLinkDialog({
  busy,
  onOpen,
  onCancel,
}: DriveLinkDialogProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
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
    onOpen(link)
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section
        className="panel drive-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-link-title"
      >
        <h2 id="drive-link-title">{t('driveLink.openTitle')}</h2>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="drive-link-input">{t('driveLink.label')}</label>
            <input
              id="drive-link-input"
              ref={inputRef}
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={t('driveLink.placeholder')}
              disabled={busy}
            />
          </div>
          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? t('driveLink.opening') : t('driveLink.openAction')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={onCancel}
              disabled={busy}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
