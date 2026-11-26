// DEMO CONTENT, NOT WALLET DATA. Sample "New credentials" card and Activity rows for the Home of
// the demo build (Max's reference, 2026-11-26: the team's Home). Nothing here comes from the
// wallet, and the buttons do nothing but say so. To remove: set DEMO_HOME to false (Home then
// shows its own content again), or delete this file and its import in HomeScreen.js.
// No real people, organisations, addresses or amounts. The marks are neutral placeholders.
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SvgXml} from 'react-native-svg';

export const DEMO_HOME = true;

const xml = {
  // Section icon of "New credentials": a wallet outline, as the team's reference.
  wallet:
    '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 7.5C4 6.4 4.9 5.5 6 5.5H17.5V8" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="4" y="8" width="16" height="11" rx="2.5" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>' +
    '<circle cx="16" cy="13.5" r="1.1" fill="#FFFFFF"/>' +
    '</svg>',
  lock:
    '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="4.5" y="9" width="11" height="8" rx="2" fill="none" stroke="#EBEBEB" stroke-width="1.5"/>' +
    '<path d="M7 9V6.5C7 4.8 8.3 3.5 10 3.5C11.7 3.5 13 4.8 13 6.5V9" fill="none" stroke="#EBEBEB" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>',
  // Paper round 9 (Backup 09): placeholder issuer mark, a shield with a check. No letter or numeral.
  issuer:
    '<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3L19 6V11.5C19 15.6 16.1 19.2 12 20.5C7.9 19.2 5 15.6 5 11.5V6L12 3Z" fill="none" stroke="#9CC8FF" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M9 12L11.2 14.2L15.2 10" fill="none" stroke="#9CC8FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>',
  // Placeholder licence mark: an ID card, no emblem.
  license:
    '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="3.5" y="6" width="17" height="12" rx="2.5" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>' +
    '<circle cx="9" cy="11" r="1.8" fill="none" stroke="#FFFFFF" stroke-width="1.4"/>' +
    '<path d="M6.5 15.2C7 14 8 13.5 9 13.5C10 13.5 11 14 11.5 15.2" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M14 10.5H17.5M14 13.5H16.5" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>' +
    '</svg>',
};

export function DemoIcon({name, size = 24}) {
  return <SvgXml xml={xml[name]} width={size} height={size} />;
}

const TILE = {issuer: {color: '#3A3F52', radius: 10, icon: 22}, license: {color: '#5B7BF0', radius: 12, icon: 24}};

// 40 x 40 tile with a placeholder mark, as the avatar of an activity row.
export function DemoTile({name}) {
  const t = TILE[name];
  return (
    <View style={[styles.tile, {backgroundColor: t.color, borderRadius: t.radius}]}>
      <DemoIcon name={name} size={t.icon} />
    </View>
  );
}

export const DEMO_CREDENTIAL = {
  issuer: 'Third party issuer',
  claim: 'Proof of age without sharing data',
  button: 'View new credential',
};

// avatar 'valu' uses the Home activity avatar; the others a DemoTile.
export const DEMO_ACTIVITY = [
  {key: 'demo-license', avatar: 'license', title: 'Drivers License', body: 'You accepted a credential', time: '3 hrs ago'},
  {key: 'demo-login', avatar: 'valu', title: 'Valu Login', body: 'You became Self sovereign', time: '3 hrs ago'},
];

const styles = StyleSheet.create({
  tile: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
});
