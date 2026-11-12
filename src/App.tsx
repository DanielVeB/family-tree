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
import DriveLinkDialog from './components/DriveLinkDialog'
import NewTreeDialog from './components/NewTreeDialog'
import NameExportDialog from './components/NameExportDialog'
import ReplaceTreeDialog from './components/ReplaceTreeDialog'
import TreeView from './components/TreeView'
import TimelineDialog from './timeline/TimelineDialog'
import {
  buildExportFilename,
  exportWithFileSystemAccess,
  FileExportError,
  getBrowserSaveFilePicker,
  getImportedExportTarget,
  normalizeFileName,
  serializeTree,
  startTreeDownload,
  type ExportTarget,
} from './io/exportTree'
import { parseTreeFile } from './io/importTree'
import {
  GoogleDriveError,
  loadTreeFromGoogleDriveLink,
  saveTreeToGoogleDriveFile,
  type GoogleDriveSource,
} from './io/googleDrive'
import {
  GoogleDriveAuthError,
  signInToGoogleDrive,
  type GoogleDriveAuthToken,
} from './io/googleDriveAuth'
import {
  addFirstPerson,
  addRelativeWithResult,
  appendSaveHistory,
  createEmptyTree,
  deletePerson,
  getDisplayName,
  TreeOperationError,
  updateMarriageDate,
  updatePerson,
  type ConnectionAnswers,
  type FamilyTree,
  type PersonName,
} from './model/tree'
import { getExportStatus, isTreeDirty } from './state/exportStatus'
import { type LayoutOrientation } from './layout/computeLayout'

const orientationStorageKey = 'family-tree-orientation'

function detectInitialOrientation(
  savedOrientation: string | null,
  viewportWidth: number,
): LayoutOrientation {
  if (savedOrientation === 'horizontal' || savedOrientation === 'vertical') {
    return savedOrientation
  }
  return viewportWidth < 640 ? 'vertical' : 'horizontal'
}

