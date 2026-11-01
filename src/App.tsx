import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ZodError } from 'zod'
import ExportToast from './components/ExportToast'
import NewTreeDialog from './components/NewTreeDialog'
import TreeView from './components/TreeView'
import {
  buildExportFilename,
  serializeTree,
  startTreeDownload,
} from './io/exportTree'
import {
  addFirstPerson,
  addRelative,
  createEmptyTree,
  type FamilyTree,
  type PersonName,
} from './model/tree'
import { getExportStatus, isTreeDirty } from './state/exportStatus'

interface AppState {
  tree: FamilyTree
  selectedId: string | null
  revision: number
  exportedRevision: number | null
  exportedAt: Date | null
}

type AppAction =
  | { type: 'create'; tree: FamilyTree }
  | { type: 'select'; selectedId: string | null }
  | { type: 'add-relative'; tree: FamilyTree; selectedId: string }
  | { type: 'export-started'; exportedAt: Date }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'create':
      return {
        tree: action.tree,
        selectedId: null,
        revision: state.revision + 1,
        exportedRevision: null,
        exportedAt: null,
      }
    case 'select':
      return { ...state, selectedId: action.selectedId }
    case 'add-relative':
      return {
        ...state,
        tree: action.tree,
        selectedId: action.selectedId,
        revision: state.revision + 1,
      }
    case 'export-started':
      return {
        ...state,
        exportedRevision: state.revision,
        exportedAt: action.exportedAt,
      }
  }
}

function App() {
  const { i18n, t } = useTranslation()
  const [state, dispatch] = useReducer(reducer, {
    tree: createEmptyTree(),
    selectedId: null,
    revision: 0,
    exportedRevision: null,
    exportedAt: null,
  })
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportToast, setExportToast] = useState<{
    filename: string | null
    error: boolean
  } | null>(null)
  const exportBusyRef = useRef(false)
  const exportBusyTimeoutRef = useRef<number | null>(null)
  const exportToastTimeoutRef = useRef<number | null>(null)
  const hasTree = state.tree.nodes.length > 0
  const exportStatus = getExportStatus(state.revision, state.exportedRevision)

  useEffect(() => {
    document.title = t('documentTitle')
  }, [i18n.language, t])

  useEffect(() => {
    if (!hasTree || !isTreeDirty(state.revision, state.exportedRevision)) return
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventLeaving)
    return () => window.removeEventListener('beforeunload', preventLeaving)
  }, [hasTree, state.revision, state.exportedRevision])

  useEffect(
    () => () => {
      if (exportBusyTimeoutRef.current !== null) {
        window.clearTimeout(exportBusyTimeoutRef.current)
      }
      if (exportToastTimeoutRef.current !== null) {
        window.clearTimeout(exportToastTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!showNewTreeDialog) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNewTreeDialog(false)
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [showNewTreeDialog])

  const changeLanguage = (language: 'en' | 'pl') => {
    window.localStorage.setItem('family-tree-language', language)
    void i18n.changeLanguage(language)
  }

  function createTree(name: PersonName) {
    dispatch({
      type: 'create',
      tree: addFirstPerson(createEmptyTree(), name),
    })
    setShowNewTreeDialog(false)
  }

  function createRelative(
    selectedId: string,
    relation: 'parent' | 'child' | 'sibling' | 'partner',
    name: PersonName,
  ) {
    const tree = addRelative(state.tree, selectedId, relation, name)
    dispatch({
      type: 'add-relative',
      tree,
      selectedId: tree.nodes[tree.nodes.length - 1]!.id,
    })
  }

  function showExportFeedback(filename: string | null, error = false) {
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
    }
    setExportToast({ filename, error })
    exportToastTimeoutRef.current = window.setTimeout(
      () => setExportToast(null),
      8000,
    )
  }

  function exportTree() {
    if (exportBusyRef.current || !hasTree) return
    exportBusyRef.current = true
    setExportBusy(true)
    exportBusyTimeoutRef.current = window.setTimeout(() => {
      exportBusyRef.current = false
      exportBusyTimeoutRef.current = null
      setExportBusy(false)
    }, 350)

    try {
      const content = serializeTree(state.tree)
      const filename = buildExportFilename(new Date())
      startTreeDownload(content, filename)
      dispatch({ type: 'export-started', exportedAt: new Date() })
      showExportFeedback(filename)
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Tree validation failed before export.')
      } else {
        console.error('Tree export could not be started.')
      }
      showExportFeedback(null, true)
    }
  }

  const statusText =
    exportStatus === 'never'
      ? t('exportStatusNever')
      : exportStatus === 'dirty'
        ? t('exportStatusDirty')
        : t('exportStatusDone', {
            time: state.exportedAt
              ? new Intl.DateTimeFormat(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(state.exportedAt)
              : '',
          })

  return (
    <div className="app-shell">
      <header className="top-bar">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          {t('appName')}
        </a>
        <div className="top-bar__actions">
          {hasTree && (
            <div className="export-controls">
              <span className="export-status" aria-live="polite">
                {statusText}
              </span>
              <button
                className={`button button--ghost export-button${exportStatus !== 'done' ? ' export-button--dirty' : ''}`}
                type="button"
                disabled={exportBusy}
                aria-label={t('exportButtonLabel')}
                onClick={exportTree}
              >
                {t('exportButton')}
              </button>
            </div>
          )}
          <div
            className="language-toggle"
            role="group"
            aria-label={t('language')}
          >
            <button
              type="button"
              aria-pressed={i18n.language === 'en'}
              onClick={() => changeLanguage('en')}
            >
              {t('englishShort')}
            </button>
            <span aria-hidden="true">|</span>
            <button
              type="button"
              aria-pressed={i18n.language === 'pl'}
              onClick={() => changeLanguage('pl')}
            >
              {t('polishShort')}
            </button>
          </div>
        </div>
      </header>

      {state.tree.nodes.length === 0 ? (
        <main className="empty-state">
          <div className="empty-state__content">
            <h1>{t('welcomeTitle')}</h1>
            <p>{t('welcomeDescription')}</p>
            <div className="empty-state__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => setShowNewTreeDialog(true)}
              >
                {t('startTree')}
              </button>
              <button
                className="button button--ghost"
                type="button"
                disabled
                aria-disabled="true"
              >
                {t('importFile')}
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="tree-main">
          <TreeView
            tree={state.tree}
            selectedId={state.selectedId}
            onSelect={(selectedId) => dispatch({ type: 'select', selectedId })}
            onAddRelative={createRelative}
          />
        </main>
      )}
      {showNewTreeDialog && (
        <NewTreeDialog
          onCreate={createTree}
          onCancel={() => setShowNewTreeDialog(false)}
        />
      )}
      <ExportToast
        filename={exportToast?.filename ?? null}
        error={exportToast?.error ?? false}
        onClose={() => {
          if (exportToastTimeoutRef.current !== null) {
            window.clearTimeout(exportToastTimeoutRef.current)
            exportToastTimeoutRef.current = null
          }
          setExportToast(null)
        }}
      />
    </div>
  )
}

export default App
