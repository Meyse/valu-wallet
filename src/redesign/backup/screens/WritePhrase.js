// Backup words 06 - Write down (Paper p-5-0): 8 words per page, 3 pages ("Next words"), then Verify.
// Moved from the v1 onboarding (R11). The words come from the backup run, after the wallet check.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, Heading, StepList, TopBar} from '../../components/Layout';
import StepIcon from '../../components/StepIcons';
import {Grid, WordCell} from '../../components/PhraseGrid';
import {BACKUP_ROUTES, BACKUP_STEPS, useBackup} from '../BackupContext';
import useSecureScreen from '../../components/useSecureScreen';

const PER_PAGE = 8;

export default function WritePhrase({navigation, route}) {
  useSecureScreen();
  const {phrase} = useBackup();
  const words = phrase ?? [];
  const pages = Math.max(1, Math.ceil(words.length / PER_PAGE));
  const [page, setPage] = useState(route?.params?.page ?? 0);
  const scroll = useRef(null);
  const pageRef = useRef(page);
  pageRef.current = page;

  // Android Back and the iOS swipe go to the previous page first, as the Back button does.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        // GO_BACK: Android Back. POP: the iOS swipe.
        const type = e.data.action.type;
        // Not when the whole backup closes ("Done" on Verify removes this screen from below).
        if (!navigation.isFocused()) return;
        if (pageRef.current === 0 || (type !== 'GO_BACK' && type !== 'POP')) return;
        e.preventDefault();
        setPage(pageRef.current - 1);
      }),
    [navigation],
  );

  // "Show words again" on R13 comes back to page 1.
  useEffect(() => {
    if (route?.params?.page != null) setPage(route.params.page);
  }, [route?.params?.page, route?.params?.at]);

  const shown = words.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const from = page * PER_PAGE + 1;
  const to = from + shown.length - 1;

  const back = () => {
    if (page > 0) setPage(page - 1);
    else navigation.goBack();
  };
  const next = () => {
    if (page < pages - 1) {
      setPage(page + 1);
      scroll.current?.scrollTo({y: 0, animated: false});
    } else {
      navigation.navigate(BACKUP_ROUTES.verify);
    }
  };

  return (
    <DenseScreen
      scrollRef={scroll}
      topBar={<TopBar onBack={back} />}
      footer={
        <ValuButton
          label={page < pages - 1 ? 'Next words' : 'Continue'}
          onPress={next}
          testID="phrase-next"
        />
      }>
      <StepList done={[BACKUP_STEPS.words[0]]} next={[BACKUP_STEPS.words[2]]}>
        <View style={styles.content}>
          <Heading
            icon={<StepIcon name="write" />}
            title="Write down your phrase"
            body={`Words ${from}–${to} of ${words.length}. Write them on paper in this order.`}
          />
          <Grid>
            {shown.map((w, i) => (
              <WordCell key={`${page}-${i}`} index={page * PER_PAGE + i} word={w} />
            ))}
          </Grid>
        </View>
      </StepList>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({content: {gap: 32}});
