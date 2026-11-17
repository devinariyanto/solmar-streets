// SOLMAR STREETS — all sound is synthesised with WebAudio, no audio files.
// Engine hum, sirens, gunshots, footsteps of the interface and the sea are built from
// oscillators and filtered noise, so the game ships zero audio assets and works offline.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;
  let started = false;

  /** Create the context on the first user gesture; browsers block audio before that. */
  function unlock() {
    if (started) {
      if (context && context.state === 'suspended') context.resume();
      return;
    }
    started = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startEngineLoop();
      startSeaLoop();
    } catch {
      context = null;
    }
  }

  function startEngineLoop() {
    engineOsc = context.createOscillator();
    engineOsc2 = context.createOscillator();
    engineGain = context.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc2.type = 'square';
    engineOsc.frequency.value = 55;
    engineOsc2.frequency.value = 28;
    engineGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  }

  /** A slow filtered-noise wash that reads as waves on the promenade. */
  function startSeaLoop() {
    const length = context.sampleRate * 3;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin((i / length) * Math.PI * 2));
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = context.createGain();
    gain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  /** A short burst of white noise through a filter, the raw material for bangs. */
  function noiseBurst(duration, filterFreq, volume, type = 'lowpass') {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type = 'sine', slideTo = null) {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  return {
    unlock,
    get ready() {
      return context !== null;
    },
    /** Engine note follows speed: 0 when on foot or idle, rising with the car. */
    setEngine(running, speedRatio) {
      if (!context || !engineGain) return;
      const target = running ? 0.05 + 0.075 * speedRatio : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + 130 * speedRatio, context.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(26 + 65 * speedRatio, context.currentTime, 0.1);
    },
    /** Two-tone police siren, on while any pursuit is active. */
    setSiren(on) {
      if (!context) return;
      if (on && !sirenOsc) {
        sirenOsc = context.createOscillator();
        sirenGain = context.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 720;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 720 : 540, context.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    gunshot() {
      noiseBurst(0.14, 1800, 0.5, 'bandpass');
      tone(140, 0.1, 0.25, 'sine', 55);
    },
    enemyShot() {
      noiseBurst(0.12, 1200, 0.28, 'bandpass');
    },
    hit() {
      tone(880, 0.07, 0.22, 'square');
    },
    hurt() {
      tone(180, 0.25, 0.3, 'sawtooth', 90);
    },
    chime() {
      tone(660, 0.12, 0.2);
      window.setTimeout(() => tone(880, 0.14, 0.2), 110);
      window.setTimeout(() => tone(1320, 0.22, 0.18), 220);
    },
    fail() {
      tone(320, 0.3, 0.22, 'sawtooth', 160);
      window.setTimeout(() => tone(210, 0.45, 0.22, 'sawtooth', 110), 260);
    },
    click() {
      tone(1200, 0.04, 0.12, 'square');
    },
    pickup() {
      tone(520, 0.09, 0.2, 'sine', 780);
    },
    reload() {
      tone(900, 0.05, 0.15, 'square');
      window.setTimeout(() => tone(650, 0.05, 0.15, 'square'), 140);
    },
    explosion() {
      noiseBurst(0.7, 300, 0.6);
      tone(70, 0.6, 0.4, 'sine', 30);
    },
    carDoor() {
      noiseBurst(0.08, 900, 0.25);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}
