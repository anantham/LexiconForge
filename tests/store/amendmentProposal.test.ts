import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../../store'
import { AmendmentProposal } from '../../types'
import { INITIAL_SYSTEM_PROMPT } from '../../config/constants'
import { indexedDBService } from '../../services/indexeddb'

describe('Amendment Proposal System', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await indexedDBService.clearAllData()
    // Reset store state after clearing persistence
    await useAppStore.getState().clearSession()
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
    it('should handle empty proposal gracefully', async () => {
      await useAppStore.getState().acceptProposal()

      // Should not throw or cause errors, just return early
      expect(useAppStore.getState().amendmentProposal).toBeNull()
    })

    it('should successfully replace exact text match', async () => {
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
      await store.acceptProposal()

      // Check that the rule was updated
      const updatedPrompt = useAppStore.getState().settings.systemPrompt
      expect(updatedPrompt).toContain('Test Rule: This is the updated rule.')
      expect(updatedPrompt).not.toContain('Test Rule: This is the original rule.')
    })

  })

  describe('rejectProposal', () => {
    it('should clear amendment proposal', async () => {
      const proposal = createTestProposal('test', 'test')
      useAppStore.setState({ amendmentProposal: proposal })

      expect(useAppStore.getState().amendmentProposal).toBe(proposal)

      await useAppStore.getState().rejectProposal()

      expect(useAppStore.getState().amendmentProposal).toBeNull()
    })

    it('should not affect system prompt', async () => {
      const store = useAppStore.getState()
      const originalPrompt = 'Original system prompt'
      store.updateSettings({ systemPrompt: originalPrompt })

      const proposal = createTestProposal('original', 'changed')
      useAppStore.setState({ amendmentProposal: proposal })

      await store.rejectProposal()

      expect(useAppStore.getState().settings.systemPrompt).toBe(originalPrompt)
    })
  })

  describe('editAndAcceptProposal', () => {
    it('should accept a modified proposal change', async () => {
      const store = useAppStore.getState()

      const initialPrompt = `${INITIAL_SYSTEM_PROMPT}\n\nTest Rule: Original content.`
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal(
        'Test Rule: Original content.',
        '+ Test Rule: AI suggested change.'
      )

      useAppStore.setState({ amendmentProposal: proposal })

      // User modifies the suggestion
      const modifiedChange = '+ Test Rule: User customized change.'
      await store.editAndAcceptProposal(modifiedChange)

      const updatedPrompt = useAppStore.getState().settings.systemPrompt
      expect(updatedPrompt).toContain('Test Rule: User customized change.')
      expect(updatedPrompt).not.toContain('AI suggested change')
      expect(useAppStore.getState().amendmentProposal).toBeNull()
    })

    it('should strip diff markers from modified change', async () => {
      const store = useAppStore.getState()

      const initialPrompt = `Rule section:\nOld rule here`
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal(
        'Old rule here',
        '+ New rule here'
      )

      useAppStore.setState({ amendmentProposal: proposal })

      await store.editAndAcceptProposal('+ Modified rule\n- With diff markers')

      const updatedPrompt = useAppStore.getState().settings.systemPrompt
      expect(updatedPrompt).toContain('Modified rule\nWith diff markers')
      expect(updatedPrompt).not.toContain('+')
      expect(updatedPrompt).not.toContain('-')
    })

    it('should handle empty modified change', async () => {
      const store = useAppStore.getState()

      const initialPrompt = 'Some prompt with rule'
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal('rule', 'new rule')
      useAppStore.setState({ amendmentProposal: proposal })

      await store.editAndAcceptProposal('')

      // Should replace with empty string
      expect(useAppStore.getState().settings.systemPrompt).toBe('Some prompt with ')
      expect(useAppStore.getState().amendmentProposal).toBeNull()
    })
  })

  describe('amendment logging', () => {
    it('should log accepted amendments', async () => {
      const store = useAppStore.getState()

      const initialPrompt = `${INITIAL_SYSTEM_PROMPT}\n\nRule A`
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal('Rule A', 'Rule B')
      useAppStore.setState({ amendmentProposal: proposal })

      await store.acceptProposal()

      // Check that the amendment was logged
      const logs = await indexedDBService.getAmendmentLogs({ limit: 1 })

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].action).toBe('accepted')
      expect(logs[0].proposal.currentRule).toBe('Rule A')
      expect(logs[0].finalPromptChange).toBe('Rule B')
    })

    it('should log rejected amendments', async () => {
      const store = useAppStore.getState()

      const proposal = createTestProposal('Old', 'New')
      useAppStore.setState({ amendmentProposal: proposal })

      await store.rejectProposal()

      const logs = await indexedDBService.getAmendmentLogs({ action: 'rejected', limit: 1 })

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].action).toBe('rejected')
      expect(logs[0].proposal.currentRule).toBe('Old')
    })

    it('should log modified amendments with final change', async () => {
      const store = useAppStore.getState()

      const initialPrompt = 'Test: original'
      store.updateSettings({ systemPrompt: initialPrompt })

      const proposal = createTestProposal('original', 'AI suggestion')
      useAppStore.setState({ amendmentProposal: proposal })

      const modifiedChange = 'User modification'
      await store.editAndAcceptProposal(modifiedChange)

      const logs = await indexedDBService.getAmendmentLogs({ action: 'modified', limit: 1 })

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].action).toBe('modified')
      expect(logs[0].proposal.proposedChange).toBe('AI suggestion')
      expect(logs[0].finalPromptChange).toBe('User modification')
    })

    it('should retrieve amendment statistics', async () => {
      const store = useAppStore.getState()
      // Clear any existing logs first
      const existingLogs = await indexedDBService.getAmendmentLogs()
      for (const log of existingLogs) {
        await indexedDBService.deleteAmendmentLog(log.id)
      }

      // Create and process multiple proposals
      const initialPrompt = 'Base prompt with rules'
      store.updateSettings({ systemPrompt: initialPrompt })

      // Accept one
      const proposal1 = createTestProposal('rules', 'updated rules')
      useAppStore.setState({ amendmentProposal: proposal1 })
      await store.acceptProposal()

      // Reject one
      const proposal2 = createTestProposal('test', 'changed')
      useAppStore.setState({ amendmentProposal: proposal2 })
      await store.rejectProposal()

      // Modify one
      const proposal3 = createTestProposal('another', 'suggestion')
      useAppStore.setState({ amendmentProposal: proposal3 })
      await store.editAndAcceptProposal('custom')

      const stats = await indexedDBService.getAmendmentStats()

      expect(stats.total).toBeGreaterThanOrEqual(3)
      expect(stats.accepted).toBeGreaterThanOrEqual(1)
      expect(stats.rejected).toBeGreaterThanOrEqual(1)
      expect(stats.modified).toBeGreaterThanOrEqual(1)
    })
  })
})
