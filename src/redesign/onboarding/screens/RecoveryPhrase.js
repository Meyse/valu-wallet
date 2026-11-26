// R11 Recovery phrase: 8 words per page, 3 pages ("Next words"), then R12 Verify.
import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, Heading, TopBar} from '../../components/Layout';
import {Grid, WordCell} from '../../components/PhraseGrid';
import {ROUTES, nextRoute, progressFor} from '../../logic/steps';
import {useOnboarding} from '../OnboardingContext';

const PER_PAGE = 8;

export default function RecoveryPhrase({navigation, route}) {
  const ob = useOnboarding();
  const words = (ob.secret ?? '').split(' ').filter(Boolean);
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
      navigation.navigate(nextRoute('create', ROUTES.phrase));
    }
  };

  return (
    <DenseScreen
      scrollRef={scroll}
      topBar={<TopBar onBack={back} progress={progressFor('create', ROUTES.phrase)} />}
      footer={
        <ValuButton
          label={page < pages - 1 ? 'Next words' : 'Continue'}
          onPress={next}
          testID="phrase-next"
        />
      }>
      <View style={styles.content}>
        <Heading
          title="Write down your phrase"
          body={`Words ${from}–${to} of ${words.length}. Write them on paper in this order.`}
        />
        <Grid>
          {shown.map((w, i) => (
            <WordCell key={`${page}-${i}`} index={page * PER_PAGE + i} word={w} />
          ))}
        </Grid>
      </View>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({content: {gap: 32}});
export const IS_IOS = Platform.OS === 'ios';
