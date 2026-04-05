/**
 * Self-insert service — calls the novel-analyzer bridge to set up
 * a SillyTavern group chat for the current chapter.
 */

export interface SelfInsertRequest {
  chapterNumber: number;
  characterNames: string[];
  selectedPassage: string;
  chapterTranslation: string;
  chapterTitle: string;
}

export interface SelfInsertResponse {
  success: boolean;
  stUrl?: string;
  groupId?: string;
  charactersLoaded?: string[];
  charactersSkipped?: string[];
  error?: string;
  message?: string;
}

export async function requestSelfInsert(
  bridgeUrl: string,
  request: SelfInsertRequest,
): Promise<SelfInsertResponse> {
  const resp = await fetch(`${bridgeUrl}/api/self-insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    return {
      success: false,
      error: 'bridge_error',
      message: `Bridge returned ${resp.status}: ${resp.statusText}`,
    };
  }

  return resp.json();
}
