// New Home (R16, with the team's Crypto "Total Balance" block from Paper p-1-0).
// First run: the welcome card (R16). After "Dismiss": the balance of this wallet, from the same
// redux data and refresh calls as the old Home. Activity shows how this wallet was made.
// Backup (Paper p-5-0): the first funds open a sheet one time; after "Later" a card stays on top
// of Home until the backup is done. Neither blocks the wallet.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {SvgXml} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {formatCurrency} from 'react-native-format-currency';
import {Canvas, Circle, SweepGradient, vec} from '@shopify/react-native-skia';
import {useObjectSelector} from '../../hooks/useObjectSelector';
import {conditionallyUpdateWallets} from '../../actions/actionDispatchers';
import {API_GET_BALANCES, API_GET_FIATPRICE, API_GET_INFO} from '../../utils/constants/intervalConstants';
import {USD} from '../../utils/constants/currencies';
import {extractLedgerData} from '../../utils/ledger/extractLedgerData';
import GlassSurface from '../components/GlassSurface';
import Icon from '../components/Icon';
import ValuButton from '../components/ValuButton';
import Sheet, {BackdropSourceContext} from '../components/Sheet';
import {formatCrypto, formatFiat, rateFor, summarizeBalances} from '../logic/balances';
import {dismissWelcome, readWelcome, timeAgo} from '../state/welcomeState';
import {backupPrompt, markFundsSheetShown, readBackup} from '../state/backupState';
import {colors, type} from '../theme/tokens';
import {TAB_BAR_CLEARANCE} from './tabBarMetrics';
import {DEMO_ACTIVITY, DEMO_CREDENTIAL, DEMO_HOME, DemoIcon, DemoTile} from './demoHome';

const IS_ANDROID = Platform.OS === 'android';
// false: Home shows no balance and no currency list (Max, 2026-11-26: not in the demo video). The
// code stays; set true to show them again.
const SHOW_BALANCES = false;

function HeaderButton({icon, label, onPress, testID}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} testID={testID}>
      <GlassSurface style={styles.headerButton}>
        <Icon name={icon} />
      </GlassSurface>
    </Pressable>
  );
}

// Avatar of the activity row: conic gradient tile with the Valu mark (R16).
const CONIC = ['#B1FFCA', '#7BFEA4', '#45FC7E', '#33E4BF', '#21CBFF', '#51A4FD', '#81D2E4', '#B1FFCA'];
function ActivityAvatar() {
  return (
    <View style={styles.avatar}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={20} cy={20} r={30}>
          <SweepGradient c={vec(20, 20)} colors={CONIC} start={90} end={450} />
        </Circle>
      </Canvas>
      <Icon name="valuMark" />
    </View>
  );
}

