// Icons of the current step block in the onboarding step list (Paper p-2-0, round 8).
// 48 x 48, stroke 2, round caps. Markup copied from the Paper artboards "Create 03 - Create password"
// (lock, #42DF5E) and "Import phrase 03b - Private key" (download tray, #FFD56F).
// Use Face ID keeps its own icon from Icon.js (faceId, fingerprint).
import React from 'react';
import {SvgXml} from 'react-native-svg';

export const STEP_ICONS = {
  password:
    '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="10" y="21" width="28" height="20" rx="4" fill="none" stroke="#42DF5E" stroke-width="2"/>' +
    '<path d="M16 21V15C16 10.6 19.6 7 24 7C28.4 7 32 10.6 32 15V21" fill="none" stroke="#42DF5E" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M24 29V33" fill="none" stroke="#42DF5E" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>',
  import:
    '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="7" y="7" width="34" height="34" rx="6" fill="none" stroke="#FFD56F" stroke-width="2"/>' +
    '<path d="M24 14V29M17.5 22.5L24 29L30.5 22.5" fill="none" stroke="#FFD56F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16 34H32" fill="none" stroke="#FFD56F" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>',
  // Backup words 06 - Write down (Paper p-5-0, round 8b): pencil, #5AB0FF.
  write:
    '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M29.5 10.5L37.5 18.5L18 38H10V30L29.5 10.5Z" fill="none" stroke="#5AB0FF" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M25 15L33 23" fill="none" stroke="#5AB0FF" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M26 38H38" fill="none" stroke="#5AB0FF" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>',
  // Backup words 07 - Verify words, the step list alternative: check box, #5AB0FF.
  verify:
    '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="8" y="8" width="32" height="32" rx="8" fill="none" stroke="#5AB0FF" stroke-width="2"/>' +
    '<path d="M16.5 24.5L21.5 29.5L31.5 19" fill="none" stroke="#5AB0FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>',
};

export default function StepIcon({name}) {
  const xml = STEP_ICONS[name];
  if (!xml) return null;
  return <SvgXml xml={xml} width={48} height={48} />;
}
