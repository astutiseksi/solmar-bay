// audio.js — all sound is synthesized with WebAudio: no audio files, no
// network. Simple oscillators + noise buffers for SFX, a looping bass/chord
// pad for music, an engine hum tied to speed, and a two-tone siren.

export function createAudio() {
  const audio = { ctx: null, muted: false, musicOn: false, engineGain: null, sirenGain: null, musicTimer: null };
  let master = null;

  function ensure() {
    if (audio.ctx) return audio.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AC();
      master = audio.ctx.createGain();
      master.gain.value = audio.muted ? 0 : 0.5;
      master.connect(audio.ctx.destination);
      audio.engineGain = audio.ctx.createGain(); audio.engineGain.gain.value = 0;
      const eng = audio.ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 60;
      const engFilter = audio.ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 320;
      eng.connect(engFilter); engFilter.connect(audio.engineGain); audio.engineGain.connect(master); eng.start();
      audio.engineOsc = eng;
      audio.sirenGain = audio.ctx.createGain(); audio.sirenGain.gain.value = 0;
      const sir = audio.ctx.createOscillator(); sir.type = 'square'; sir.frequency.value = 700;
      sir.connect(audio.sirenGain); audio.sirenGain.connect(master); sir.start();
      audio.sirenOsc = sir; audio.sirenPhase = 0;
    } catch { audio.ctx = null; }
    return audio.ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.3, lowpass = 1200) {
    if (!ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource(); src.buffer = buf;
    const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = audio.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  audio.unlock = () => { ensure(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); };
  audio.shot = () => { noise(0.12, 0.5, 2600); tone(160, 0.09, 'square', 0.2, 60); };
  audio.punch = () => { noise(0.08, 0.35, 700); };
  audio.pickup = () => { tone(660, 0.1, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 70); };
  audio.cash = () => { tone(880, 0.08, 'triangle', 0.25); setTimeout(() => tone(1320, 0.12, 'triangle', 0.25), 60); };
  audio.crash = () => { noise(0.3, 0.5, 500); tone(90, 0.25, 'sawtooth', 0.3, 40); };
  audio.explosion = () => { noise(0.7, 0.7, 900); tone(70, 0.6, 'sawtooth', 0.4, 30); };
  audio.busted = () => { tone(220, 0.5, 'sawtooth', 0.3, 110); };
  audio.mission = () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.28), i * 90)); };
  audio.fail = () => { tone(330, 0.3, 'sawtooth', 0.25, 165); };
  audio.reload = () => { tone(440, 0.06, 'square', 0.15); setTimeout(() => tone(550, 0.06, 'square', 0.15), 90); };
  audio.setEngine = (speed01, on) => {
    if (!ensure()) return;
    audio.engineGain.gain.value = on ? 0.05 + speed01 * 0.09 : 0;
    audio.engineOsc.frequency.value = 55 + speed01 * 130;
  };
  audio.setSiren = (on, dt) => {
    if (!ensure()) return;
    audio.sirenGain.gain.value = on ? 0.045 : 0;
    if (on) { audio.sirenPhase += dt * 2.4; audio.sirenOsc.frequency.value = 660 + Math.sin(audio.sirenPhase * Math.PI) * 220; }
  };
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (master) master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };
  // Chill sunset loop: root notes + soft pad chords, scheduled ahead.
  audio.startMusic = () => {
    if (!ensure() || audio.musicOn) return;
    audio.musicOn = true;
    const roots = [110, 87.31, 130.81, 98];
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    let step = 0;
    const tick = () => {
      if (!audio.musicOn) return;
      if (!audio.muted) {
        const bar = Math.floor(step / 4) % 4;
        tone(roots[bar], 0.5, 'triangle', 0.10);
        if (step % 4 === 0) chords[bar].forEach((f) => tone(f, 1.6, 'sine', 0.045));
        if (step % 2 === 1) tone(roots[bar] * 2, 0.12, 'sine', 0.05);
      }
      step++;
      audio.musicTimer = setTimeout(tick, 300);
    };
    tick();
  };
  audio.stopMusic = () => { audio.musicOn = false; clearTimeout(audio.musicTimer); };
  return audio;
}
