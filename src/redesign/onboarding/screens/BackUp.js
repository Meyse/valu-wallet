// R09 Back up wallet and R10 "Keep your phrase secret" sheet.
// The 24 words come from the app's existing generator (getKey(256), BIP39 with randomBytes).
import React, {useState} from 'react';
import StepScreen from '../../components/StepScreen';
import ValuButton from '../../components/ValuButton';
import Icon from '../../components/Icon';
import Sheet from '../../components/Sheet';
import {ErrorText} from '../../components/Layout';
import {getKey} from '../../../utils/keyGenerator/keyGenerator';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {useOnboarding} from '../OnboardingContext';

export default function BackUp({navigation}) {
  const ob = useOnboarding();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const steps = stepListFor('create', ROUTES.backUp, {biometry: ob.biometry?.biometry === true});

  const understand = async () => {
    setBusy(true);
    setError(null);
    try {
      // One phrase per run: Back and forward show the same words.
      if (!ob.secret) ob.setSecret(await getKey(256));
      setSheet(false);
      navigation.navigate(nextRoute('create', ROUTES.backUp));
    } catch (e) {
      setSheet(false);
      setError('Could not make a recovery phrase. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StepScreen
        onBack={() => navigation.goBack()}
        done={steps.done}
        next={steps.next}
        icon={<Icon name="backup" />}
        title="Back up wallet"
        body="Write down 24 words on paper. They are the only way to restore your wallet if you lose this phone."
        actions={
          <>
            <ErrorText>{error}</ErrorText>
            <ValuButton label="Show recovery phrase" onPress={() => setSheet(true)} testID="backup-show" />
          </>
        }
      />
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        icon={<Icon name="shieldAlert" />}
        title="Keep your phrase secret"
        body="Anyone with these words can take your funds. Valu will never ask for them."
        testID="secret-sheet"
        buttons={[
          {label: 'I understand', variant: 'accent', onPress: understand, loading: busy, testID: 'secret-understand'},
          {label: 'Not now', onPress: () => setSheet(false), testID: 'secret-not-now'},
        ]}
      />
    </>
  );
}
