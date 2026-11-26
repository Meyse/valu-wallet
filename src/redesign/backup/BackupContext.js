// In-memory state of one backup run. The phrase lives only here, in React state, while the words
// lane is open: it is dropped when the user goes back to "Choose a way" and when the run ends.
import React, {createContext, useContext, useMemo, useState} from 'react';

const BackupContext = createContext(null);

export function BackupProvider({children, accountHash, finish}) {
  const [phrase, setPhrase] = useState(null); // array of words
  const value = useMemo(() => ({phrase, setPhrase, accountHash, finish}), [phrase, accountHash, finish]);
  return <BackupContext.Provider value={value}>{children}</BackupContext.Provider>;
}

export const useBackup = () => useContext(BackupContext);

export const BACKUP_ROUTES = {
  choose: 'BackupChoose',
  words: 'BackupWords',
  verify: 'BackupVerify',
  chip: 'BackupChip',
};

// Step list names (Paper p-5-0, round 8b). The words lane names its last step "Verify it" (the
// orchestrator's decision; Paper still says "Check the words").
export const BACKUP_STEPS = {
  words: ['Keep it secret', 'Write it down', 'Verify it'],
  chip: ['Chip password', 'Hold the chip', 'Write to chip'],
};
