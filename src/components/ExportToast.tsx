import { useTranslation } from 'react-i18next'

interface ExportToastProps {
  filename: string | null
  error: boolean
  onClose: () => void
}

export default function ExportToast({
  filename,
  error,
  onClose,
}: ExportToastProps) {
  const { t } = useTranslation()
  if (!filename && !error) return null

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
      {error ? (
        <p>{t('exportError')}</p>
      ) : (
        <>
          <p>{t('exportToastTitle', { filename })}</p>
          <p className="export-toast__privacy">{t('exportToastPrivacy')}</p>
        </>
      )}
    </div>
  )
}
