import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../../store'
import { AmendmentProposal } from '../../types'
import { INITIAL_SYSTEM_PROMPT } from '../../constants'

describe('Amendment Proposal System', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().clearSession()
    vi.clearAllMocks()
  })

  const createTestProposal = (
    currentRule: string,
    proposedChange: string
  ): AmendmentProposal => ({
    observation: 'Test observation',
    currentRule,
    proposedChange,
    reasoning: 'Test reasoning'
  })

  describe('acceptProposal', () => {
    it('should handle empty proposal gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn')
      
      useAppStore.getState().acceptProposal()
      
      expect(consoleSpy).toHaveBeenCalledWith('[Amendment] No amendment proposal to accept')
    })

    it('should successfully replace exact text match', () => {
      const store = useAppStore.getState()
      
      // Set up initial system prompt with a specific rule
      const initialPrompt = `${INITIAL_SYSTEM_PROMPT}\n\nTest Rule: This is the original rule.`
      store.updateSettings({ systemPrompt: initialPrompt })

      // Create proposal to change the rule
      const proposal = createTestProposal(
        'Test Rule: This is the original rule.',
        'Test Rule: This is the updated rule.'
      )

      // Set amendment proposal
      useAppStore.setState({ amendmentProposal: proposal })

      // Accept the proposal
      store.acceptProposal()

      // Check that the rule was updated
      const updatedPrompt = useAppStore.getState().settings.systemPrompt
      expect(updatedPrompt).toContain('Test Rule: This is the updated rule.')
      expect(updatedPrompt).not.toContain('Test Rule: This is the original rule.')
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

    it('should log detailed debug information', () => {
      const consoleGroupSpy = vi.spyOn(console, 'groupCollapsed')
      const consoleLogSpy = vi.spyOn(console, 'log')
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd')

      const store = useAppStore.getState()
      const initialPrompt = 'Test prompt with specific rule'
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal('specific rule', 'updated rule')
      useAppStore.setState({ amendmentProposal: proposal })

      store.acceptProposal()

      // Check that logging occurred
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

      // Try to replace something that doesn't exist
      const proposal = createTestProposal('does not exist', 'replacement')
      useAppStore.setState({ amendmentProposal: proposal })

      store.acceptProposal()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Amendment] Replacement failed - system prompt unchanged'
      )

      // Prompt should remain unchanged
      expect(useAppStore.getState().settings.systemPrompt).toBe(originalPrompt)
    })

    it('should show context around changed section', () => {
      const consoleLogSpy = vi.spyOn(console, 'log')
      const store = useAppStore.getState()
      
      const longPrompt = 'This is a very long system prompt with many words and sentences that will help us test the context display functionality around the changed section.'
      const ruleToReplace = 'many words and sentences'
      const replacement = 'few words and phrases'

      store.updateSettings({ systemPrompt: longPrompt })

      const proposal = createTestProposal(ruleToReplace, replacement)
      useAppStore.setState({ amendmentProposal: proposal })

      store.acceptProposal()

      // Should show context around the change
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Amendment] Changed section with context:',
        expect.stringContaining('few words and phrases')
      )
    })

    it('should handle real-world glossary amendments', () => {
      // Temporarily restore console logging to see what's happening
      const originalConsole = global.console
      global.console = console

      const store = useAppStore.getState()
      
      // Use the exact INITIAL_SYSTEM_PROMPT that gets loaded by default
      console.log('Initial prompt length:', INITIAL_SYSTEM_PROMPT.length)
      console.log('Initial prompt contains glossary:', INITIAL_SYSTEM_PROMPT.includes('Novel-Specific Glossary'))
      
      store.updateSettings({ systemPrompt: INITIAL_SYSTEM_PROMPT })

      // Extract the exact glossary section from the constant (updated with consolidated glossary)
      const glossaryMatch = INITIAL_SYSTEM_PROMPT.match(/Novel-Specific Glossary \(Live Document\): This glossary will be maintained for consistency\.\nRomaji Terms: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai\.\nTranslated Terms: Almiraj \(Horned Rabbit\), Frost Wraith, 認定票 \(Adventurer's Medallion\)\./);
      
      if (!glossaryMatch) {
        console.error('Could not find glossary section in INITIAL_SYSTEM_PROMPT')
        console.log('Available text around glossary:')
        const glossaryIndex = INITIAL_SYSTEM_PROMPT.indexOf('Novel-Specific Glossary')
        console.log(INITIAL_SYSTEM_PROMPT.substring(glossaryIndex, glossaryIndex + 200))
      }

      const currentRule = glossaryMatch ? glossaryMatch[0] : 'Novel-Specific Glossary (Live Document): This glossary will be maintained for consistency.\nRomaji Terms: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai.\nTranslated Terms: Almiraj (Horned Rabbit), Frost Wraith, 認定票 (Adventurer\'s Medallion).'

      console.log('Current rule to replace:', JSON.stringify(currentRule))
      console.log('Rule found in prompt:', INITIAL_SYSTEM_PROMPT.includes(currentRule))

      const proposedChange = `+ Add to Translated Terms: 森人 (Moribito) -> Forestfolk (elf-like race); 死霊兵 -> Necrosoldier(s); 聖騎士 -> Holy Knight (Paladin).
+ Add to Romaji Terms (for reference only): Moribito.
- No change to existing entries.`

      const proposal = createTestProposal(currentRule, proposedChange)
      useAppStore.setState({ amendmentProposal: proposal })

      store.acceptProposal()

      const updatedPrompt = useAppStore.getState().settings.systemPrompt
      console.log('Updated prompt contains new terms:', updatedPrompt.includes('森人'))
      console.log('Replacement worked:', updatedPrompt !== INITIAL_SYSTEM_PROMPT)
      
      expect(updatedPrompt).toContain('森人 (Moribito) -> Forestfolk')
      expect(updatedPrompt).toContain('死霊兵 -> Necrosoldier(s)')
      expect(updatedPrompt).toContain('聖騎士 -> Holy Knight (Paladin)')
      expect(updatedPrompt).not.toContain('+ Add to Translated Terms:')

      // Restore mocked console
      global.console = originalConsole
    })
  })

  describe('rejectProposal', () => {
    it('should clear amendment proposal', () => {
      const proposal = createTestProposal('test', 'test')
      useAppStore.setState({ amendmentProposal: proposal })

      expect(useAppStore.getState().amendmentProposal).toBe(proposal)

      useAppStore.getState().rejectProposal()

      expect(useAppStore.getState().amendmentProposal).toBeNull()
    })

    it('should not affect system prompt', () => {
      const store = useAppStore.getState()
      const originalPrompt = 'Original system prompt'
      store.updateSettings({ systemPrompt: originalPrompt })

      const proposal = createTestProposal('original', 'changed')
      useAppStore.setState({ amendmentProposal: proposal })

      store.rejectProposal()

      expect(useAppStore.getState().settings.systemPrompt).toBe(originalPrompt)
    })
  })
})