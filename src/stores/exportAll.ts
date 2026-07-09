/**
 * Export-all-JSON (settings action): collect every decrypted payload out of the
 * eight in-memory entity stores and download them as one JSON file. Replaces the
 * old server-side export script. The shaping is the pure {@link buildExportBundle}
 * (unit-tested); this module wires it to the live stores and a browser download.
 */
import { buildExportBundle, type ExportBundle } from '@/lib/exportData'
import { useActionItems } from '@/stores/entities/actionItems'
import { useProjects } from '@/stores/entities/projects'
import { useGoals } from '@/stores/entities/goals'
import { useQuestions } from '@/stores/entities/questions'
import { useAnswers } from '@/stores/entities/answers'
import { useWebLinks } from '@/stores/entities/webLinks'
import { useThoughts } from '@/stores/entities/thoughts'
import { useFocus } from '@/stores/entities/focus'

/** Reads the current live docs from every entity store into an export bundle. */
export function collectExportBundle(): ExportBundle {
  return buildExportBundle({
    actionItems: [...useActionItems.getState().byId.values()],
    projects: [...useProjects.getState().byId.values()],
    goals: [...useGoals.getState().byId.values()],
    questions: [...useQuestions.getState().byId.values()],
    answers: [...useAnswers.getState().byId.values()],
    webLinks: [...useWebLinks.getState().byId.values()],
    thoughts: [...useThoughts.getState().byId.values()],
    currentFocus: useFocus.getState().doc
  })
}

/** Serializes the export bundle and triggers a browser download. */
export function downloadExportBundle(): void {
  const bundle = collectExportBundle()
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `life-advisor-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
