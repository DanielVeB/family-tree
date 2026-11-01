import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { ZodError } from 'zod'
import Toast, { type ToastMessage } from './components/Toast'
import NewTreeDialog from './components/NewTreeDialog'
import ReplaceTreeDialog from './components/ReplaceTreeDialog'
import TreeView from './components/TreeView'
import {
  buildExportFilename,
  serializeTree,
  startTreeDownload,
} from './io/exportTree'
import { parseTreeFile } from './io/importTree'
import {
  addFirstPerson,
  addRelative,
  createEmptyTree,
  type ConnectionAnswers,
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
  loadedFromFile: boolean
  viewKey: number
}

type AppAction =
  | { type: 'create'; tree: FamilyTree }
  | { type: 'select'; selectedId: string | null }
  | { type: 'add-relative'; tree: FamilyTree; selectedId: string }
  | { type: 'export-started'; exportedAt: Date }
  | { type: 'imported'; tree: FamilyTree }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'create':
      return {
        tree: action.tree,
        selectedId: null,
        revision: state.revision + 1,
        exportedRevision: state.exportedRevision,
        exportedAt: state.exportedAt,
        loadedFromFile: false,
        viewKey: state.viewKey,
      }
    case 'select':
      return { ...state, selectedId: action.selectedId }
    case 'add-relative':
      return {
        ...state,
        tree: action.tree,
        selectedId: action.selectedId,
        revision: state.revision + 1,
        loadedFromFile: false,
      }
    case 'export-started':
      return {
        ...state,
        exportedRevision: state.revision,
        exportedAt: action.exportedAt,
        loadedFromFile: false,
      }
    case 'imported': {
      const revision = state.revision + 1
      return {
        tree: action.tree,
        selectedId: null,
        revision,
        exportedRevision: revision,
        exportedAt: null,
        loadedFromFile: true,
        viewKey: state.viewKey + 1,
      }
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
    loadedFromFile: false,
    viewKey: 0,
  })
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)
  const [pendingImport, setPendingImport] = useState<FamilyTree | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const importButtonRef = useRef<HTMLButtonElement>(null)
  const exportBusyRef = useRef(false)
  const exportBusyTimeoutRef = useRef<number | null>(null)
  const exportToastTimeoutRef = useRef<number | null>(null)
  const hasTree = state.tree.nodes.length > 0
  const exportStatus = getExportStatus(state.revision, state.exportedRevision)
  const status = state.loadedFromFile ? 'loaded' : exportStatus
  const hasUnexportedChanges =
    hasTree &&
    !state.loadedFromFile &&
    isTreeDirty(state.revision, state.exportedRevision)

  useEffect(() => {
    document.title = t('documentTitle')
  }, [i18n.language, t])

  useEffect(() => {
    if (!hasUnexportedChanges) return
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventLeaving)
    return () => window.removeEventListener('beforeunload', preventLeaving)
  }, [hasUnexportedChanges])

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
    answers: ConnectionAnswers,
  ) {
    const tree = addRelative(state.tree, selectedId, relation, name, answers)
    dispatch({
      type: 'add-relative',
      tree,
      selectedId: tree.nodes[tree.nodes.length - 1]!.id,
    })
  }

  function showExportFeedback(filename: string | null) {
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
    }
    setToast(
      filename
        ? { kind: 'export-success', filename }
        : { kind: 'export-error' },
    )
    exportToastTimeoutRef.current = window.setTimeout(
      () => setToast(null),
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
      showExportFeedback(null)
    }
  }

  function showImportFeedback(message: ToastMessage) {
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
    }
    setToast(message)
    exportToastTimeoutRef.current = window.setTimeout(
      () => setToast(null),
      8000,
    )
  }

  function applyImport(tree: FamilyTree) {
    dispatch({ type: 'imported', tree })
    setPendingImport(null)
    setShowNewTreeDialog(false)
    showImportFeedback({ kind: 'import-success', count: tree.nodes.length })
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const result = parseTreeFile(await file.text())
      if (!result.ok) {
        showImportFeedback({ kind: 'import-error' })
        return
      }
      if (hasUnexportedChanges) {
        setPendingImport(result.tree)
        return
      }
      applyImport(result.tree)
    } catch {
      showImportFeedback({ kind: 'import-error' })
    }
  }

  function handleImportSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    void importFile(file)
  }

  const cancelImportConfirmation = useCallback(() => {
    setPendingImport(null)
    window.requestAnimationFrame(() => importButtonRef.current?.focus())
  }, [])

  const statusText =
    status === 'loaded'
      ? t('exportStatusLoaded')
      : status === 'never'
        ? t('exportStatusNever')
        : status === 'dirty'
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
          <span className="wordmark__full">{t('appName')}</span>
          <span className="wordmark__compact">{t('appNameShort')}</span>
        </a>
        <div className="top-bar__actions">
          {hasTree && (
            <div className="export-controls">
              <span className="export-status" aria-live="polite">
                {statusText}
              </span>
              <button
                ref={importButtonRef}
                className="button button--ghost import-button"
                type="button"
                aria-label={t('importButtonLabel')}
                onClick={() => importInputRef.current?.click()}
              >
                {t('importButton')}
              </button>
              <button
                className={`button button--ghost export-button${status === 'never' || status === 'dirty' ? ' export-button--dirty' : ''}`}
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
                ref={importButtonRef}
                aria-label={t('importButtonLabel')}
                onClick={() => importInputRef.current?.click()}
              >
                {t('importFile')}
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="tree-main">
          <TreeView
            key={state.viewKey}
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
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label={t('importButtonLabel')}
        onChange={handleImportSelection}
      />
      {pendingImport && (
        <ReplaceTreeDialog
          onReplace={() => applyImport(pendingImport)}
          onCancel={cancelImportConfirmation}
        />
      )}
      <Toast
        message={toast}
        onClose={() => {
          if (exportToastTimeoutRef.current !== null) {
            window.clearTimeout(exportToastTimeoutRef.current)
            exportToastTimeoutRef.current = null
          }
          setToast(null)
        }}
      />
    </div>
  )
}

export default App
