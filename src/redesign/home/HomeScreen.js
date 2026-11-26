// New Home (R16, with the team's Crypto "Total Balance" block from Paper p-1-0).
// First run: the welcome card (R16). After "Dismiss": the balance of this wallet, from the same
// redux data and refresh calls as the old Home. Activity shows how this wallet was made.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
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
import {colors, type} from '../theme/tokens';
import {TAB_BAR_CLEARANCE} from './tabBarMetrics';

const IS_ANDROID = Platform.OS === 'android';

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
  imported: {title: 'Wallet imported', body: 'Restored on this phone'},
};

export default function HomeScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const store = useStore();
  const [welcome, setWelcome] = useState(undefined); // undefined while loading
  const [scanInfo, setScanInfo] = useState(false);
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

  const showWelcome = welcome && !welcome.dismissed;
  const activity = welcome ? ACTIVITY_COPY[welcome.kind] : null;

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
        ) : welcome !== undefined ? (
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

        <View style={[styles.activity, {marginTop: showWelcome ? 70 : 40}]}>
          <View style={styles.activityHeader}>
            <Icon name="activityClock" />
            <Text style={[type.label, styles.text]} accessibilityRole="header">
              Activity
            </Text>
          </View>
          {activity ? (
            <View style={styles.activityRow} testID="home-activity-row">
              <ActivityAvatar />
              <View style={styles.activityText}>
                <Text style={[type.label, styles.text]}>{activity.title}</Text>
                <View style={styles.activityMeta}>
                  <Text style={[type.caption, {color: colors.textSecondary}]}>{activity.body}</Text>
                  <Text style={[type.caption, {color: colors.textSecondary}]}>{timeAgo(welcome.at)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={[type.body, {color: colors.textSecondary, paddingHorizontal: 4}]}>No activity yet.</Text>
          )}
        </View>
      </ScrollView>

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
    ...(IS_ANDROID ? {borderWidth: 1, borderColor: colors.border} : null),
  },
  balance: {marginTop: 44, paddingHorizontal: 16, gap: 8},
  assets: {marginTop: 20, gap: 16},
  assetRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  assetText: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  coinTile: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  activity: {paddingHorizontal: 16, gap: 12},
  activityHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4},
  activityRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingLeft: 16,
    paddingRight: 24,
    borderRadius: 24,
    backgroundColor: colors.fillSubtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  activityText: {flex: 1, paddingBottom: 16, gap: 4},
  activityMeta: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},
});
