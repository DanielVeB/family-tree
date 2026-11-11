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
import NameExportDialog from './components/NameExportDialog'
import ReplaceTreeDialog from './components/ReplaceTreeDialog'
import TreeView from './components/TreeView'
import {
  buildExportFilename,
  exportWithFileSystemAccess,
  FileExportError,
  getBrowserSaveFilePicker,
  getImportedExportTarget,
  serializeTree,
  startTreeDownload,
  type ExportTarget,
} from './io/exportTree'
import { parseTreeFile } from './io/importTree'
import {
  addFirstPerson,
  addRelativeWithResult,
  createEmptyTree,
  deletePerson,
  getDisplayName,
  TreeOperationError,
  updatePerson,
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
  exportTarget: ExportTarget | null
  loadedFromFile: boolean
  viewKey: number
  undo: {
    kind: 'edit' | 'delete' | 'move'
    tree: FamilyTree
    selectedId: string | null
    revision: number
    exportedRevision: number | null
    exportedAt: Date | null
    loadedFromFile: boolean
    hasUnexportedEditOrDelete: boolean
  } | null
  hasUnexportedEditOrDelete: boolean
}

type AppAction =
  | { type: 'create'; tree: FamilyTree }
  | { type: 'select'; selectedId: string | null }
  | { type: 'add-relative'; tree: FamilyTree; selectedId: string }
  | { type: 'edit-person'; tree: FamilyTree }
  | { type: 'delete-person'; tree: FamilyTree }
  | { type: 'move-person'; tree: FamilyTree }
  | { type: 'undo-change' }
  | { type: 'clear-undo' }
  | {
      type: 'export-started'
      exportedAt: Date
      exportTarget: ExportTarget
    }
  | { type: 'forget-export-handle' }
  | {
      type: 'imported'
      tree: FamilyTree
      exportTarget: ExportTarget | null
    }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'create':
      return {
        tree: action.tree,
        selectedId: null,
        revision: state.revision + 1,
        exportedRevision: state.exportedRevision,
        exportedAt: state.exportedAt,
        exportTarget: null,
        loadedFromFile: false,
        viewKey: state.viewKey,
        undo: null,
        hasUnexportedEditOrDelete: false,
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
        undo: null,
      }
    case 'edit-person':
      if (action.tree === state.tree) return state
      return {
        ...state,
        tree: action.tree,
        revision: state.revision + 1,
        loadedFromFile: false,
        undo: {
          kind: 'edit',
          tree: state.tree,
          selectedId: state.selectedId,
          revision: state.revision,
          exportedRevision: state.exportedRevision,
          exportedAt: state.exportedAt,
          loadedFromFile: state.loadedFromFile,
          hasUnexportedEditOrDelete: state.hasUnexportedEditOrDelete,
        },
        hasUnexportedEditOrDelete: true,
      }
    case 'delete-person':
      return {
        ...state,
        tree: action.tree,
        selectedId: null,
        revision: state.revision + 1,
        loadedFromFile: false,
        undo: {
          kind: 'delete',
          tree: state.tree,
          selectedId: state.selectedId,
          revision: state.revision,
          exportedRevision: state.exportedRevision,
          exportedAt: state.exportedAt,
          loadedFromFile: state.loadedFromFile,
          hasUnexportedEditOrDelete: state.hasUnexportedEditOrDelete,
        },
        hasUnexportedEditOrDelete: true,
      }
    case 'move-person':
      return {
        ...state,
        tree: action.tree,
        revision: state.revision + 1,
        loadedFromFile: false,
        undo: {
          kind: 'move',
          tree: state.tree,
          selectedId: state.selectedId,
          revision: state.revision,
          exportedRevision: state.exportedRevision,
          exportedAt: state.exportedAt,
          loadedFromFile: state.loadedFromFile,
          hasUnexportedEditOrDelete: state.hasUnexportedEditOrDelete,
        },
        hasUnexportedEditOrDelete: true,
      }
    case 'undo-change':
      if (!state.undo) return state
      return {
        ...state,
        ...state.undo,
        undo: null,
        viewKey: state.viewKey + 1,
      }
    case 'clear-undo':
      return state.undo ? { ...state, undo: null } : state
    case 'export-started':
      return {
        ...state,
        exportTarget: action.exportTarget,
        exportedRevision: state.revision,
        exportedAt: action.exportedAt,
        loadedFromFile: false,
        hasUnexportedEditOrDelete: false,
      }
    case 'forget-export-handle':
      return state.exportTarget?.handle
        ? {
            ...state,
            exportTarget: {
              name: state.exportTarget.name,
              confirmed: false,
            },
          }
        : state
    case 'imported': {
      const revision = state.revision + 1
      return {
        tree: action.tree,
        selectedId: null,
        revision,
        exportedRevision: revision,
        exportedAt: null,
        exportTarget: action.exportTarget,
        loadedFromFile: true,
        viewKey: state.viewKey + 1,
        undo: null,
        hasUnexportedEditOrDelete: false,
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
    exportTarget: null,
    loadedFromFile: false,
    viewKey: 0,
    undo: null,
    hasUnexportedEditOrDelete: false,
  })
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    tree: FamilyTree
    fileName: string
  } | null>(null)
  const [pendingExport, setPendingExport] = useState<{
    text: string
    suggestedName: string
  } | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const importButtonRef = useRef<HTMLButtonElement>(null)
  const exportButtonRef = useRef<HTMLButtonElement>(null)
  const exportMenuButtonRef = useRef<HTMLButtonElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const exportBusyRef = useRef(false)
  const exportToastTimeoutRef = useRef<number | null>(null)
  const focusAfterTreeActionRef = useRef<'delete' | 'undo' | null>(null)
  const hasTree = state.tree.nodes.length > 0
  const exportStatus = getExportStatus(state.revision, state.exportedRevision)
  const status = state.loadedFromFile
    ? 'loaded'
    : state.hasUnexportedEditOrDelete
      ? 'dirty'
      : exportStatus
  const hasUnexportedChanges =
    hasTree &&
    !state.loadedFromFile &&
    isTreeDirty(state.revision, state.exportedRevision)

  useEffect(() => {
    document.title = t('documentTitle')
  }, [i18n.language, t])

  useEffect(() => {
    const focusTarget = focusAfterTreeActionRef.current
    if (!focusTarget) return
    focusAfterTreeActionRef.current = null
    window.requestAnimationFrame(() => {
      const personId =
        focusTarget === 'undo'
          ? state.selectedId
          : (state.tree.nodes[0]?.id ?? null)
      const target = personId
        ? document.getElementById(`person-${personId}`)
        : document.getElementById('start-new-tree')
      target?.focus()
    })
  }, [state.tree, state.selectedId])

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

  useEffect(() => {
    if (!showExportMenu) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !exportMenuRef.current?.contains(event.target)
      ) {
        setShowExportMenu(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExportMenu(false)
        exportMenuButtonRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showExportMenu])

  const changeLanguage = (language: 'en' | 'pl') => {
    window.localStorage.setItem('family-tree-language', language)
    void i18n.changeLanguage(language)
  }

  function createTree(name: PersonName) {
    clearToast()
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
    centers: Record<string, number>,
    side?: 'left' | 'right',
  ) {
    const result = addRelativeWithResult(
      state.tree,
      selectedId,
      relation,
      name,
      answers,
      centers,
      side,
    )
    const tree = result.tree
    clearToast()
    dispatch({
      type: 'add-relative',
      tree,
      selectedId: tree.nodes[tree.nodes.length - 1]!.id,
    })
    if (result.levelsRecalculated) {
      showToast({ kind: 'layers-recalculated' })
    }
  }

  function editPerson(personId: string, name: PersonName): boolean {
    const tree = updatePerson(state.tree, personId, name)
    if (tree === state.tree) return false
    clearToast()
    dispatch({ type: 'edit-person', tree })
    const updatedPerson = tree.nodes.find(({ id }) => id === personId)
    if (updatedPerson) {
      showToast({ kind: 'edit', name: getDisplayName(updatedPerson) }, 10_000)
    }
    return true
  }

  function removePerson(personId: string) {
    const person = state.tree.nodes.find(({ id }) => id === personId)
    if (!person) throw new TreeOperationError('unknownPerson')
    const name = getDisplayName(person)
    const tree = deletePerson(state.tree, personId)
    clearToast()
    focusAfterTreeActionRef.current = 'delete'
    dispatch({ type: 'delete-person', tree })
    showToast({ kind: 'delete', name }, 10_000)
  }

  function undoChange() {
    if (
      !state.undo ||
      (toast?.kind !== 'delete' &&
        toast?.kind !== 'move' &&
        toast?.kind !== 'edit')
    )
      return
    const name = toast.kind === 'delete' ? toast.name : undefined
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
      exportToastTimeoutRef.current = null
    }
    setToast(null)
    focusAfterTreeActionRef.current = 'undo'
    dispatch({ type: 'undo-change' })
    showToast(
      name
        ? { kind: 'restored', name }
        : toast.kind === 'edit'
          ? { kind: 'edit-undone' }
          : { kind: 'move-undone' },
      5000,
    )
  }

  function movePerson(tree: FamilyTree, personId: string) {
    if (tree === state.tree) return
    const person = state.tree.nodes.find(({ id }) => id === personId)
    if (!person) throw new TreeOperationError('unknownPerson')
    clearToast()
    dispatch({ type: 'move-person', tree })
    showToast({ kind: 'move', name: getDisplayName(person) }, 10_000)
  }

  function clearToast() {
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
      exportToastTimeoutRef.current = null
    }
    setToast(null)
  }

  function showToast(message: ToastMessage, duration = 8000) {
    if (
      (toast?.kind === 'delete' ||
        toast?.kind === 'move' ||
        toast?.kind === 'edit') &&
      message.kind !== 'delete' &&
      message.kind !== 'move' &&
      message.kind !== 'edit'
    ) {
      dispatch({ type: 'clear-undo' })
    }
    if (exportToastTimeoutRef.current !== null) {
      window.clearTimeout(exportToastTimeoutRef.current)
    }
    setToast(message)
    exportToastTimeoutRef.current = window.setTimeout(() => {
      exportToastTimeoutRef.current = null
      setToast(null)
      if (
        message.kind === 'delete' ||
        message.kind === 'move' ||
        message.kind === 'edit'
      ) {
        dispatch({ type: 'clear-undo' })
      }
    }, duration)
  }

  function releaseExportBusy(restoreFocus = false) {
    exportBusyRef.current = false
    setExportBusy(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement
        if (
          activeElement === document.body ||
          activeElement === document.getElementById('export-file-name')
        ) {
          exportButtonRef.current?.focus()
        }
      })
    }
  }

  function finishExport(
    target: ExportTarget,
    updated: boolean,
    duplicateHint = false,
  ) {
    const exportedAt = new Date()
    dispatch({ type: 'export-started', exportedAt, exportTarget: target })
    showToast({
      kind: 'export-success',
      filename: target.name,
      updated,
      duplicateHint,
    })
  }

  function handleExportError(error: unknown) {
    if (error instanceof ZodError) {
      console.error('Tree validation failed before export.')
    } else {
      const errorName =
        error instanceof FileExportError
          ? error.errorName
          : error instanceof Error
            ? error.name
            : 'UnknownError'
      console.error(errorName)
    }
    showToast({ kind: 'export-error' })
  }

  function exportTree(forcePicker = false) {
    if (exportBusyRef.current || !hasTree) return
    exportBusyRef.current = true
    setExportBusy(true)

    let text: string
    try {
      text = serializeTree(state.tree)
    } catch (error) {
      handleExportError(error)
      releaseExportBusy()
      return
    }

    const suggestedName =
      state.exportTarget?.name ?? buildExportFilename(new Date())
    const picker = getBrowserSaveFilePicker()
    if (picker) {
      void exportWithFileSystemAccess({
        text,
        target: state.exportTarget,
        suggestedName,
        forcePicker,
        pickerType: t('exportNamePickerType'),
        showSaveFilePicker: picker,
      })
        .then((result) => {
          if (result.kind === 'cancelled') return
          finishExport(result.target, result.updated)
        })
        .catch((error: unknown) => {
          if (error instanceof FileExportError && error.forgetHandle) {
            dispatch({ type: 'forget-export-handle' })
          }
          handleExportError(error)
        })
        .finally(() => releaseExportBusy())
      return
    }

    if (forcePicker || !state.exportTarget?.confirmed) {
      setPendingExport({ text, suggestedName })
      return
    }

    try {
      startTreeDownload(text, state.exportTarget.name)
      finishExport(state.exportTarget, false, true)
    } catch (error) {
      handleExportError(error)
    } finally {
      releaseExportBusy()
    }
  }

  function exportNamedFile(filename: string) {
    if (!pendingExport) return
    try {
      startTreeDownload(pendingExport.text, filename)
      finishExport({ name: filename, confirmed: true }, false)
      setPendingExport(null)
      releaseExportBusy(true)
    } catch (error) {
      handleExportError(error)
      setPendingExport(null)
      releaseExportBusy(true)
    }
  }

  function cancelNamedExport() {
    setPendingExport(null)
    releaseExportBusy(true)
  }

  function applyImport(imported: { tree: FamilyTree; fileName: string }) {
    clearToast()
    dispatch({
      type: 'imported',
      tree: imported.tree,
      exportTarget: getImportedExportTarget(imported.fileName),
    })
    setPendingImport(null)
    setShowNewTreeDialog(false)
    showToast({ kind: 'import-success', count: imported.tree.nodes.length })
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const result = parseTreeFile(await file.text())
      if (!result.ok) {
        showToast({ kind: 'import-error' })
        return
      }
      const imported = { tree: result.tree, fileName: file.name }
      if (hasUnexportedChanges) {
        setPendingImport(imported)
        return
      }
      applyImport(imported)
    } catch {
      showToast({ kind: 'import-error' })
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
                ref={exportButtonRef}
                className={`button button--ghost export-button${status === 'never' || status === 'dirty' ? ' export-button--dirty' : ''}`}
                type="button"
                disabled={exportBusy}
                aria-label={t('exportButtonLabel')}
                onClick={() => exportTree()}
              >
                {t('exportButton')}
              </button>
              <div className="export-more" ref={exportMenuRef}>
                <button
                  ref={exportMenuButtonRef}
                  className="icon-pill"
                  type="button"
                  aria-label={t('exportMoreLabel')}
                  aria-expanded={showExportMenu}
                  aria-controls={
                    showExportMenu ? 'export-options-menu' : undefined
                  }
                  onClick={() => setShowExportMenu((open) => !open)}
                >
                  <span aria-hidden="true">⌄</span>
                </button>
                {showExportMenu && (
                  <div className="panel export-menu" id="export-options-menu">
                    {state.exportTarget && (
                      <p className="export-menu__current">
                        {t('exportCurrentFile', {
                          filename: state.exportTarget.name,
                        })}
                      </p>
                    )}
                    <button
                      className="export-menu__item"
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false)
                        exportMenuButtonRef.current?.focus()
                        exportTree(true)
                      }}
                    >
                      {t('exportAs')}
                    </button>
                  </div>
                )}
              </div>
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
                id="start-new-tree"
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
            onUpdatePerson={editPerson}
            onDeletePerson={removePerson}
            onMovePerson={movePerson}
          />
        </main>
      )}
      {showNewTreeDialog && (
        <NewTreeDialog
          onCreate={createTree}
          onCancel={() => setShowNewTreeDialog(false)}
        />
      )}
      {pendingExport && (
        <NameExportDialog
          suggestedName={pendingExport.suggestedName}
          onExport={exportNamedFile}
          onCancel={cancelNamedExport}
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
        onUndo={undoChange}
        onClose={() => {
          if (exportToastTimeoutRef.current !== null) {
            window.clearTimeout(exportToastTimeoutRef.current)
            exportToastTimeoutRef.current = null
          }
          if (
            toast?.kind === 'delete' ||
            toast?.kind === 'move' ||
            toast?.kind === 'edit'
          )
            dispatch({ type: 'clear-undo' })
          setToast(null)
        }}
      />
    </div>
  )
}

export default App
