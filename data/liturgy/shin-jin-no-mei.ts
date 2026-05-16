/**
 * Shin-Jin-No-Mei — *On Trust in the Heart-Mind* (Xinxin Ming, 信心銘).
 *
 * Traditionally attributed to the Third Chinese Chan Patriarch Sengcan
 * (Jp. Sōsan, d. 606). One of the foundational verse texts of the
 * Northern Buddhist tradition — the spare, paradoxical articulation of
 * non-duality that became canonical across Chan, Zen, and Korean Sŏn.
 *
 * Bodhi Sangha\'s booklet (May 2016, pp.4-7) presents the Richard B.
 * Clarke translation with modifications for chanting cadence. Not in
 * verse couplets — long single sections flowing into each other,
 * mirroring how it\'s actually chanted at Bodhi Zendō.
 *
 * Closing line in the booklet: *Namo Tassa Bhagavato Arahato Samma
 * Sambuddhassa* — the standard Theravāda Pali homage, placed at the
 * end as a between-chant grounding rather than as part of the Xinxin
 * Ming itself. That line is captured separately under [[ti-sarana]].
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const shinJinNoMei: LiturgyDoc = {
  slug: 'shin-jin-no-mei',
  sangha: 'bodhi-sangha',
  order: 5,
  title: 'On Trust in the Heart-Mind',
  subtitle: 'Shin-Jin-No-Mei (信心銘) — Sengcan, Third Chan Patriarch',
  tradition: 'zen',
  context: 'Chanted at Bodhi Sangha as the longest sustained verse text in the daily liturgy. Sengcan\'s Xinxin Ming is the foundational articulation of non-duality in the Chan / Zen tradition; nearly every later Zen text quotes it.',
  sources: {
    canonical: [
      { label: 'Xinxin Ming / Shinjin no Mei (信心銘)', url: 'https://en.wikipedia.org/wiki/Xinxin_Ming' },
      { label: 'Sengcan (Sōsan, d. 606)', url: 'https://en.wikipedia.org/wiki/Sengcan' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), pp.4-7' },
    ],
  },
  curator:
    'Curation by Aditya. The base English is Richard B. Clarke\'s translation (the standard mid-20th-century rendering used across Western Zen centres). The Bodhi booklet notes: "Modifications have been made in the translation and in the text to convey the meaning better." Sections are grouped by the booklet\'s natural breaks — roughly: opening axiom, the non-preference instruction, the unity teaching, dualities and non-attachment, the ten thousand things, the trusting mind, and the final paradox.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Sengcan (Jp. Sōsan) was the Third Chinese Chan Patriarch — the lineage from Bodhidharma → Huike → Sengcan → Daoxin → Hongren → Huineng that grounds the Chan / Zen self-understanding. Almost nothing biographical survives; what survives is this short verse text, *Xinxin Ming* (信心銘) — *Inscription on Trust in the Heart-Mind*.\n\nThe text\'s logic is consistently negative-dialectical: every assertion calls forth its complement, and the practice instruction is to neither cling to the assertion nor cling to its complement. *The Great Way is not difficult / for those who have no preferences.* The non-preferring mind is not indifference — it is the mind that does not seize any of its contents as ultimate.\n\nBodhi Sangha\'s booklet introduces the text: "Traditionally said to be composed by the Third Patriarch, Seng-ts\'an, Jap. Sōsan; d. 606. The basic translation is by Richard B. Clarke. Modifications have been made in the translation and in the text to convey the meaning better."',
    },
    {
      id: 'opening',
      shape: 'prose-commentary',
      heading: 'The Great Way',
      body: 'The Great Way is not difficult\nfor those who have no preferences.\nWhen craving and hatred are both absent\neverything becomes clear and undisguised.\nCling to an attachment even the smallest,\nand heaven and earth are set infinitely apart.\n\nIf you wish to see the truth\nthen cling to no opinion for or against.\nThe struggle of what one likes and what one dislikes\nis the disease of the mind.\nWhen the deep meaning of things is not understood\nthe mind\'s essential peace is disturbed to no avail.',
    },
    {
      id: 'vast-space',
      shape: 'prose-commentary',
      heading: 'Vast space',
      body: 'The Way is perfect like vast space\nwhere nothing is lacking and nothing is in excess.\nIndeed, it is due to our choosing to accept or reject\nthat we do not see the true nature of things.\nLive neither in the entanglements of outer things\nnor in inner feeling of emptiness.\n\nBe peace in striving activity,\nin the Oneness of things,\nand erroneous views will disappear by themselves.\nWhen you try to stop activity to achieve passivity,\nyour very effort fills you with activity.\nAs long as you are attached to one extreme or the other\nyou will never know Oneness.',
    },
    {
      id: 'single-way',
      shape: 'prose-commentary',
      heading: 'The single Way',
      body: 'Those who do not live in the single Way\nfail in both activity and passivity, assertion and denial.\nTo deny the reality of things\nis to miss their reality;\nto assert the emptiness of things\nis again to miss their reality.\nThe more you talk and think about it,\nthe further astray you wander from the truth.\nStop arguing and debating\nand there is nothing you will not be able to know.\n\nTo return to the root to find the meaning,\nbut to pursue appearances is to miss the source.\nAt the moment of inner enlightenment\nthere is a going beyond appearance and emptiness.\nThe changes that appear to occur in the empty world\nwe call real only because of our ignorance.\nDo not contend for the truth;\nonly cease to cling to opinions.\nDo not stick to the dualistic state,\navoid such pursuits carefully.\nIf you cling to this and that, to right and not-right,\nthe Mind-essence will be lost in confusion.',
    },
    {
      id: 'duality-dissolves',
      shape: 'prose-commentary',
      heading: 'Where duality dissolves',
      body: 'Although all dualities come from the mind,\ndo not be attached even to this Oneness.\nWhen mind exists undisturbed in the Way,\nnothing in the world can offend,\nand when a thing can no longer offend\nit ceases to exist in the old way.\nWhen no dualistic thoughts arise,\nthe old mind ceases to exist.\nWhen thought-objects vanish,\nthe thinking subject vanishes;\nas when the mind vanishes, objects vanish.',
    },
    {
      id: 'unified-mind',
      shape: 'prose-commentary',
      heading: 'The unified mind',
      body: 'Things are objects because of the subject;\nthe mind is such because of things.\nUnderstand the relativity of these two,\nand the basic reality: the unity of emptiness.\nIn this Emptiness the two are indistinguishable.\nAnd each contains in itself the whole world.\nIf you are not stuck on coarse and fine\nyou will not be tempted to prejudice and opinion.\n\nTo live in the Great Way\nis neither easy nor difficult,\nbut those with limited views\nare fearful and irresolute\nand the faster they hurry, the slower they go\nand clinging has no end:\neven to be attached to the idea of enlightenment is to go astray.\nJust let things be in their own way\nand there will be neither coming nor going.\nObey the nature of things,\nand you will walk freely and undisturbed.',
    },
    {
      id: 'one-dharma',
      shape: 'prose-commentary',
      heading: 'One Dharma',
      body: 'When thought is in bondage, the truth is hidden,\nfor everything is murky and unclear,\nand the burdensome practice of judging\nbrings annoyance and weariness.\nWhat benefit can be derived from dualistic separations?\n\nIf you wish to move in the One Way\ndo not dislike even the world of senses and ideas.\nIndeed, to accept them fully\nis identical with true enlightenment.\nThe wise are not driven by goals, but the foolish fetter themselves.\nThere is one Dharma, not many;\nattachments arise from the clinging needs of the ignorant.\nTo seek Mind with the discriminating mind\nis the greatest of all mistakes.',
    },
    {
      id: 'rest-and-unrest',
      shape: 'prose-commentary',
      heading: 'Rest and unrest',
      body: 'Rest and unrest derive from illusion;\nwith enlightenment there is no attachment to liking and disliking.\nAll dualisms come from ignorant inference.\nThey are like dreams or flowers in the air:\nthe foolish try to grasp them.\nGain and loss, right and not-right — go far beyond\nsuch illusive thoughts and attachments.\n\nIf the eye never sleeps,\nall dreams will naturally cease.\nIf the mind makes no discriminations,\nthe ten thousand things are as they are, of single Essence.\nTo understand the mystery of this One-Essence\nis to be released from all entanglements.\nWhen all things are seen equally,\nthe timeless Self-Essence is reached.\nNo comparisons or analogies are possible\nin this causeless, relationless state.\nConsider movement stationary,\nand the stationary in motion,\nand both the state of movement and the state of rest disappear.\nWhen such dualities cease to exist,\nOneness itself cannot exist.\nTo this ultimate finality,\nno law or description applies.',
    },
    {
      id: 'trusting-mind',
      shape: 'prose-commentary',
      heading: 'The trusting mind',
      body: 'For the unified mind in accord with the Way,\nall self-centered striving ceases.\nDoubts and irresolutions vanish\nand life in true faith becomes possible.\nWith a single stroke we are freed from bondage;\nnothing clings to us, and we cling to nothing.\nAll is empty, clear, self-illuminating,\nwith no exertion of the mind\'s power.\nHere, thought, feeling, knowledge and imagination are of no avail.\n\nIn this world of Suchness there is neither self nor other than self.\nTo come directly into harmony with this reality\njust simply say when doubts arise: \'not-two\'.\nIn this \'not-two\' nothing is separate, nothing is excluded.\nNo matter when or where, enlightenment means entering this truth.\nAnd this truth is beyond extension or diminution in time or space.\nIn it a single thought is ten thousand years.\nEmptiness here, Emptiness there,\nbut the infinite universe stands always before your eyes.\nInfinitely large and infinitely small, no difference;\nfor definitions have vanished and no boundaries are seen.\nSo too with Being and Non-Being: Is and Is-not.\nDon\'t waste time in doubts and arguments\nthat have nothing to do with this.',
    },
    {
      id: 'no-yesterday',
      shape: 'prose-commentary',
      heading: 'No yesterday',
      body: 'One thing, all things, move among and intermingle without clinging.\nTo live in this realization\nis to be without anxiety about non-perfection.\nTo live in this faith is the road to non-duality\nbecause the non-dual is one with the trusting Mind.\n\nWords!\nThe Way is beyond dualistic language,\nfor in it there is\n     no yesterday,\n     no tomorrow,\n     no today.',
    },
    {
      id: 'closing-note',
      shape: 'prose-commentary',
      heading: 'On the text',
      body: 'The booklet credits the basic translation to Richard B. Clarke (1973, *Hsin-Hsin Ming: Verses on the Faith-Mind*). Bodhi Sangha\'s version makes line-level changes to fit chanting cadence and clarify meaning — those changes are silent in the booklet, but anyone wanting the original Chinese 信心銘 or the Clarke base text can compare directly.\n\nThe closing image (*no yesterday, no tomorrow, no today*) is sometimes read as Sengcan\'s own composition, sometimes as a later additon — the textual transmission of the *Xinxin Ming* is complicated. Either way, it is the way the chant ends at Bodhi Zendō.',
    },
  ],
};

export default shinJinNoMei;
