import { useTranslation } from 'react-i18next'

export type ToastMessage =
  | {
      kind: 'export-success'
      filename: string
      updated?: boolean
      duplicateHint?: boolean
    }
  | { kind: 'export-error' }
  | { kind: 'import-success'; count: number }
  | { kind: 'import-error' }
  | { kind: 'drive-link-error' }
  | { kind: 'drive-open-access-error' }
  | { kind: 'drive-open-json-error' }
  | { kind: 'drive-open-schema-error' }
  | { kind: 'drive-open-error' }
  | { kind: 'drive-sign-in-failed' }
  | { kind: 'drive-read-only' }
  | { kind: 'drive-save-error' }
  | { kind: 'drive-config-error' }
  | { kind: 'delete'; name: string }
  | { kind: 'restored'; name: string }
  | { kind: 'edit'; name: string }
  | { kind: 'edit-undone' }
  | { kind: 'move'; name: string }
  | { kind: 'move-undone' }
  | { kind: 'layers-recalculated' }

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
      ) : message.kind === 'drive-link-error' ? (
        <p>{t('driveLink.errorInvalid')}</p>
      ) : message.kind === 'drive-open-access-error' ? (
        <p>{t('driveLink.errorAccess')}</p>
      ) : message.kind === 'drive-open-json-error' ? (
        <p>{t('driveLink.errorJson')}</p>
      ) : message.kind === 'drive-open-schema-error' ? (
        <p>{t('driveLink.errorSchema')}</p>
      ) : message.kind === 'drive-open-error' ? (
        <p>{t('driveLink.errorGeneric')}</p>
      ) : message.kind === 'drive-sign-in-failed' ? (
        <p>{t('driveLink.errorSignIn')}</p>
      ) : message.kind === 'drive-read-only' ? (
        <p>{t('driveLink.errorReadOnly')}</p>
      ) : message.kind === 'drive-save-error' ? (
        <p>{t('driveLink.errorSave')}</p>
      ) : message.kind === 'drive-config-error' ? (
        <p>{t('driveLink.errorMissingConfig')}</p>
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
      ) : message.kind === 'move' ? (
        <>
          <p>{t('layers.toast.moved', { name: message.name })}</p>
          <button
            className="button button--ghost export-toast__undo"
            type="button"
            onClick={onUndo}
          >
            {t('deleteUndo')}
          </button>
        </>
      ) : message.kind === 'edit' ? (
        <>
          <p>{t('person.editSaved', { name: message.name })}</p>
          <button
            className="button button--ghost export-toast__undo"
            type="button"
            onClick={onUndo}
          >
            {t('deleteUndo')}
          </button>
        </>
      ) : message.kind === 'edit-undone' ? (
        <p>{t('person.editUndone')}</p>
      ) : message.kind === 'move-undone' ? (
        <p>{t('layers.toast.undone')}</p>
      ) : message.kind === 'layers-recalculated' ? (
        <p>{t('layers.toast.recalculated')}</p>
      ) : (
        <>
          <p>
            {message.updated
              ? t('exportToastUpdated', { filename: message.filename })
              : t('exportToastTitle', { filename: message.filename })}
          </p>
          {message.duplicateHint && (
            <p className="export-toast__privacy">{t('exportDuplicateHint')}</p>
          )}
          <p className="export-toast__privacy">{t('exportToastPrivacy')}</p>
        </>
      )}
    </div>
  )
}
