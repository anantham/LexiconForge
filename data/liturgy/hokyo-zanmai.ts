/**
 * Hōkyō Zanmai — *Song of the Jewel Mirror Awareness* (寶鏡三昧, Baojing Sanmei).
 *
 * Composed by Dongshan Liangjie (807–869, Jp. Tōzan Ryōkai), founder of
 * the Cao-dong (Sōtō) line. Hands down the *Five Ranks* (五位, go-i)
 * teaching of relative-absolute integration that anchors Sōtō Zen
 * dialectic.
 *
 * Bodhi Sangha\'s booklet (pp.8-10) uses Thomas Cleary\'s translation
 * from *Timeless Spring: A Soto Zen Anthology* (Wheelwright Press, 1980).
 * Sections grouped by Cleary\'s natural rhetorical breaks.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const hokyoZanmai: LiturgyDoc = {
  slug: 'hokyo-zanmai',
  sangha: 'bodhi-sangha',
  order: 6,
  title: 'Song of the Jewel Mirror Awareness',
  subtitle: 'Hōkyō Zanmai (寶鏡三昧) — Dongshan Liangjie / Tōzan Ryōkai',
  tradition: 'zen',
  context: 'One of the Sōtō Zen tradition\'s foundational verse texts, attributed to Dongshan Liangjie (Jp. Tōzan Ryōkai, 807-869), founder of the Caodong / Sōtō line. The Bodhi Sangha booklet uses Thomas Cleary\'s translation. The text contains the *Five Ranks* teaching at its heart — relative and absolute as integrated, not opposed.',
  sources: {
    canonical: [
      { label: 'Hōkyō Zanmai / Baojing Sanmei (寶鏡三昧)', url: 'https://en.wikipedia.org/wiki/Song_of_the_Precious_Mirror_Samadhi' },
      { label: 'Dongshan Liangjie (Tōzan Ryōkai, 807-869)', url: 'https://en.wikipedia.org/wiki/Dongshan_Liangjie' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), pp.8-10' },
      { label: 'Thomas Cleary, *Timeless Spring: A Soto Zen Anthology* (1980)' },
    ],
  },
  curator:
    'Curation by Aditya. The English is Thomas Cleary\'s rendering, transcribed from the Bodhi Sangha booklet. Cleary\'s translation notes (transcribed under the closing section) trace the *Five Ranks* and the *Samādhi* of the title. Where Cleary uses *awareness* in the title rather than *samadhi*, he explains: "to avoid any suggestion of paranormality" — keeping the dharma-language plain.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Dongshan\'s *Song of the Jewel Mirror Awareness* hands down the *Five Ranks* (五位, go-i) — the dialectic of how the relative and absolute, the apparent and real, mutually penetrate. The opening image: filling a silver bowl with snow, hiding a heron in the moonlight. Each is itself + a slight asymmetry within itself. The relative is not separate from the absolute; their integration is the Way.\n\nIn the Sōtō tradition, the Hōkyō Zanmai is chanted alongside the *Sandōkai* (參同契) and *Five Ranks* commentaries as the trio of foundational Caodong verse texts. The Bodhi booklet includes only the Hōkyō Zanmai.',
    },
    {
      id: 'teaching-of-thusness',
      shape: 'prose-commentary',
      heading: 'The teaching of thusness',
      body: 'The teaching of thusness\nhas been intimately communicated by buddhas and patriarchs;\nNow you have it,\nSo keep it well.\nFilling a silver bowl with snow,\nHiding a heron in the moonlight —\nWhen you array them, they\'re not the same\nWhen you mix them, you know where they are.\nThe meaning is not in the words\nYet it responds to the inquiring impulse.\nIf you\'re excited, it becomes a pitfall;\nIf you miss it you fall into retrospective hesitation.\nTurning away and touching are both wrong\nFor it is like a mass of fire.\nJust to depict it in literary form\nIs to relegate it to defilement.\nIt is bright just at midnight;\nIt doesn\'t appear at dawn.\nIt acts as a guide for beings —\nIts use removes all pains.',
    },
    {
      id: 'jewel-mirror',
      shape: 'prose-commentary',
      heading: 'The jewel mirror',
      body: 'Although it is not fabricated,\nIt is not without speech.\nIt is like facing a jewel mirror;\nForm and image behold each other —\nYou are not it\nIt actually is you.\nIt is like a babe in the world,\nIn five aspects complete;\nIt does not go or come,\nNor rise nor stand.\n"Baba wawa" —\nIs there anything said or not?\nUltimately it does not apprehend anything,\nBecause its speech is not yet correct.\nIt is like the six lines of the double split hexagram;\nThe relative and absolute integrate\nPiled up, they make three;\nThe complete transformation makes five.\nIt is like the taste of the five flavored herb,\nLike the diamond thunderbolt\nSubtly included within the true,\nInquiry and response come up together.\nCommuning with the source and communing with the process,',
    },
    {
      id: 'integration',
      shape: 'prose-commentary',
      heading: 'Integration',
      body: 'It includes integration and includes the road;\nMerging is auspicious;\nDo not violate it.\nNaturally real yet inconceivable,\nIt is not within the province of delusion or enlightenment\nWith causal conditions, time and season,\nQuiescently it shines bright.\nIn its fineness it fits into spacelessness;\nIn its greatness it is utterly beyond location.\nA hairbreadth\'s deviation\nWill fail to accord with the proper attunement.\nNow there are sudden and gradual,\nIn connection with which are set up basic approaches.\nOnce basic approaches are distinguished,\nThen there are guiding rules.\nBut even though the basis is reached\nand the approach comprehended\nTrue eternity still flows.',
    },
    {
      id: 'colt-and-rat',
      shape: 'prose-commentary',
      heading: 'Colt and rat',
      body: 'Outwardly still while inwardly moving,\nLike a tethered colt, a trapped rat —\nThe ancient saints pitied them,\nAnd bestowed upon them the teaching;\nAccording to their delusions,\nThey called black as white —\nWhen erroneous imaginations cease,\nThe acquiescent mind realizes itself.\nIf you want to conform to the ancient way\nPlease observe the ancients of former times;\nWhen about to fulfill the way of buddhahood,\nOne gazed at a tree for ten aeons,\nLike a tiger leaving part of its prey,\nA horse with a white left hind leg.\nBecause there is the base, (there are)\njewel pedestals, fine clothing,\nBecause there is the startlingly different, (there are)\nHouse cat and cow.\nYi, with his archer\'s skill,\nCould hit a target at a hundred paces;\nBut when arrowpoints meet head-on,\nWhat has this to do with the power of skill?',
    },
    {
      id: 'wooden-man',
      shape: 'prose-commentary',
      heading: 'The wooden man sings',
      body: 'When the wooden man begins to sing,\nThe stone woman gets up to dance;\nIt\'s not within reach of feeling or discrimination —\nHow could it admit of consideration in thoughts.\nA minister serves the lord,\nA son obeys the father.\nNot obeying is not filial,\nAnd not serving is no help.\nPractice secretly, working within,\nAs though a fool, like an idiot —\nIf you can achieve continuity,\nThis is called the host within the host.',
    },
    {
      id: 'cleary-notes',
      shape: 'prose-commentary',
      heading: 'Cleary\'s translation notes',
      body: 'From the Bodhi Sangha booklet (reproducing Cleary):\n\nDongshan Liangjie (Tung-shan Liang-chieh, Jp. Tōzan Ryōkai, 807-869). Samādhi — concentration, meditation, trance, absorption — here rendered *awareness* "because of convenience, to avoid any suggestion of paranormality."\n\nThe relative and absolute, or partial and true, are also called *minister and ruler*, *son and father*, *light and darkness*. Caoshan called the relative the world of myriad forms and the absolute the realm of emptiness; the relative is also called the *phenomenal* and the absolute the *principle*.\n\nThe absolute is always being expressed in the relative — this is the true absolute, but it is not always seen. Perfect comprehension of the relative grounded on experience of the absolute culminates in simultaneous realization of knowledge and complete peace and calm. At this point, Dongshan said, "one comes back to sit among the ashes" — living this life as a wayfarer, expressing one\'s solidarity with the world in the vow to realize perfect enlightenment with all beings.\n\nThe five flavored herb and diamond thunderbolt are images of *five in one*; these so-called ranks or positions, the set of five being the ultimate paradigm of dialectic and an illustration of meditational stages, are all from the same source — hence the association of *five in one*.',
    },
  ],
};

export default hokyoZanmai;