function CoinTile({coin}) {
  const verus = coin.proto === 'vrsc' && /^VRSC/.test(coin.id);
  return (
    <View style={[styles.coinTile, {backgroundColor: verus ? colors.assetVrsc : colors.surfaceRaised}]}>
      {verus ? (
        <Icon name="verusCoin" />
      ) : (
        <Text style={[type.labelSmall, {color: colors.text}]}>{(coin.display_ticker ?? coin.id).slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const ACTIVITY_COPY = {
  created: {title: 'Wallet created', body: 'On this phone'},
  imported: {title: 'Wallet imported', body: 'On this phone'},
};
// Paper round 9 (Backup 09): one row for both ways (words or chip). Real state, not demo content.
const BACKUP_ROW = {title: 'Wallet backup', body: 'You backed up your wallet'};
const BACKUP_TILE =
  '<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 3L19 6V11.5C19 15.6 16.1 19.2 12 20.5C7.9 19.2 5 15.6 5 11.5V6L12 3Z" fill="none" stroke="#42DF5E" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M9 12L11.2 14.2L15.2 10" fill="none" stroke="#42DF5E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';
function BackupAvatar() {
  return (
    <View style={[styles.avatar, {backgroundColor: '#23402C'}]}>
      <SvgXml xml={BACKUP_TILE} width={22} height={22} />
    </View>
  );
}

function HomeCard({icon, title, body, button, onPress, testID}) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={{gap: 16}}>
        <Icon name={icon} />
        <View style={{gap: 16}}>
          <Text style={[type.titleCard, styles.text]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[type.body, styles.text]}>{body}</Text>
        </View>
      </View>
      <ValuButton label={button} onPress={onPress} testID={`${testID}-button`} />
    </View>
  );
}

export default function HomeScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const store = useStore();
  const [welcome, setWelcome] = useState(undefined); // undefined while loading
  const [scanInfo, setScanInfo] = useState(false);
  const [backup, setBackup] = useState(null);
  const [fundsSheet, setFundsSheet] = useState(false);
  const [demoInfo, setDemoInfo] = useState(false);
  const root = useRef(null);

  const accountHash = useSelector(state => state.authentication.activeAccount?.accountHash);
  const coins = useObjectSelector(state => state.coins.activeCoinsForUser);
  const balances = useObjectSelector(state => extractLedgerData(state, 'balances', API_GET_BALANCES));
  // All sub-wallets, not only the ones that started: a sub-wallet that failed has no balance, and
  // Home then shows "—" for its coin instead of a sum that leaves it out.
  const subWallets = useObjectSelector(state => state.coinMenus.allSubWallets);
  const rates = useObjectSelector(state => state.ledger.rates);
  const currency = useSelector(state => state.settings.generalWalletSettings.displayCurrency || USD);
  const showBalance = useSelector(state => state.coins.showBalance);

  useEffect(() => {
    let alive = true;
    if (accountHash) readWelcome(accountHash).then(w => alive && setWelcome(w));
    return () => {
      alive = false;
    };
  }, [accountHash]);

  // The backup record changes in the backup flow: read it each time Home shows.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (accountHash) readBackup(accountHash).then(r => alive && setBackup(r));
      return () => {
        alive = false;
      };
    }, [accountHash]),
  );

  // Same refresh as the old Home on focus: fiat price, balances and chain info for each coin.
  useFocusEffect(
    useCallback(() => {
      const list = [API_GET_FIATPRICE, API_GET_BALANCES, API_GET_INFO].flatMap(updateId =>
        (coins ?? []).map(coin => ({chainTicker: coin.id, updateId})),
      );
      conditionallyUpdateWallets(store.getState(), dispatch, list).catch(() => {});
    }, [coins, dispatch, store]),
  );

  const {assets, total} = useMemo(
    () => summarizeBalances({coins, subWallets, balances, rate: id => rateFor(rates, id, currency)}),
    [coins, subWallets, balances, rates, currency],
  );
  const [, , symbol] = formatCurrency({amount: '0.00', code: currency});
  const fiat = formatFiat(total);
  const isZero = total != null && total.isZero();

  const hasFunds = assets.some(a => a.known && !a.crypto.isZero());
  const prompt = backupPrompt(backup, hasFunds);

  // First funds: the sheet, one time. It is marked as shown when it opens, so a restart while it
  // is open shows the card, not the sheet again.
  useEffect(() => {
    if (prompt !== 'sheet') return;
    setFundsSheet(true);
    setBackup(r => ({...r, fundsSheetShown: true}));
    markFundsSheetShown(accountHash);
  }, [prompt, accountHash]);

  const openBackup = () => {
    setFundsSheet(false);
    navigation.navigate('RedesignBackup');
  };

  const backupCard = prompt === 'card' && !fundsSheet;
  // Paper p-5-0: the backup card takes the place of the welcome card, and Home after the backup
  // (09) has no card. The demo Home (team reference) has no welcome card.
  const showWelcome = !DEMO_HOME && welcome && !welcome.dismissed && !backupCard && !backup?.backedUpAt;
  const showBalances = SHOW_BALANCES && !showWelcome && welcome !== undefined;
  const real = [];
  if (backup?.backedUpAt) real.push({...BACKUP_ROW, at: backup.backedUpAt, key: 'backup', avatar: 'backup'});
  if (!DEMO_HOME && welcome && ACTIVITY_COPY[welcome.kind]) real.push({...ACTIVITY_COPY[welcome.kind], at: welcome.at, key: 'wallet'});
  real.sort((x, y) => y.at - x.at);
  const rows = [
    ...real.map(r => ({avatar: 'valu', ...r, time: timeAgo(r.at)})),
    ...(DEMO_HOME ? DEMO_ACTIVITY : []),
  ];

  const onDismiss = () => {
    setWelcome(w => ({...w, dismissed: true}));
    dismissWelcome(accountHash);
  };

  return (
    <BackdropSourceContext.Provider value={root}>
    <View ref={root} collapsable={false} style={styles.root}>
      {/* The scroll area starts under the status bar, so the balance never scrolls under the clock. */}
      <ScrollView
        style={{marginTop: insets.top}}
        contentContainerStyle={{paddingTop: 8, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom}}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <HeaderButton icon="headerScan" label="Scan QR code" onPress={() => setScanInfo(true)} testID="home-scan" />
          <HeaderButton
            icon="headerSettings"
            label="Settings"
            onPress={() => navigation.navigate('RedesignSettings')}
            testID="home-settings"
          />
        </View>

        {backupCard ? (
          <HomeCard
            icon="shieldAlertYellow"
            title="Back up your wallet"
            body="You have funds in this wallet. If you lose this phone, you need a backup to get them back."
            button="Back up now"
            onPress={openBackup}
            testID="home-backup-card"
          />
        ) : null}
        {showWelcome ? (
          <View style={styles.card} testID="home-welcome">
            <View style={{gap: 16}}>
              <Icon name="welcomeCard" />
              <View style={{gap: 16}}>
                <Text style={[type.titleCard, styles.text]} accessibilityRole="header">
                  Welcome to Valu Wallet
                </Text>
                <Text style={[type.body, styles.text]}>Your wallet is set up. Receive funds to get started.</Text>
              </View>
            </View>
            <ValuButton label="Dismiss" onPress={onDismiss} testID="home-welcome-dismiss" />
          </View>
        ) : null}
        {showBalances ? (
          <View style={styles.balance} testID="home-balance">
            <Text style={[type.labelSmall, styles.text]}>Total Balance</Text>
            <Text style={[type.display, styles.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {!showBalance ? (
                '***'
              ) : fiat == null ? (
                '—'
              ) : (
                <>
                  {symbol || currency}
                  <Text style={{color: isZero ? colors.textPlaceholder : colors.text}}>{fiat}</Text>
                </>
              )}
            </Text>
            <View style={styles.assets}>
              {assets.map(({coin, crypto, known}) => (
                <View key={coin.id} style={styles.assetRow}>
                  <CoinTile coin={coin} />
                  <View style={styles.assetText}>
                    <Text style={[type.label, styles.text]} numberOfLines={1}>
                      {coin.display_name ?? coin.id}
                    </Text>
                    <Text style={[type.caption, {color: colors.textSecondary, opacity: crypto.isZero() ? 0.4 : 1}]}>
                      {showBalance ? `${known ? formatCrypto(crypto) : '—'} ${coin.display_ticker ?? coin.id}` : '***'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {DEMO_HOME ? (
          <View style={[styles.section, {marginTop: backupCard ? 32 : 25}]} testID="home-demo-credentials">
            <View style={styles.sectionHeader}>
              <DemoIcon name="wallet" />
              <Text style={[type.label, styles.text]} accessibilityRole="header">
                New credentials
              </Text>
            </View>
            <View style={styles.credential}>
              <View style={styles.credentialRow}>
                <DemoTile name="issuer" />
                <View style={styles.credentialText}>
                  <Text style={[type.label, styles.text]}>{DEMO_CREDENTIAL.issuer}</Text>
                  <Text style={[type.caption, {color: colors.textSecondary}]}>{DEMO_CREDENTIAL.claim}</Text>
                </View>
                <DemoIcon name="lock" size={20} />
              </View>
              <ValuButton
                label={DEMO_CREDENTIAL.button}
                onPress={() => setDemoInfo(true)}
                style={styles.smallButton}
                testID="home-demo-credential"
              />
            </View>
          </View>
        ) : null}

        <View style={[styles.section, {marginTop: DEMO_HOME ? 32 : showWelcome || backupCard ? 70 : 40}]}>
          <View style={styles.sectionHeader}>
            <Icon name="activityClock" />
            <Text style={[type.label, styles.text]} accessibilityRole="header">
              Activity
            </Text>
          </View>
          {rows.length ? (
            <View style={styles.activityGroup}>
              {rows.map((row, i) => (
                <View key={row.key} testID={`home-activity-${row.key}`}>
                  {i > 0 ? <View style={styles.activityDivider} /> : null}
                  <View style={styles.activityRow}>
                  {row.avatar === 'valu' ? <ActivityAvatar /> : row.avatar === 'backup' ? <BackupAvatar /> : <DemoTile name={row.avatar} />}
                  <View style={styles.activityText}>
                    <Text style={[type.label, styles.text]}>{row.title}</Text>
                    <View style={styles.activityMeta}>
                      <Text style={[type.caption, {color: colors.textSecondary}]}>{row.body}</Text>
                      <Text style={[type.caption, {color: colors.textSecondary}]}>{row.time}</Text>
                    </View>
                  </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[type.body, {color: colors.textSecondary, paddingHorizontal: 4}]}>No activity yet.</Text>
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={fundsSheet}
        onClose={() => setFundsSheet(false)}
        icon={<Icon name="shieldAlert" />}
        title="You received funds"
        body="Back up your wallet now. If you lose this phone, you need a backup to get your funds back."
        testID="home-funds-sheet"
        buttons={[
          {label: 'Back up now', variant: 'accent', onPress: openBackup, testID: 'home-funds-backup'},
          {label: 'Later', onPress: () => setFundsSheet(false), testID: 'home-funds-later'},
        ]}
      />
      <Sheet
        visible={demoInfo}
        onClose={() => setDemoInfo(false)}
        title="Sample credential"
        body="This card is sample content for the demo. There is no credential to show."
        testID="home-demo-sheet"
        buttons={[{label: 'Close', onPress: () => setDemoInfo(false), testID: 'home-demo-close'}]}
      />
      <Sheet
        visible={scanInfo}
        onClose={() => setScanInfo(false)}
        title="Scan comes later"
        body="This build has no QR scan on the new Home yet. To scan now, open the old wallet UI in Settings."
        testID="home-scan-sheet"
        buttons={[{label: 'Close', onPress: () => setScanInfo(false), testID: 'home-scan-close'}]}
      />
    </View>
    </BackdropSourceContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
  text: {color: colors.text},
  header: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16},
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_ANDROID ? {backgroundColor: colors.fillIconButton} : null),
  },
  card: {
    marginTop: 33,
    marginHorizontal: 16,
    padding: 24,
    gap: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceCard,
    // Team Home (Paper p-1-0, "Onboarding 11 - Home"): the card has a 1 px border.
    borderWidth: 1,
    borderColor: colors.border,
  },
  balance: {marginTop: 44, paddingHorizontal: 16, gap: 8},
  assets: {marginTop: 20, gap: 16},
  assetRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  assetText: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  coinTile: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  section: {paddingHorizontal: 16, gap: 8},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4},
  // Paper round 9: an outlined card with no fill.
  credential: {padding: 16, gap: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.border},
  credentialRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  smallButton: {height: 40, borderRadius: 20},
  credentialText: {flex: 1, gap: 4},
  // Team reference: the rows share one card, with a line between them under the text.
  activityGroup: {borderRadius: 24, backgroundColor: colors.fillSubtle, paddingLeft: 16, paddingRight: 24},
  activityRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16},
  activityDivider: {height: 1, marginLeft: 52, backgroundColor: colors.border},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {flex: 1},
  activityMeta: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},
});
