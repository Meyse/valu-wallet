import {formatCrypto, formatFiat, rateFor, summarizeBalances} from '../balances';

const VRSC = {id: 'VRSC'};
const ETH = {id: 'ETH'};

describe('summarizeBalances', () => {
  it('shows a new wallet as 0.00 with every coin at zero', () => {
    const {assets, total} = summarizeBalances({
      coins: [VRSC, ETH],
      subWallets: {VRSC: [{id: 'main'}], ETH: [{id: 'main'}]},
      balances: {VRSC: {main: {total: '0'}}, ETH: {main: {total: '0'}}},
      rate: () => 2,
    });
    expect(formatFiat(total)).toBe('0.00');
    expect(assets.map(a => a.coin.id)).toEqual(['VRSC', 'ETH']);
    expect(assets.every(a => a.crypto.isZero())).toBe(true);
  });

  it('adds sub-wallets without float error and puts funded coins first', () => {
    const {assets, total} = summarizeBalances({
      coins: [VRSC, ETH],
      subWallets: {VRSC: [{id: 'a'}, {id: 'b'}], ETH: [{id: 'main'}]},
      balances: {VRSC: {a: {total: '0'}, b: {total: '0'}}, ETH: {main: {total: '0.1'}}},
      rate: id => (id === 'ETH' ? '0.2' : '1'),
    });
    // 0.1 * 0.2 is 0.020000000000000004 in floats.
    expect(assets[0].coin.id).toBe('ETH');
    expect(assets[0].fiat.toString()).toBe('0.02');
    expect(formatFiat(total)).toBe('0.02');
  });

  it('sums sub-wallet totals of one coin', () => {
    const {assets} = summarizeBalances({
      coins: [VRSC],
      subWallets: {VRSC: [{id: 'a'}, {id: 'b'}]},
      balances: {VRSC: {a: {total: '1.5'}, b: {total: '2.25'}}},
    });
    expect(formatCrypto(assets[0].crypto)).toBe('3.75');
  });

  it('gives no total while a balance has not loaded, so a funded wallet never shows 0.00', () => {
    const {assets, total} = summarizeBalances({
      coins: [VRSC, ETH],
      subWallets: {VRSC: [{id: 'main'}], ETH: [{id: 'main'}]},
      balances: {VRSC: {main: {total: '0'}}},
      rate: () => 2,
    });
    expect(total).toBeNull();
    expect(assets.find(a => a.coin.id === 'ETH').known).toBe(false);
  });

  it('gives no total when a funded coin has no rate', () => {
    const {total} = summarizeBalances({
      coins: [VRSC],
      subWallets: {VRSC: [{id: 'a'}]},
      balances: {VRSC: {a: {total: '5'}}},
      rate: () => null,
    });
    expect(total).toBeNull();
  });
});

describe('rateFor', () => {
  it('prefers the service rate over the general rate', () => {
    const rates = {wyre_service: {VRSC: {USD: 3}}, general: {VRSC: {USD: 1}, ETH: {USD: 9}}};
    expect(rateFor(rates, 'VRSC', 'USD')).toBe(3);
    expect(rateFor(rates, 'ETH', 'USD')).toBe(9);
    expect(rateFor(rates, 'BTC', 'USD')).toBeNull();
  });
});

describe('formatting', () => {
  it('rounds fiat half up to two places with separators', () => {
    expect(formatFiat('1234.565')).toBe('1,234.57');
  });
  it('cuts crypto at 8 decimals and drops trailing zeros', () => {
    expect(formatCrypto('0.123456789')).toBe('0.12345678');
    expect(formatCrypto('415.10')).toBe('415.1');
  });
});
