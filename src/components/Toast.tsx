import { useTranslation } from 'react-i18next'

export type ToastMessage =
  | { kind: 'export-success'; filename: string }
  | { kind: 'export-error' }
  | { kind: 'import-success'; count: number }
  | { kind: 'import-error' }

interface ToastProps {
  message: ToastMessage | null
  onClose: () => void
}

export default function Toast({ message, onClose }: ToastProps) {
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
      ) : (
        <>
          <p>{t('exportToastTitle', { filename: message.filename })}</p>
          <p className="export-toast__privacy">{t('exportToastPrivacy')}</p>
        </>
      )}
    </div>
  )
}
