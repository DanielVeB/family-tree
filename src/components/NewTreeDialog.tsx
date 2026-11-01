import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PersonName } from '../model/tree'

interface NewTreeDialogProps {
  onCreate: (name: PersonName) => void
  onCancel: () => void
}

export default function NewTreeDialog({
  onCreate,
  onCancel,
}: NewTreeDialogProps) {
  const { t } = useTranslation()
  const firstNameRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<'firstName' | 'lastName' | null>(
    null,
  )

  useEffect(() => {
    firstNameRef.current?.focus()
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedFirstName = firstName.trim()
    if (!trimmedFirstName) {
      setError('required')
      setErrorField('firstName')
      firstNameRef.current?.focus()
      return
    }
    if (trimmedFirstName.length > 100) {
      setError('tooLong')
      setErrorField('firstName')
      return
    }
    if (lastName.trim().length > 100) {
      setError('tooLong')
      setErrorField('lastName')
      return
    }
    onCreate({ firstName: trimmedFirstName, lastName: lastName.trim() })
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="panel new-tree-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-tree-title"
      >
        <h2 id="new-tree-title">{t('newTreeTitle')}</h2>
        <p>{t('newTreeIntro')}</p>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="new-tree-first-name">{t('firstName')}</label>
            <input
              id="new-tree-first-name"
              ref={firstNameRef}
              autoComplete="given-name"
              maxLength={101}
              value={firstName}
              aria-invalid={errorField === 'firstName'}
              aria-describedby={
                errorField === 'firstName' ? 'new-tree-error' : undefined
              }
              onChange={(event) => {
                setFirstName(event.target.value)
                setError('')
                setErrorField(null)
              }}
            />
            {error && errorField === 'firstName' && (
              <span className="field__error" id="new-tree-error" role="alert">
                {error === 'required'
                  ? t('firstNameRequired')
                  : t('nameTooLong', { max: 100 })}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="new-tree-last-name">{t('lastName')}</label>
            <input
              id="new-tree-last-name"
              autoComplete="family-name"
              maxLength={101}
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value)
                setError('')
                setErrorField(null)
              }}
            />
            {error && errorField === 'lastName' && (
              <span className="field__error" role="alert">
                {t('nameTooLong', { max: 100 })}
              </span>
            )}
          </div>
          <div className="form-actions">
            <button className="button button--primary" type="submit">
              {t('createTree')}
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
