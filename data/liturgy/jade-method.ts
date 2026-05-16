/**
 * The Jade Method — MAPLE's contemplative practice instruction.
 *
 * Not a traditional canonical chant — a contemporary MAPLE practice text
 * (Soryu Forall's articulation) that's recited / contemplated as part of
 * the daily training. Seven stages of body-breath stabilisation, focus
 * cultivation, and progressive abandoning, all in service of one
 * orienting question:
 *
 *   "How can I give my body, mind, and life completely to Great Love
 *    for the benefit of all beings?"
 *
 * English-only. Prose-commentary throughout — no Pali/Sanskrit/Tibetan
 * since the text was composed in English. The chant-like cadence lives
 * in the parallel-structured pairs ("Body Stable, Breath Calm" etc.)
 * which we render with line-break formatting.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const jadeMethod: LiturgyDoc = {
  slug: 'jade-method',
  title: 'The Jade Method',
  subtitle: 'A contemplative practice in seven stages',
  tradition: 'maple',
  context: 'Chanted / contemplated at MAPLE as part of training.',
  sources: {
    ritual: [
      { label: 'MAPLE practice text (Soryu Forall)' },
    ],
  },
  curator:
    'Curation by Aditya. Text reproduced from the MAPLE practice sheet. No Pali/Sanskrit antecedent — this is a contemporary articulation in English, structured for chanting cadence.',
  sections: [
    {
      id: 'orienting-question',
      shape: 'prose-commentary',
      heading: 'The orienting question',
      body: '*How can I give my body, mind, and life completely to Great Love for the benefit of all beings?*\n\nPut all aspects of your life in accord with this. The steps you take incessantly and completely to answer this question give the practice meaning and power.',
    },
    {
      id: 'stage-1',
      shape: 'prose-commentary',
      heading: '1.',
      body: '**Body Stable, Breath Calm**\n**Body Rooted, Breath Energetic**\n**Body Centered, Breath Centered**\n**Body Open, Breath Playful**\n**Body Tall, Breath Whole**\n\n*Rid Want, Rouse Freedom*\n*Rid Hate, Rouse Love*\n*Rid Stupor, Rouse Energy*\n*Rid Worry, Rouse Faith*\n*Rid Doubt, Rouse Doubt*',
    },
    {
      id: 'stage-2',
      shape: 'prose-commentary',
      heading: '2.',
      body: 'Settle awareness on the *focus space*. If distracted, use thinking to bring it back. If you are aware of ideas, self or attachment, and especially *attachment to ideas of self*, you are missing the point. If you are aware of your focus space, you are getting the point. Have fun.',
    },
    {
      id: 'stage-3',
      shape: 'prose-commentary',
      heading: '3.',
      body: "Enjoy the challenge of *self-control* based on bringing your attention to the focus space and laying it on the focus space. Spread the joyful exhilaration of *fun and integrity* through your whole body. While in this stage, attachment to things of the world becomes obsolete, so one no longer feeds structures of injustice.",
    },
    {
      id: 'stage-4',
      shape: 'prose-commentary',
      heading: '4.',
      body: 'Abandon thinking. Spread the joyful wonder of *concentration and ease* through your whole body. While in this stage, self-control becomes obsolete, so one does not fight or fix oneself or others.',
    },
    {
      id: 'stage-5',
      shape: 'prose-commentary',
      heading: '5.',
      body: "Abandon self. Spread the peaceful bliss of *directly knowing oneness and freedom from hope-and-fear* through your whole body. While in this stage, through not adding on, one's mind is dead.",
    },
    {
      id: 'stage-6',
      shape: 'prose-commentary',
      heading: '6.',
      body: "Abandon attachment. Spread the peaceful honesty of *no-pleasure-and-pain and unhindered clarity due to perceptual non-interference* through your whole body. While in this stage, through no friction, one's mind is gone.",
    },
    {
      id: 'stage-7',
      shape: 'prose-commentary',
      heading: '7.',
      body: 'Affirm, or negate, or question, to realize this completely:\n\n*How can I give my body, mind, and life completely to Great Love for the benefit of all beings?*',
    },
  ],
};

export default jadeMethod;
