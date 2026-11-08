import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface MoveDialogProps {
  name: string
  connectedCount: number
  moveConnected: boolean
  connectedDisabled?: 'needed' | 'blocked'
  onMoveConnected: (checked: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function MoveDialog({
  name,
  connectedCount,
  moveConnected,
  connectedDisabled,
  onMoveConnected,
  onConfirm,
  onCancel,
}: MoveDialogProps) {
  const { t } = useTranslation()
  const checkboxRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    checkboxRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancelRef.current()
        return
      }
      if (event.key === 'Tab') {
        const controls = document.querySelectorAll<HTMLElement>(
          '.move-dialog button:not(:disabled), .move-dialog input:not(:disabled)',
        )
        if (!controls.length) return
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
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="dialog-backdrop">
      <section
        className="panel move-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
      >
        <h2 id="move-dialog-title">{t('layers.move.title', { name })}</h2>
        <label className="connection-option">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={moveConnected}
            disabled={Boolean(connectedDisabled)}
            aria-describedby={`move-connected-hint${connectedDisabled ? ' move-connected-reason' : ''}`}
            onChange={(event) => onMoveConnected(event.target.checked)}
          />
          <span>
            {t('layers.move.also', { count: connectedCount })}
            <span className="connection-option__hint" id="move-connected-hint">
              {t('layers.move.hint')}
            </span>
            {connectedDisabled && (
              <span
                className="connection-option__hint"
                id="move-connected-reason"
              >
                {t(
                  connectedDisabled === 'needed'
                    ? 'layers.move.reasonNeeded'
                    : 'layers.move.reasonBlocked',
                )}
              </span>
            )}
          </span>
        </label>
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={onConfirm}
          >
            {t('layers.move.confirm')}
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
