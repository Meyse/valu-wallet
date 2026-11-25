// Recovery phrase check (R12, R13). Same rules as Verus-Mobile `redesign` SeedWords.js:
// 3 questions, one position from each third of the phrase, 4 choices each.
export const VERIFY_WORD_COUNT = 3;
export const VERIFY_OPTION_COUNT = 4;

const shuffle = (items, random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const createVerifyQuestions = (words, random = Math.random) => {
  const count = Math.min(VERIFY_WORD_COUNT, words.length);

  return Array.from({length: count}, (_, part) => {
    const start = Math.floor((part * words.length) / count);
    const end = Math.floor(((part + 1) * words.length) / count);
    const index = start + Math.floor(random() * (end - start));
    const answer = words[index];
    const others = list =>
      shuffle([...new Set(list)].filter(word => word !== answer), random);
    const partWords = others(words.slice(start, end));
    // A phrase with repeated words can run short of choices in one part.
    const phraseWords = others(words).filter(word => !partWords.includes(word));
    const decoys = [...partWords, ...phraseWords].slice(0, VERIFY_OPTION_COUNT - 1);

    return {index, options: shuffle([answer, ...decoys], random)};
  });
};

// Returns one boolean per question: true when the pick is wrong.
export const findVerifyMismatches = (words, questions, picks) =>
  questions.map((question, i) => picks[i] !== words[question.index]);
