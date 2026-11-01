import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ReplaceTreeDialogProps {
  onReplace: () => void
  onCancel: () => void
}

export default function ReplaceTreeDialog({
  onReplace,
  onCancel,
}: ReplaceTreeDialogProps) {
  const { t } = useTranslation()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', cancelOnEscape, true)
    return () => window.removeEventListener('keydown', cancelOnEscape, true)
  }, [onCancel])

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="panel replace-tree-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-tree-title"
      >
        <h2 id="replace-tree-title">{t('importConfirmTitle')}</h2>
        <p>{t('importConfirmText')}</p>
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={onReplace}
          >
            {t('importReplace')}
          </button>
          <button
            ref={cancelButtonRef}
            className="button button--ghost"
            type="button"
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
        </div>
      </section>
    </div>
  )
}
