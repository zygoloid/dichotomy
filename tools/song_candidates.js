'use strict';
// Candidate replacements for song 0 (the menu / first-floor song), for auditioning only.
// Nothing here is loaded by the game. Export previews with:
//   node tools/audio_test.js --cand music_preview
// Each entry has the same shape as an AU.MUS song (see js/audio.js).
const CAND = {
  // A. Deep progressive, A minor. Sits on the tonic for four bars before moving (Am Am F G).
  //    The plucks are open fifths and ninths with no thirds, and the lead is sparse long notes.
  a_deep: {
    root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 6], cb: 2, bassW: 'sawtooth', bassLen: 1.6, bassCut: 380, arpW: 'sawtooth',
    bass: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1],
    bassB: [-1, -1, 0, -1, -1, -1, 0, 0, -1, -1, 0, -1, -1, -1, 0, 7],
    gate: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    gateB: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    arp: [0, -1, 7, -1, 4, -1, 7, -1, 0, -1, 7, -1, 4, -1, 7, 4],
    arpB: [7, -1, 4, 7, -1, 4, 8, -1, 7, -1, 4, 7, -1, 4, 0, -1],
    mel: [
      '11 - - - - - - - 9 - - - 10 - - -', '11 - - - - - - - . . . . . . . .',
      '11 - - - - - - - 9 - - - 10 - - -', '7 - - - - - - - . . . . 9 - 10 -',
      '12 - - - - - - - 10 - - - 9 - - -', '9 - - - - - - - . . . . . . . .',
      '10 - - - - - - - 8 - - - 10 - - -', '13 - - - - - - - . . . . 11 - 10 -'].map(_bar),
    melB: [
      '14 - 13 - 11 - - - 9 - 10 - 11 - - -', '13 - 11 - 9 - - - . . . . 7 - 9 -',
      '14 - 13 - 11 - - - 9 - 10 - 11 - - -', '13 - 11 - 9 - - - 7 - - - . . . .',
      '12 - 10 - 9 - - - 7 - 9 - 12 - - -', '14 - 12 - 9 - - - . . . . 9 - 10 -',
      '13 - 10 - 8 - - - 10 - 11 - 13 - - -', '15 - 13 - 10 - - - . . . . . . . .'].map(_bar)
  },
  // B. Melodic techno, F minor (Fm Fm Db Bbm). The hook is the rolling add-9 arpeggio;
  //    the lead is a slow three-note descent. Rolling bass.
  b_melodic: {
    root: 43.65, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3], cb: 2, bassW: 'sawtooth', bassLen: .85, bassCut: 260, arpW: 'sawtooth',
    bass: [-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0],
    bassB: [-1, 0, 0, 0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 7, 0],
    gate: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    gateB: [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0],
    arp: [0, 4, 7, 8, 9, 8, 7, 4, 0, 4, 7, 8, 9, 8, 7, 4],
    arpB: [9, 8, 7, 4, 0, 4, 7, 8, 9, 8, 7, 4, 7, 8, 9, 11],
    mel: [
      '11 - - - - - - - - - - - 10 - - -', '9 - - - - - - - - - - - . . . .',
      '11 - - - - - - - - - - - 10 - - -', '9 - - - - - - - 8 - - - 7 - - -',
      '12 - - - - - - - - - - - 10 - - -', '9 - - - - - - - - - - - . . . .',
      '10 - - - - - - - - - - - 12 - - -', '14 - - - - - - - 13 - - - 12 - - -'].map(_bar),
    melB: [
      '14 - - - 13 - - - 11 - - - - - - -', '10 - - - 9 - - - 7 - - - . . . .',
      '14 - - - 13 - - - 11 - - - - - - -', '10 - - - 9 - - - 7 - - - . . . .',
      '14 - - - 12 - - - 10 - - - - - - -', '9 - - - 10 - - - 12 - - - . . . .',
      '14 - - - 12 - - - 10 - - - - - - -', '12 - - - 10 - - - 9 - - - 8 - - -'].map(_bar)
  },
  // (C, dramatic trance in G harmonic minor, was chosen and is now song 0 in js/audio.js.)
  // D. Dorian groove, Bb dorian. A two-chord vamp (Bbm to Eb) with syncopated bass and stabs,
  //    a funky pluck riff and a short bluesy call from a square lead. The least "trance" option.
  d_groove: {
    root: 58.27, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 3, 3], cb: 2, bassW: 'square', bassLen: 1.2, bassCut: 360, arpW: 'square', leadW: 'square',
    bass: [-1, -1, 0, 0, -1, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1],
    bassB: [-1, -1, 0, 0, -1, -1, 7, -1, -1, 0, -1, 0, -1, -1, 7, 6],
    gate: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    gateB: [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    arp: [7, -1, -1, 9, -1, 7, -1, 6, -1, -1, 4, -1, 6, -1, 7, -1],
    arpB: [7, -1, 9, -1, 10, -1, 9, -1, 7, -1, 6, -1, 4, -1, 6, -1],
    mel: [
      '. . . . 14 - 13 - 11 - - - . . . .', '. . . . 14 - 13 - 11 - 9 - 11 - - -',
      '. . . . 14 - 13 - 11 - - - . . . .', '. . . . 16 - 14 - 13 - 11 - 14 - - -',
      '. . . . 14 - 12 - 10 - - - . . . .', '. . . . 14 - 12 - 10 - 12 - 14 - - -',
      '. . . . 14 - 12 - 10 - - - . . . .', '. . . . 17 - 14 - 12 - 10 - 11 - - -'].map(_bar)
  }
};
if (typeof module !== 'undefined') module.exports = CAND;
