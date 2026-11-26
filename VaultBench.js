// WP0 spike only. Measures Argon2id and PBKDF2 through react-native-quick-crypto,
// checks the react-native-crypto shim next to it, and probes react-native-cloud-storage.
import React from 'react';
import {ScrollView, Text, View, Pressable, Platform} from 'react-native';
import {argon2, argon2Sync, pbkdf2} from 'react-native-quick-crypto';
import {Buffer} from 'buffer';

const KAT = require('./vaultBenchKat.json');

const hex = b => Buffer.from(b).toString('hex');
const now = () => (global.performance ? global.performance.now() : Date.now());

const argon2Async = params =>
  new Promise((resolve, reject) =>
    argon2('argon2id', params, (err, out) => (err ? reject(err) : resolve(out))),
  );
const pbkdf2Async = (pw, salt, iter, len) =>
  new Promise((resolve, reject) =>
    pbkdf2(pw, salt, iter, len, 'sha256', (err, out) =>
      err ? reject(err) : resolve(out),
    ),
  );

// Count JS timer ticks while an async native call runs. If the KDF blocked the
// JS thread, the largest gap between ticks is close to the KDF time.
const withTicker = async fn => {
  let ticks = 0;
  let last = now();
  let maxGap = 0;
  const id = setInterval(() => {
    const t = now();
    maxGap = Math.max(maxGap, t - last);
    last = t;
    ticks += 1;
  }, 16);
  const t0 = now();
  try {
    const out = await fn();
    const ms = now() - t0;
    return {out, ms: Math.round(ms), ticks, maxGapMs: Math.round(maxGap)};
  } finally {
    clearInterval(id);
  }
};

const runCase = async (label, runs, fn, log) => {
  const rows = [];
  for (let i = 0; i < runs; i++) {
    const r = await withTicker(fn);
    rows.push({ms: r.ms, ticks: r.ticks, maxGapMs: r.maxGapMs});
    log(`${label} run ${i + 1}: ${r.ms} ms, js ticks ${r.ticks}, max gap ${r.maxGapMs} ms`);
  }
  const ms = rows.map(r => r.ms).sort((a, b) => a - b);
  return {label, runs: rows, medianMs: ms[Math.floor(ms.length / 2)], minMs: ms[0], maxMs: ms[ms.length - 1]};
};

export default class VaultBench extends React.Component {
  state = {lines: [], done: false};

  log = line => {
    console.log('VAULTBENCH ' + line);
    this.setState(s => ({lines: [...s.lines, line]}));
  };

  componentDidMount() {
    setTimeout(() => this.runAll(), 1500);
  }

  async kats() {
    const results = [];
    for (const v of KAT.argon2id) {
      const out = await argon2Async({
        message: Buffer.from(v.password_hex, 'hex'),
        nonce: Buffer.from(v.salt_hex, 'hex'),
        parallelism: v.p,
        tagLength: v.tagLength,
        memory: v.m,
        passes: v.t,
        version: 0x13,
        secret: v.secret_hex ? Buffer.from(v.secret_hex, 'hex') : undefined,
        associatedData: v.ad_hex ? Buffer.from(v.ad_hex, 'hex') : undefined,
      });
      results.push({name: v.name, pass: hex(out) === v.expected_hex});
    }
    for (const v of KAT.pbkdf2) {
      const out = await pbkdf2Async(
        Buffer.from(v.password, 'utf8'),
        Buffer.from(v.salt, 'utf8'),
        v.c,
        v.dkLen,
      );
      results.push({name: v.name, pass: hex(out) === v.expected_hex});
    }
    return results;
  }

  shimCheck() {
    // The app maps `crypto` to react-native-crypto. It must keep working with
    // quick-crypto imported by name next to it.
    const shim = require('crypto');
    const key = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(16, 9);
    const c = shim.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([c.update(Buffer.from('shim test')), c.final()]);
    const tag = c.getAuthTag();
    const d = shim.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]).toString();
    const sha = shim.createHash('sha256').update('abc').digest('hex');
    return {
      gcmRoundTrip: pt === 'shim test',
      sha256abc: sha === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      globalCryptoIsShim: global.crypto === shim || typeof global.crypto?.createHash === 'function',
      quickCryptoInstalledGlobally: global.crypto?.argon2 != null,
    };
  }

  async cloudCheck() {
    try {
      const {CloudStorage} = require('react-native-cloud-storage');
      const available = await CloudStorage.isCloudAvailable();
      return {loaded: true, isCloudAvailable: available};
    } catch (e) {
      return {loaded: false, error: String(e && e.message ? e.message : e)};
    }
  }

  async runAll() {
    const report = {platform: Platform.OS, version: Platform.Version};
    try {
      report.kat = await this.kats();
      this.log('KAT ' + JSON.stringify(report.kat));
      report.shim = this.shimCheck();
      this.log('SHIM ' + JSON.stringify(report.shim));
      report.cloud = await this.cloudCheck();
      this.log('CLOUD ' + JSON.stringify(report.cloud));

      const pw = Buffer.from('correct horse battery staple', 'utf8');
      const salt = Buffer.alloc(16, 0x5a);
      const a2 = (m, t) => () =>
        argon2Async({message: pw, nonce: salt, parallelism: 1, tagLength: 32, memory: m, passes: t});

      report.cases = [];
      report.cases.push(await runCase('argon2id m=65536 t=3 p=1', 5, a2(65536, 3), this.log));
      report.cases.push(await runCase('argon2id m=65536 t=2 p=1', 3, a2(65536, 2), this.log));
      report.cases.push(await runCase('argon2id m=47104 t=1 p=1', 3, a2(47104, 1), this.log));
      report.cases.push(await runCase('pbkdf2-sha256 600000', 3, () => pbkdf2Async(pw, salt, 600000, 32), this.log));

      // One sync call to show what blocking the JS thread looks like.
      const t0 = now();
      argon2Sync('argon2id', {message: pw, nonce: salt, parallelism: 1, tagLength: 32, memory: 65536, passes: 3});
      report.syncArgon2Ms = Math.round(now() - t0);
      this.log('SYNC argon2id 64MiB t=3 (blocks JS): ' + report.syncArgon2Ms + ' ms');
    } catch (e) {
      report.error = String(e && e.stack ? e.stack : e);
      this.log('ERROR ' + report.error);
    }
    this.log('REPORT ' + JSON.stringify(report));
    this.setState({done: true});
  }

  render() {
    return (
      <ScrollView style={{flex: 1, backgroundColor: '#fff'}} contentContainerStyle={{padding: 16, paddingTop: 60}}>
        <Text accessibilityLabel="bench-title" style={{fontSize: 18, fontWeight: '600'}}>
          Vault bench {this.state.done ? 'DONE' : 'RUNNING'}
        </Text>
        <Pressable accessibilityLabel="bench-rerun" onPress={() => { this.setState({lines: [], done: false}); this.runAll(); }}>
          <Text style={{color: '#06c', marginVertical: 8}}>Run again</Text>
        </Pressable>
        <View>
          {this.state.lines.map((l, i) => (
            <Text key={i} style={{fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}}>{l}</Text>
          ))}
        </View>
      </ScrollView>
    );
  }
}
