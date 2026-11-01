import { useTranslation } from 'react-i18next'

export type ToastMessage =
  | { kind: 'export-success'; filename: string }
  | { kind: 'export-error' }
  | { kind: 'import-success'; count: number }
  | { kind: 'import-error' }
  | { kind: 'delete'; name: string }
  | { kind: 'restored'; name: string }

interface ToastProps {
  message: ToastMessage | null
  onClose: () => void
  onUndo?: () => void
}

export default function Toast({ message, onClose, onUndo }: ToastProps) {
  const { t } = useTranslation()
  if (!message) return null

  return (
    <div className="export-toast" role="status" aria-live="polite">
      <button
        className="icon-pill export-toast__close"
        type="button"
        aria-label={t('exportToastClose')}
        onClick={onClose}
      >
        ×
      </button>
      {message.kind === 'export-error' || message.kind === 'import-error' ? (
        <p>
          {t(message.kind === 'import-error' ? 'importError' : 'exportError')}
        </p>
      ) : message.kind === 'import-success' ? (
        <p>{t('importSuccess', { count: message.count })}</p>
      ) : message.kind === 'delete' ? (
        <>
          <p>{t('deleteToast', { name: message.name })}</p>
          <button
            className="button button--ghost export-toast__undo"
            type="button"
            onClick={onUndo}
          >
            {t('deleteUndo')}
          </button>
        </>
      ) : message.kind === 'restored' ? (
        <p>{t('deleteRestored', { name: message.name })}</p>
      ) : (
        <>
          <p>{t('exportToastTitle', { filename: message.filename })}</p>
          <p className="export-toast__privacy">{t('exportToastPrivacy')}</p>
        </>
      )}
    </div>
  )
}
