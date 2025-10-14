import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../../../store'
import { AmendmentProposal } from '../../../types'
import { INITIAL_SYSTEM_PROMPT } from '../../../config/constants'

const createTestProposal = (
  currentRule: string,
  proposedChange: string
): AmendmentProposal => ({
  observation: 'Legacy observation',
  currentRule,
  proposedChange,
  reasoning: 'Legacy reasoning'
})

describe.skip('Legacy amendment proposal diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should strip +/- prefixes from proposed changes', () => {
    const store = useAppStore.getState()
    const initialPrompt = `${INITIAL_SYSTEM_PROMPT}\n\nOriginal: Simple rule`
    store.updateSettings({ systemPrompt: initialPrompt })

    const proposal = createTestProposal(
      'Original: Simple rule',
      '+ Updated: Complex rule with additions\n- Removed: Old functionality'
    )

    useAppStore.setState({ amendmentProposal: proposal })
    store.acceptProposal()

    const updatedPrompt = useAppStore.getState().settings.systemPrompt
    expect(updatedPrompt).toContain('Updated: Complex rule with additions')
    expect(updatedPrompt).toContain('Removed: Old functionality')
    expect(updatedPrompt).not.toContain('+ Updated:')
    expect(updatedPrompt).not.toContain('- Removed:')
  })

  it('should handle multiline rules correctly', () => {
    const store = useAppStore.getState()

    const multilineRule = `Glossary Rules:
- Term 1: Translation 1
- Term 2: Translation 2`

    const initialPrompt = `${INITIAL_SYSTEM_PROMPT}\n\n${multilineRule}`
    store.updateSettings({ systemPrompt: initialPrompt })

    const proposedChange = `+ Glossary Rules:
+ - Term 1: Translation 1
+ - Term 2: Translation 2
+ - Term 3: Translation 3`

    const proposal = createTestProposal(multilineRule, proposedChange)

    useAppStore.setState({ amendmentProposal: proposal })
    store.acceptProposal()

    const updatedPrompt = useAppStore.getState().settings.systemPrompt
    expect(updatedPrompt).toContain('Term 3: Translation 3')
    expect(updatedPrompt).not.toContain('+ - Term 3:')
  })

  it('should clear amendment proposal after acceptance', () => {
    const store = useAppStore.getState()
    const proposal = createTestProposal('original', 'updated')
    useAppStore.setState({ amendmentProposal: proposal })

    expect(useAppStore.getState().amendmentProposal).toBe(proposal)

    store.acceptProposal()

    expect(useAppStore.getState().amendmentProposal).toBeNull()
  })

  it('should log detailed debug information', async () => {
    const consoleGroupSpy = vi.spyOn(console, 'groupCollapsed')
    const consoleLogSpy = vi.spyOn(console, 'log')
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd')

    const store = useAppStore.getState()
    const initialPrompt = 'Test prompt with specific rule'
    store.updateSettings({ systemPrompt: initialPrompt })

    const proposal = createTestProposal('specific rule', 'updated rule')
    useAppStore.setState({ amendmentProposal: proposal })

    await store.acceptProposal()

    expect(consoleGroupSpy).toHaveBeenCalledWith('[Amendment] Processing proposal acceptance')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Amendment] Current system prompt (first 300 chars):',
      expect.any(String)
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Amendment] Searching for current rule:',
      'specific rule'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Amendment] Original proposed change:',
      'updated rule'
    )
    expect(consoleGroupEndSpy).toHaveBeenCalled()
  })

  it('should detect when rule is not found in system prompt', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const store = useAppStore.getState()

    store.updateSettings({ systemPrompt: 'This prompt does not contain the rule' })

    const proposal = createTestProposal('nonexistent rule', 'replacement')
    useAppStore.setState({ amendmentProposal: proposal })

    store.acceptProposal()

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Amendment] Current rule not found in system prompt - replacement will fail'
    )
  })

  it('should detect when replacement fails', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const store = useAppStore.getState()

    const originalPrompt = 'Original system prompt'
    store.updateSettings({ systemPrompt: originalPrompt })

    const proposal = createTestProposal('does not exist', 'replacement')
    useAppStore.setState({ amendmentProposal: proposal })

    store.acceptProposal()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Amendment] Replacement failed - system prompt unchanged'
    )
    expect(useAppStore.getState().settings.systemPrompt).toBe(originalPrompt)
  })

  it('should show context around changed section', () => {
    const consoleLogSpy = vi.spyOn(console, 'log')
    const store = useAppStore.getState()

    const longPrompt =
      'This is a very long system prompt with many words and sentences that will help us test the context display functionality around the changed section.'
    const ruleToReplace = 'many words and sentences'
    const replacement = 'few words and phrases'

    store.updateSettings({ systemPrompt: longPrompt })

    const proposal = createTestProposal(ruleToReplace, replacement)
    useAppStore.setState({ amendmentProposal: proposal })

    store.acceptProposal()

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Amendment] Changed section with context:',
      expect.stringContaining('few words and phrases')
    )
  })

  it('should handle real-world glossary amendments', () => {
    const originalConsole = global.console
    global.console = console

    const store = useAppStore.getState()
    store.updateSettings({ systemPrompt: INITIAL_SYSTEM_PROMPT })

    const glossaryMatch = INITIAL_SYSTEM_PROMPT.match(
      /Novel-Specific Glossary \(Live Document\): This glossary will be maintained for consistency\.\nRomaji Terms: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai\.\nTranslated Terms: Almiraj \(Horned Rabbit\), Frost Wraith, 認定票 \(Adventurer's Medallion\)\./
    )

    const currentRule =
      glossaryMatch ??
      'Novel-Specific Glossary (Live Document): This glossary will be maintained for consistency.\nRomaji Terms: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai.\nTranslated Terms: Almiraj (Horned Rabbit), Frost Wraith, 認定票 (Adventurer\'s Medallion).'

    const proposedChange = `+ Add to Translated Terms: 森人 (Moribito) -> Forestfolk (elf-like race); 死霊兵 -> Necrosoldier(s); 聖騎士 -> Holy Knight (Paladin).
+ Add to Romaji Terms (for reference only): Moribito.
- No change to existing entries.`

    const proposal = createTestProposal(
      currentRule.toString(),
      proposedChange
    )
    useAppStore.setState({ amendmentProposal: proposal })

    store.acceptProposal()

    const updatedPrompt = useAppStore.getState().settings.systemPrompt
    expect(updatedPrompt).toContain('森人 (Moribito) -> Forestfolk')
    expect(updatedPrompt).toContain('死霊兵 -> Necrosoldier(s)')
    expect(updatedPrompt).toContain('聖騎士 -> Holy Knight (Paladin)')

    global.console = originalConsole
  })
})
