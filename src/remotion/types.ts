/**
 * The flattened shape every scene component (and the top-level Newscast
 * composition) receives. Deliberately decoupled from SummarizeNewsOutput —
 * the Remotion side shouldn't need to know about Trigger.dev task types, and
 * `sourceNames` is resolved (id -> name) by generate-video.ts before
 * rendering, keeping data-fetching out of the render tier entirely.
 */
export interface NewscastVideoProps {
  // Index signature so this satisfies Remotion's Record<string, unknown>
  // constraint on Composition/renderMedia props.
  [key: string]: unknown;
  headline: string;
  dek: string;
  whatHappened: string;
  keyDevelopments: string[];
  whyItMatters: string;
  timeline: Array<{ label: string; description: string }>;
  sourceNames: string[];
  audioUrl: string;
  durationSeconds: number;
}
