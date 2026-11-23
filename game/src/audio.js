// All sound is synthesised with WebAudio: no audio files, no network.
// Effects (gunshot, siren, pickup, crash, punch) plus a low-key procedural
// bass-and-keys loop and an engine hum whose pitch follows the car.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc.connect(engineGain);
      engineOsc.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t);
  }

  // Am — F — C — G bassline with a sparse pentatonic pluck on top.
  const BASS = [55, 43.65, 65.41, 49];
  const PLUCK = [220, 261.63, 329.63, 392, 440, 523.25, 0, 329.63];
  function musicTick() {
    if (!ctx || muted) return;
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    if (beat === 0 || beat === 4) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = BASS[bar];
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.55);
    }
    const note = PLUCK[(step * 3 + bar) % PLUCK.length];
    if (note && beat % 2 === 1) tone(note, 0.18, 'sine', 0.12);
    step += 1;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.35, 2600); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.25, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.2); setTimeout(() => tone(990, 0.12, 'sine', 0.2), 70); },
    cash() { tone(880, 0.1, 'sine', 0.2); setTimeout(() => tone(1174, 0.16, 'sine', 0.2), 80); },
    crash() { noise(0.3, 0.4, 700); tone(90, 0.25, 'sawtooth', 0.2, 40); },
    horn() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.22), i * 110)); },
    fail() { tone(220, 0.3, 'sawtooth', 0.18, 110); },
    busted() { tone(440, 0.5, 'sawtooth', 0.2, 220); },
    setEngine(speed01, on) {
      if (!ensure()) return;
      engineGain.gain.value = on && !muted ? 0.05 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 55 + speed01 * 140;
    },
    setSiren(on) {
      if (!ensure()) return;
      sirenGain.gain.value = on && !muted ? 0.045 : 0;
      if (on) sirenOsc.frequency.value = 650 + Math.sin(performance.now() / 280) * 220;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(musicTick, 240);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}
