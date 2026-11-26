// Home balance summary. Same sums as the old Home (src/containers/Home/Home.js cryptoAssets):
// add each sub-wallet's `total` per coin, multiply by the display-currency rate when one is known.
import BigNumber from 'bignumber.js';
import {GENERAL, WYRE_SERVICE} from '../../utils/constants/intervalConstants';

// rates: state.ledger.rates. Service rates win over general rates, as in the old Home.
export function rateFor(rates, coinId, currency, channels = [WYRE_SERVICE, GENERAL]) {
  for (const channel of channels) {
    const value = rates?.[channel]?.[coinId]?.[currency];
    if (value != null) return value;
  }
  return null;
}

// coins: activeCoinsForUser; subWallets: {coinId: [{id}]}, all sub-wallets, also the ones that failed
// to start; balances: {coinId: {walletId: {total}}}.
// Returns assets with balance first, then the total in the display currency.
// total is null while a balance has not loaded (known: false) or when a coin with funds has no
// rate: the sum would be wrong, and a funded wallet must never show 0.00.
export function summarizeBalances({coins = [], subWallets = {}, balances = {}, rate = () => null}) {
  const assets = coins.map((coin, order) => {
    let crypto = new BigNumber(0);
    const wallets = subWallets[coin.id] ?? [];
    // No sub-wallet to read (not set up yet, or it failed to start): the balance is not known.
    let known = wallets.length > 0;
    for (const wallet of wallets) {
      const total = balances[coin.id]?.[wallet.id]?.total;
      if (total != null) crypto = crypto.plus(new BigNumber(total));
      else known = false;
    }
    const r = rate(coin.id);
    const fiat = r != null ? crypto.multipliedBy(r) : null;
    return {coin, crypto, fiat, order, known};
  });

  assets.sort((a, b) => {
    const aFunds = a.crypto.isGreaterThan(0);
    const bFunds = b.crypto.isGreaterThan(0);
    if (aFunds !== bFunds) return aFunds ? -1 : 1;
    if (a.fiat != null && b.fiat != null && !a.fiat.isEqualTo(b.fiat)) {
      return b.fiat.comparedTo(a.fiat);
    }
    return a.order - b.order;
  });

  if (assets.some(a => !a.known)) return {assets, total: null};
  let total = new BigNumber(0);
  for (const a of assets) {
    if (a.fiat != null) total = total.plus(a.fiat);
    else if (a.crypto.isGreaterThan(0)) return {assets, total: null};
  }
  return {assets, total};
}

// "0.00" style: two decimals, thousands separators.
export function formatFiat(amount) {
  if (amount == null) return null;
  return new BigNumber(amount).decimalPlaces(2, BigNumber.ROUND_HALF_UP).toFormat(2);
}

// Crypto amount without trailing zeros, at most 8 decimals.
export function formatCrypto(amount) {
  const value = new BigNumber(amount ?? 0).decimalPlaces(8, BigNumber.ROUND_DOWN);
  return value.toFormat();
}
