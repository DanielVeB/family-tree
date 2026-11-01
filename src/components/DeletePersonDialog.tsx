import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeletePreview } from '../model/tree'

interface DeletePersonDialogProps {
  name: string
  preview: DeletePreview
  isOnlyPerson: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeletePersonDialog({
  name,
  preview,
  isOnlyPerson,
  onConfirm,
  onCancel,
}: DeletePersonDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  const showSplitWarning = preview.partCount >= 2
  const descriptionIds = [
    'delete-person-description',
    showSplitWarning ? 'delete-split-description' : null,
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled)',
      )
      if (!controls?.length) return
      const first = controls[0]!
      const last = controls[controls.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [])

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className="panel delete-person-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-person-title"
        aria-describedby={descriptionIds}
      >
        <h2 id="delete-person-title">{t('deletePersonTitle', { name })}</h2>
        <p id="delete-person-description">
          {isOnlyPerson && preview.relationshipCount === 0
            ? t('deleteOnlyPerson')
            : t('deleteRelations', { count: preview.relationshipCount })}
        </p>
        {showSplitWarning && (
          <p id="delete-split-description">
            {t('deleteSplit', { count: preview.partCount })}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={onConfirm}
          >
            {t('deleteConfirm')}
          </button>
          <button
            ref={cancelRef}
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