interface AppState {
  tree: FamilyTree
  selectedId: string | null
  revision: number
  exportedRevision: number | null
  exportedAt: Date | null
  exportTarget: ExportTarget | null
  driveSource: GoogleDriveSource | null
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
      type: 'save-complete'
      tree: FamilyTree
      exportedAt: Date
      exportTarget: ExportTarget
    }
  | { type: 'forget-export-handle' }
  | {
      type: 'imported'
      tree: FamilyTree
      exportTarget: ExportTarget | null
      driveSource: GoogleDriveSource | null
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
        driveSource: null,
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
    case 'save-complete': {
      const revision = state.revision + 1
      return {
        ...state,
        tree: action.tree,
        revision,
        exportTarget: action.exportTarget,
        exportedRevision: revision,
        exportedAt: action.exportedAt,
        loadedFromFile: false,
        hasUnexportedEditOrDelete: false,
      }
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
        driveSource: action.driveSource,
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
    driveSource: null,
    loadedFromFile: false,
    viewKey: 0,
    undo: null,
    hasUnexportedEditOrDelete: false,
  })
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [orientation, setOrientation] = useState<LayoutOrientation>(() =>
    detectInitialOrientation(
      window.localStorage.getItem(orientationStorageKey),
      window.innerWidth,
    ),
  )
  const [showDriveLinkDialog, setShowDriveLinkDialog] = useState(false)
  const [driveLinkBusy, setDriveLinkBusy] = useState(false)
  const [driveAuthToken, setDriveAuthToken] = useState<GoogleDriveAuthToken | null>(
    null,
  )
  const [pendingImport, setPendingImport] = useState<{
    tree: FamilyTree
    fileName: string
    exportTarget: ExportTarget | null
    driveSource: GoogleDriveSource | null
  } | null>(null)
  const [pendingExport, setPendingExport] = useState<{
    text: string
    suggestedName: string
    tree: FamilyTree
    exportTarget: ExportTarget
    savedAt: Date
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
  const hasValidDriveToken =
    driveAuthToken !== null && driveAuthToken.expiresAt > Date.now() + 5_000

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

  const changeOrientation = (nextOrientation: LayoutOrientation) => {
    setOrientation(nextOrientation)
    window.localStorage.setItem(orientationStorageKey, nextOrientation)
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
    dateOfMarriage?: string,
  ) {
    const result = addRelativeWithResult(
      state.tree,
      selectedId,
      relation,
      name,
      answers,
      centers,
      side,
      dateOfMarriage,
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

  function editMarriageDate(
    firstPersonId: string,
    secondPersonId: string,
    dateOfMarriage: string | undefined,
  ): boolean {
    const tree = updateMarriageDate(
      state.tree,
      firstPersonId,
      secondPersonId,
      dateOfMarriage,
    )
    if (tree === state.tree) return false
    clearToast()
    dispatch({ type: 'edit-person', tree })
    const person = tree.nodes.find(({ id }) => id === firstPersonId)
    if (person) {
      showToast({ kind: 'edit', name: getDisplayName(person) }, 10_000)
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

  function finishSave(
    target: ExportTarget,
    updated: boolean,
    tree: FamilyTree,
    savedAt: Date,
    duplicateHint = false,
  ) {
    dispatch({ type: 'save-complete', exportedAt: savedAt, exportTarget: target, tree })
    showToast({ kind: 'export-success', filename: target.name, updated, duplicateHint })
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

  async function ensureDriveAccessToken(): Promise<string | null> {
    if (driveAuthToken && driveAuthToken.expiresAt > Date.now() + 5_000) {
      return driveAuthToken.accessToken
    }
    try {
      const token = await signInToGoogleDrive(
        import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
        import.meta.env.BASE_URL,
      )
      setDriveAuthToken(token)
      return token.accessToken
    } catch (error) {
      const code =
        error instanceof GoogleDriveAuthError ? error.code : 'authFailed'
      if (code === 'notConfigured') {
        showToast({ kind: 'drive-config-error' })
      } else if (code !== 'cancelled') {
        showToast({ kind: 'drive-sign-in-failed' })
      }
      return null
    }
  }

  function exportTree(forcePicker = false) {
    if (exportBusyRef.current || !hasTree) return
    exportBusyRef.current = true
    setExportBusy(true)

    const savedAt = new Date()
    const treeToSave = appendSaveHistory(state.tree, 'localExport', savedAt)
    let text: string
    try {
      text = serializeTree(treeToSave)
    } catch (error) {
      handleExportError(error)
      releaseExportBusy()
      return
    }

    const driveSuggestedTarget = state.driveSource
      ? normalizeFileName(state.driveSource.fileName)
      : null
    const suggestedName =
      state.exportTarget?.name ??
      (driveSuggestedTarget?.ok
        ? driveSuggestedTarget.name
        : buildExportFilename(savedAt))
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
          finishSave(result.target, result.updated, treeToSave, savedAt)
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
      setPendingExport({
        text,
        suggestedName,
        tree: treeToSave,
        exportTarget: { name: suggestedName, confirmed: true },
        savedAt,
      })
      return
    }

    try {
      startTreeDownload(text, state.exportTarget.name)
      finishSave(state.exportTarget, false, treeToSave, savedAt, true)
    } catch (error) {
      handleExportError(error)
    } finally {
      releaseExportBusy()
    }
  }

  function saveToDrive() {
    if (exportBusyRef.current || !hasTree || !state.driveSource) return
    const driveSource = state.driveSource
    exportBusyRef.current = true
    setExportBusy(true)
    void ensureDriveAccessToken()
      .then((accessToken) => {
        if (!accessToken) return
        if (!driveSource.canEdit) {
          showToast({ kind: 'drive-read-only' })
          return
        }
        const savedAt = new Date()
        const treeToSave = appendSaveHistory(state.tree, 'googleDrive', savedAt)
        const text = serializeTree(treeToSave)
        return saveTreeToGoogleDriveFile(
          driveSource.fileId,
          accessToken,
          text,
        ).then(() => {
          finishSave(
            {
              name: driveSource.fileName,
              confirmed: false,
            },
            true,
            treeToSave,
            savedAt,
          )
        })
      })
      .catch((error: unknown) => {
        if (error instanceof ZodError) {
          handleExportError(error)
          return
        }
        if (error instanceof GoogleDriveError) {
          if (error.code === 'permissionDenied') {
            showToast({ kind: 'drive-read-only' })
            return
          }
          if (error.code === 'authRequired') {
            showToast({ kind: 'drive-sign-in-failed' })
            return
          }
          showToast({ kind: 'drive-save-error' })
          return
        }
        handleExportError(error)
      })
      .finally(() => releaseExportBusy())
  }

  function saveTree() {
    if (state.driveSource) {
      saveToDrive()
      return
    }
    exportTree()
  }

  function exportNamedFile(filename: string) {
    if (!pendingExport) return
    try {
      startTreeDownload(pendingExport.text, filename)
      finishSave(
        { ...pendingExport.exportTarget, name: filename },
        false,
        pendingExport.tree,
        pendingExport.savedAt,
      )
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

  function applyImport(imported: {
    tree: FamilyTree
    fileName: string
    exportTarget: ExportTarget | null
    driveSource: GoogleDriveSource | null
  }) {
    clearToast()
    dispatch({
      type: 'imported',
      tree: imported.tree,
      exportTarget: imported.exportTarget,
      driveSource: imported.driveSource,
    })
    setPendingImport(null)
    setShowDriveLinkDialog(false)
    setDriveLinkBusy(false)
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
      const imported = {
        tree: result.tree,
        fileName: file.name,
        exportTarget: getImportedExportTarget(file.name),
        driveSource: null,
      }
      if (hasUnexportedChanges) {
        setShowDriveLinkDialog(false)
        setPendingImport(imported)
        return
      }
      applyImport(imported)
    } catch {
      showToast({ kind: 'import-error' })
    }
  }

  async function importFromDriveLink(link: string) {
    if (driveLinkBusy) return
    setDriveLinkBusy(true)
    const accessToken = await ensureDriveAccessToken()
    if (!accessToken) {
      setDriveLinkBusy(false)
      return
    }
    try {
      const importedFromDrive = await loadTreeFromGoogleDriveLink(
        link,
        accessToken,
      )
      const fileNameResult = normalizeFileName(importedFromDrive.source.fileName)
      const imported = {
        tree: importedFromDrive.tree,
        fileName: importedFromDrive.source.fileName,
        exportTarget: fileNameResult.ok
          ? { name: fileNameResult.name, confirmed: false }
          : null,
        driveSource: importedFromDrive.source,
      }
      if (hasUnexportedChanges) {
        setPendingImport(imported)
        return
      }
      applyImport(imported)
    } catch (error) {
      if (error instanceof GoogleDriveError) {
        if (error.code === 'invalidLink') showToast({ kind: 'drive-link-error' })
        else if (error.code === 'permissionDenied' || error.code === 'notFound') {
          showToast({ kind: 'drive-open-access-error' })
        } else if (error.code === 'invalidJson') {
          showToast({ kind: 'drive-open-json-error' })
        } else if (error.code === 'invalidSchema') {
          showToast({ kind: 'drive-open-schema-error' })
        } else if (error.code === 'authRequired') {
          showToast({ kind: 'drive-sign-in-failed' })
        } else {
          showToast({ kind: 'drive-open-error' })
        }
      } else {
        showToast({ kind: 'drive-open-error' })
      }
    } finally {
      setDriveLinkBusy(false)
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
      ? state.driveSource
        ? t('exportStatusLoadedDrive')
        : t('exportStatusLoaded')
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
  const sourceText = state.driveSource
    ? t('sourceDrive', { filename: state.driveSource.fileName })
    : t('sourceLocal')
  const driveConnectionText = state.driveSource
    ? !hasValidDriveToken
      ? t('driveConnectionSignedOut')
      : state.driveSource.canEdit
        ? t('driveConnectionEditable')
        : t('driveConnectionReadOnly')
    : null

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
              <span className="export-source" aria-live="polite">
                {sourceText}
                {driveConnectionText ? ` · ${driveConnectionText}` : ''}
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
                className="button button--ghost import-button"
                type="button"
                aria-label={t('driveLink.openButtonLabel')}
                onClick={() => setShowDriveLinkDialog(true)}
              >
                {t('driveLink.openButton')}
              </button>
              <button
                ref={exportButtonRef}
                className={`button button--ghost export-button${status === 'never' || status === 'dirty' ? ' export-button--dirty' : ''}`}
                type="button"
                disabled={exportBusy}
                aria-label={
                  state.driveSource
                    ? t('driveSaveButtonLabel')
                    : t('exportButtonLabel')
                }
                onClick={saveTree}
              >
                {state.driveSource ? t('driveSaveButton') : t('exportButton')}
              </button>
              <button
                className="button button--ghost timeline-button"
                type="button"
                aria-label={t('timeline.open')}
                onClick={() => setShowTimeline(true)}
              >
                {t('timeline.open')}
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
                      {state.driveSource ? t('exportLocalAs') : t('exportAs')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div
            className="orientation-toggle"
            role="group"
            aria-label={t('orientation.label')}
          >
            <button
              type="button"
              aria-label={t('orientation.vertical')}
              aria-pressed={orientation === 'vertical'}
              onClick={() => changeOrientation('vertical')}
            >
              {t('orientation.verticalShort')}
            </button>
            <span aria-hidden="true">|</span>
            <button
              type="button"
              aria-label={t('orientation.horizontal')}
              aria-pressed={orientation === 'horizontal'}
              onClick={() => changeOrientation('horizontal')}
            >
              {t('orientation.horizontalShort')}
            </button>
          </div>
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
              <button
                className="button button--ghost"
                type="button"
                aria-label={t('driveLink.openButtonLabel')}
                onClick={() => setShowDriveLinkDialog(true)}
              >
                {t('driveLink.openButton')}
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="tree-main">
          <TreeView
            key={state.viewKey}
            tree={state.tree}
            orientation={orientation}
            selectedId={state.selectedId}
            onSelect={(selectedId) => dispatch({ type: 'select', selectedId })}
            onAddRelative={createRelative}
            onUpdatePerson={editPerson}
            onUpdateMarriageDate={editMarriageDate}
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
      {showDriveLinkDialog && (
        <DriveLinkDialog
          busy={driveLinkBusy}
          onOpen={(link) => {
            void importFromDriveLink(link)
          }}
          onCancel={() => {
            if (!driveLinkBusy) setShowDriveLinkDialog(false)
          }}
        />
      )}
      {showTimeline && (
        <TimelineDialog
          tree={state.tree}
          onClose={() => setShowTimeline(false)}
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
