/**
 * Kochi GTA 3D Open World - Standalone Bundle
 * 100% self-contained, works with or without bundlers, works on Netlify, itch.io, Vercel, GitHub Pages.
 */
import * as THREE from './vendor/three.module.js';


// ==================== src/core/InputManager.js ====================
/**
 * InputManager.js
 * Comprehensive PC Keyboard/Mouse + Mobile Multi-Touch Virtual Joystick and Action Buttons.
 */
class InputManager {
  constructor(domElement = document.body) {
    this.domElement = domElement;

    // Keyboard state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      handbrake: false
    };

    // Action triggers (one-shot presses)
    this.actions = {
      enterExit: false,
      horn: false,
      resetVehicle: false,
      changeCamera: false,
      toggleLights: false,
      jump: false
    };

    // Mouse delta for PC
    this.mouse = {
      deltaX: 0,
      deltaY: 0,
      isLocked: false,
      sensitivity: 0.0022
    };

    this.isMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Mobile Virtual Joystick State
    this.isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.touchJoystick = {
      active: false,
      identifier: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dirX: 0,
      dirY: 0,
      radius: 50
    };

    // Right-Screen Touch Camera Look State
    this.touchLook = {
      active: false,
      identifier: null,
      lastX: 0,
      lastY: 0
    };

    this.virtualSprint = false;

    this.initKeyboardMouseEvents();
    this.initTouchEvents();
  }

  initKeyboardMouseEvents() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Pointer lock for PC
    this.domElement.addEventListener('click', (e) => {
      if (this.isTouchDevice) return;
      if (e.target.closest('#ui-container') || e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) {
        return;
      }
      if (!this.mouse.isLocked && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.mouse.isLocked = (document.pointerLockElement === this.domElement);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.mouse.isLocked) {
        this.mouse.deltaX += e.movementX * this.mouse.sensitivity;
        this.mouse.deltaY += e.movementY * this.mouse.sensitivity;
      } else if (this.isMouseDown) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.mouse.deltaX += dx * this.mouse.sensitivity;
        this.mouse.deltaY += dy * this.mouse.sensitivity;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !e.target.closest('#ui-container')) {
        this.isMouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
  }

  initTouchEvents() {
    const joyZone = document.getElementById('joystick-zone');
    const joyThumb = document.getElementById('joystick-thumb');
    const touchCameraZone = document.getElementById('touch-camera-zone');

    if (!joyZone) return;

    // Joystick Touch Start
    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = joyZone.getBoundingClientRect();
      this.touchJoystick.active = true;
      this.touchJoystick.identifier = touch.identifier;
      this.touchJoystick.startX = rect.left + rect.width / 2;
      this.touchJoystick.startY = rect.top + rect.height / 2;
      this.handleJoystickMove(touch.clientX, touch.clientY, joyThumb);
    }, { passive: false });

    // Touch Move for Joystick & Look
    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchJoystick.active && touch.identifier === this.touchJoystick.identifier) {
          this.handleJoystickMove(touch.clientX, touch.clientY, joyThumb);
        } else if (this.touchLook.active && touch.identifier === this.touchLook.identifier) {
          const dx = touch.clientX - this.touchLook.lastX;
          const dy = touch.clientY - this.touchLook.lastY;
          this.mouse.deltaX += dx * 0.004;
          this.mouse.deltaY += dy * 0.004;
          this.touchLook.lastX = touch.clientX;
          this.touchLook.lastY = touch.clientY;
        }
      }
    }, { passive: false });

    // Touch End / Cancel
    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchJoystick.active && touch.identifier === this.touchJoystick.identifier) {
          this.touchJoystick.active = false;
          this.touchJoystick.dirX = 0;
          this.touchJoystick.dirY = 0;
          if (joyThumb) {
            joyThumb.style.transform = `translate(0px, 0px)`;
          }
        } else if (this.touchLook.active && touch.identifier === this.touchLook.identifier) {
          this.touchLook.active = false;
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // Right Half Screen Camera Look
    if (touchCameraZone) {
      touchCameraZone.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches[0];
        this.touchLook.active = true;
        this.touchLook.identifier = touch.identifier;
        this.touchLook.lastX = touch.clientX;
        this.touchLook.lastY = touch.clientY;
      }, { passive: true });
    }

    // Virtual Buttons
    this.bindTouchButton('btn-enter-exit', 'enterExit');
    this.bindTouchButton('btn-jump', 'jump');
    this.bindTouchButton('btn-horn', 'horn');
    this.bindTouchButton('btn-camera', 'changeCamera');

    // Virtual Sprint Button
    const btnSprint = document.getElementById('btn-sprint');
    if (btnSprint) {
      btnSprint.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.virtualSprint = true;
        btnSprint.classList.add('active');
      });
      const endSprint = () => {
        this.virtualSprint = false;
        btnSprint.classList.remove('active');
      };
      btnSprint.addEventListener('touchend', endSprint);
      btnSprint.addEventListener('touchcancel', endSprint);
    }
  }

  handleJoystickMove(clientX, clientY, thumbEl) {
    const dx = clientX - this.touchJoystick.startX;
    const dy = clientY - this.touchJoystick.startY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = this.touchJoystick.radius;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    if (thumbEl) {
      thumbEl.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
    }

    this.touchJoystick.dirX = thumbX / maxRadius;
    this.touchJoystick.dirY = thumbY / maxRadius;
  }

  bindTouchButton(elemId, actionName) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.actions[actionName] = true;
      el.classList.add('active');
    });
    el.addEventListener('touchend', () => {
      el.classList.remove('active');
    });
  }

  onKeyDown(e) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = true;
    if (code === 'Space') {
      this.keys.jump = true;
      this.keys.handbrake = true;
    }
    if (code === 'KeyE') this.actions.enterExit = true;
    if (code === 'KeyH') this.actions.horn = true;
    if (code === 'KeyR') this.actions.resetVehicle = true;
    if (code === 'KeyC') this.actions.changeCamera = true;
    if (code === 'KeyL') this.actions.toggleLights = true;
  }

  onKeyUp(e) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = false;
    if (code === 'Space') {
      this.keys.jump = false;
      this.keys.handbrake = false;
    }
  }

  getMoveX() {
    if (this.touchJoystick.active) {
      return this.touchJoystick.dirX;
    }
    return (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
  }

  getMoveZ() {
    if (this.touchJoystick.active) {
      return this.touchJoystick.dirY;
    }
    return (this.keys.backward ? 1 : 0) - (this.keys.forward ? 1 : 0);
  }

  isSprinting() {
    return this.keys.sprint || this.virtualSprint;
  }

  consumeAction(name) {
    const val = this.actions[name];
    this.actions[name] = false;
    return val;
  }

  getAndResetMouseDelta() {
    const dx = this.mouse.deltaX;
    const dy = this.mouse.deltaY;
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
    return { dx, dy };
  }
}


// ==================== src/core/AudioManager.js ====================
/**
 * AudioManager.js
 * Enhanced Web Audio API Synthesizer with:
 * - Dynamic GTA-style Background Music Engine (Hip-Hop Beat, Synthwave, Lo-Fi)
 * - Independent Master, Music, and SFX Volume Controls
 * - Realistic Vehicle Engines, Horn, Skids, Footsteps, and Action Sounds
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Volume levels (0.0 to 1.0)
    this.masterVol = 0.7;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.isMuted = false;

    // Gain Nodes
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    // Car Engine Nodes
    this.carEngineOsc1 = null;
    this.carEngineOsc2 = null;
    this.carEngineFilter = null;
    this.carEngineGain = null;

    // Bike Engine Nodes
    this.bikeEngineOsc = null;
    this.bikeFilter = null;
    this.bikeGain = null;

    // Skid noise
    this.skidGain = null;

    // Music Sequencer State
    this.isPlayingMusic = true;
    this.currentTrack = 0; // 0: West Coast GTA Beat, 1: Kochi Sunset Synthwave, 2: Kerala Chill Lo-Fi
    this.trackNames = ["Radio Kochi - GTA Vibe", "Sunset Drive - Synthwave", "Vyttila Lo-Fi Chill"];
    this.musicTimer = null;
    this.step = 0;
    this.tempo = 94; // BPM

    // Auto-init on first click/key/touch
    const startAudio = () => {
      this.init();
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio);
    window.addEventListener('keydown', startAudio);
    window.addEventListener('touchstart', startAudio);
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Channel
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVol;
      this.masterGain.connect(this.ctx.destination);

      // Music Channel
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      this.musicGain.connect(this.masterGain);

      // SFX Channel
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.masterGain);

      this.setupCarEngine();
      this.setupBikeEngine();
      this.setupSkid();
      this.startMusicSequencer();

      this.isInitialized = true;
    } catch (err) {
      console.warn("AudioContext failed:", err);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterVol = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVol, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(val) {
    this.musicVol = Math.max(0, Math.min(1, val));
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(val) {
    this.sfxVol = Math.max(0, Math.min(1, val));
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVol, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // ==========================================
  // GTA-STYLE PROCEDURAL MUSIC SYNTHESIZER
  // ==========================================
  startMusicSequencer() {
    if (this.musicTimer) clearInterval(this.musicTimer);

    const stepInterval = (60 / this.tempo / 4) * 1000; // 16th notes
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.isPlayingMusic || this.musicVol <= 0.01) {
        return;
      }
      this.tickMusicStep();
      this.step = (this.step + 1) % 32;
    }, stepInterval);
  }

  tickMusicStep() {
    const now = this.ctx.currentTime;
    const s = this.step;

    // Track 0: GTA West Coast Beat (D Minor)
    if (this.currentTrack === 0) {
      // Kick: beats 0, 6, 14, 16, 22
      if (s === 0 || s === 6 || s === 14 || s === 16 || s === 22) {
        this.synthKick(now);
      }
      // Snare: beats 8, 24
      if (s === 8 || s === 24) {
        this.synthSnare(now);
      }
      // Hi-Hat: every even 16th note, accented on offbeats
      if (s % 2 === 0) {
        this.synthHiHat(now, s % 4 === 2 ? 0.35 : 0.18);
      }
      // Sub Bass (Franklin GTA style slide bass)
      if (s === 0) this.synthBass(now, 73.42, 0.35); // D2
      if (s === 6) this.synthBass(now, 65.41, 0.25); // C2
      if (s === 12) this.synthBass(now, 58.27, 0.35); // Bb1
      if (s === 20) this.synthBass(now, 65.41, 0.25); // C2
      if (s === 24) this.synthBass(now, 73.42, 0.45); // D2

      // Synth Chords (D minor - Bb maj - G min)
      if (s === 0) this.synthPad(now, [293.66, 349.23, 440.0], 1.2); // Dm
      if (s === 12) this.synthPad(now, [233.08, 293.66, 349.23], 0.8); // Bb
      if (s === 24) this.synthPad(now, [196.0, 246.94, 293.66], 0.9); // G

    // Track 1: Sunset Drive - Synthwave
    } else if (this.currentTrack === 1) {
      if (s === 0 || s === 8 || s === 16 || s === 24) {
        this.synthKick(now);
      }
      if (s === 8 || s === 24) {
        this.synthSnare(now);
      }
      if (s % 2 === 0) {
        this.synthHiHat(now, 0.22);
      }
      // Driving 8th-note Synthwave Bass
      if (s % 2 === 0) {
        const root = s < 16 ? 55 : 49; // A1 or G1
        this.synthBass(now, root, 0.15);
      }
      if (s === 0 || s === 16) {
        this.synthPad(now, [220, 261.63, 329.63, 392], 1.4); // Am7
      }

    // Track 2: Vyttila Lo-Fi Chill
    } else {
      if (s === 0 || s === 10 || s === 16) this.synthKick(now);
      if (s === 8 || s === 24) this.synthSnare(now, true);
      if (s % 4 === 2) this.synthHiHat(now, 0.14);
      if (s === 0) this.synthPad(now, [174.61, 220, 261.63, 329.63], 1.8); // Fmaj7
      if (s === 16) this.synthPad(now, [196, 246.94, 293.66, 370], 1.8); // Gmaj7
    }
  }

  synthKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.14);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.23);
  }

  synthSnare(time, isSoft = false) {
    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = isSoft ? 'lowpass' : 'bandpass';
    filter.frequency.value = isSoft ? 1800 : 2400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSoft ? 0.3 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.18);
  }

  synthHiHat(time, vol = 0.2) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = 7500;
    filter.type = 'highpass';
    filter.frequency.value = 8500;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  synthBass(time, freq, duration) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);
    filter.frequency.exponentialRampToValueAtTime(110, time + duration);

    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  synthPad(time, freqs, duration) {
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 800;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  nextRadioTrack() {
    this.currentTrack = (this.currentTrack + 1) % this.trackNames.length;
    this.step = 0;
    return this.trackNames[this.currentTrack];
  }

  getCurrentTrackName() {
    return this.trackNames[this.currentTrack];
  }

  toggleMusic() {
    this.isPlayingMusic = !this.isPlayingMusic;
    return this.isPlayingMusic;
  }

  // ==========================================
  // VEHICLE ENGINES & SFX
  // ==========================================
  setupCarEngine() {
    if (!this.ctx) return;

    this.carEngineGain = this.ctx.createGain();
    this.carEngineGain.gain.value = 0.0;

    this.carEngineFilter = this.ctx.createBiquadFilter();
    this.carEngineFilter.type = 'lowpass';
    this.carEngineFilter.frequency.value = 240;
    this.carEngineFilter.Q.value = 3.5;

    this.carEngineOsc1 = this.ctx.createOscillator();
    this.carEngineOsc1.type = 'sawtooth';
    this.carEngineOsc1.frequency.value = 55;

    this.carEngineOsc2 = this.ctx.createOscillator();
    this.carEngineOsc2.type = 'triangle';
    this.carEngineOsc2.frequency.value = 110;

    this.carEngineOsc1.connect(this.carEngineFilter);
    this.carEngineOsc2.connect(this.carEngineFilter);
    this.carEngineFilter.connect(this.carEngineGain);
    this.carEngineGain.connect(this.sfxGain);

    this.carEngineOsc1.start();
    this.carEngineOsc2.start();
  }

  setupBikeEngine() {
    if (!this.ctx) return;

    this.bikeGain = this.ctx.createGain();
    this.bikeGain.gain.value = 0.0;

    this.bikeFilter = this.ctx.createBiquadFilter();
    this.bikeFilter.type = 'lowpass';
    this.bikeFilter.frequency.value = 180;
    this.bikeFilter.Q.value = 5.0;

    this.bikeEngineOsc = this.ctx.createOscillator();
    this.bikeEngineOsc.type = 'square';
    this.bikeEngineOsc.frequency.value = 28;

    this.bikeEngineOsc.connect(this.bikeFilter);
    this.bikeFilter.connect(this.bikeGain);
    this.bikeGain.connect(this.sfxGain);

    this.bikeEngineOsc.start();
  }

  setupSkid() {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const skidFilter = this.ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1200;
    skidFilter.Q.value = 2.0;

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.value = 0;

    whiteNoise.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxGain);

    whiteNoise.start();
  }

  updateCarEngine(rpm, speedKmh, isPlayerDriving) {
    if (!this.ctx || !this.carEngineGain || this.isMuted) return;

    if (!isPlayerDriving) {
      this.carEngineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }

    this.carEngineGain.gain.setTargetAtTime(0.28, this.ctx.currentTime, 0.05);

    const baseFreq = 48 + (rpm * 85) + (Math.abs(speedKmh) * 1.3);
    this.carEngineOsc1.frequency.setTargetAtTime(Math.min(baseFreq, 340), this.ctx.currentTime, 0.06);
    this.carEngineOsc2.frequency.setTargetAtTime(Math.min(baseFreq * 1.5, 510), this.ctx.currentTime, 0.06);

    const filterFreq = 200 + (rpm * 380) + (Math.abs(speedKmh) * 4.5);
    this.carEngineFilter.frequency.setTargetAtTime(Math.min(filterFreq, 2400), this.ctx.currentTime, 0.08);
  }

  updateBikeEngine(rpm, speedKmh, isPlayerRiding) {
    if (!this.ctx || !this.bikeGain || this.isMuted) return;

    if (!isPlayerRiding) {
      this.bikeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }

    this.bikeGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.05);
    const thumpFreq = 24 + (rpm * 48) + (Math.abs(speedKmh) * 0.9);
    this.bikeEngineOsc.frequency.setTargetAtTime(Math.min(thumpFreq, 150), this.ctx.currentTime, 0.05);
    this.bikeFilter.frequency.setTargetAtTime(150 + rpm * 280, this.ctx.currentTime, 0.08);
  }

  setTireSkid(intensity) {
    if (!this.ctx || !this.skidGain || this.isMuted) return;
    const target = Math.min(Math.max(intensity, 0), 1) * 0.22;
    this.skidGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  playHorn() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const hornGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 390;
    osc2.type = 'sawtooth';
    osc2.frequency.value = 466;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(hornGain);
    hornGain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    hornGain.gain.setValueAtTime(0, now);
    hornGain.gain.linearRampToValueAtTime(0.4, now + 0.04);
    hornGain.gain.setValueAtTime(0.4, now + 0.28);
    hornGain.gain.linearRampToValueAtTime(0, now + 0.38);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  playFootstep(isRunning) {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isRunning ? 95 : 72, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    gain.gain.setValueAtTime(isRunning ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playActionClick() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  playMetroChime() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + (idx * 0.18);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(start);
      osc.stop(start + 0.5);
    });
  }
}


// ==================== src/core/CameraController.js ====================

/**
 * CameraController.js
 * GTA V style third-person camera controller for walking and driving.
 */
class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Target reference
    this.targetObject = null;
    this.mode = 'player'; // 'player' | 'vehicle' | 'bike'

    // Spherical angles for orbit
    this.yaw = 0; // horizontal angle
    this.pitch = 0.22; // vertical angle (radians)
    this.minPitch = -0.35;
    this.maxPitch = 1.35;

    // Distances
    this.playerDistance = 3.8;
    this.vehicleDistances = [5.5, 7.5, 10.5];
    this.currentDistIndex = 1;
    this.vehicleDistance = this.vehicleDistances[this.currentDistIndex];

    // Offsets
    this.playerTargetOffset = new THREE.Vector3(0.35, 1.4, 0); // slightly over right shoulder
    this.vehicleTargetOffset = new THREE.Vector3(0, 1.2, 0);

    // Current smoothed position & lookAt
    this.currentPos = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    // Damping speeds
    this.followSharpness = 8.0;
    this.autoAlignStrength = 2.0;

    // Scroll zoom
    window.addEventListener('wheel', (e) => {
      if (this.mode === 'player') {
        this.playerDistance = THREE.MathUtils.clamp(this.playerDistance + e.deltaY * 0.003, 1.5, 8.0);
      } else {
        this.vehicleDistance = THREE.MathUtils.clamp(this.vehicleDistance + e.deltaY * 0.005, 3.5, 18.0);
      }
    }, { passive: true });
  }

  setTarget(object, mode = 'player') {
    this.targetObject = object;
    this.mode = mode;

    if (object) {
      if (mode === 'vehicle' || mode === 'bike') {
        // Set initial camera yaw to match vehicle heading
        this.yaw = object.rotation.y + Math.PI;
        this.pitch = 0.28;
      }
    }
  }

  cycleCameraDistance() {
    this.currentDistIndex = (this.currentDistIndex + 1) % this.vehicleDistances.length;
    this.vehicleDistance = this.vehicleDistances[this.currentDistIndex];
  }

  update(delta, inputManager) {
    if (!this.targetObject) return;

    // 1. Process mouse look
    const { dx, dy } = inputManager.getAndResetMouseDelta();
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, this.minPitch, this.maxPitch);

    if (inputManager.consumeAction('changeCamera')) {
      this.cycleCameraDistance();
    }

    const targetPos = new THREE.Vector3();
    this.targetObject.getWorldPosition(targetPos);

    if (this.mode === 'player') {
      // Rotate shoulder offset with camera yaw
      const shoulderOffset = this.playerTargetOffset.clone();
      shoulderOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      const lookTarget = targetPos.clone().add(new THREE.Vector3(0, this.playerTargetOffset.y, 0));
      lookTarget.add(shoulderOffset.clone().multiplyScalar(0.4));

      // Calculate camera position using spherical coords
      const dist = this.playerDistance;
      const camX = lookTarget.x + dist * Math.sin(this.yaw) * Math.cos(this.pitch);
      const camY = lookTarget.y + dist * Math.sin(this.pitch);
      const camZ = lookTarget.z + dist * Math.cos(this.yaw) * Math.cos(this.pitch);
      const desiredPos = new THREE.Vector3(camX, Math.max(camY, 0.4), camZ);

      // Smooth interpolation
      const t = 1.0 - Math.exp(-this.followSharpness * delta);
      this.currentPos.lerp(desiredPos, t);
      this.currentLookAt.lerp(lookTarget, t);

      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);

    } else if (this.mode === 'vehicle' || this.mode === 'bike') {
      // Vehicle chase camera
      const lookTarget = targetPos.clone().add(this.vehicleTargetOffset);

      // Auto-align camera behind vehicle if player is not actively moving the mouse
      const vehicleForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.targetObject.quaternion);
      const vehicleHeading = Math.atan2(vehicleForward.x, vehicleForward.z) + Math.PI;

      const speed = this.targetObject.userData.speed || 0;
      if (Math.abs(dx) < 0.001 && Math.abs(speed) > 1.5) {
        // Soft drift back to vehicle rear
        let diff = vehicleHeading - this.yaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.yaw += diff * Math.min(delta * this.autoAlignStrength, 0.1);
      }

      // Dynamic distance and FOV scaling with speed
      const speedKmh = Math.abs(speed) * 3.6;
      const speedOffset = THREE.MathUtils.clamp(speedKmh * 0.04, 0, 3.5);
      const effectiveDist = this.vehicleDistance + speedOffset;

      const camX = lookTarget.x + effectiveDist * Math.sin(this.yaw) * Math.cos(this.pitch);
      const camY = lookTarget.y + effectiveDist * Math.sin(this.pitch);
      const camZ = lookTarget.z + effectiveDist * Math.cos(this.yaw) * Math.cos(this.pitch);
      const desiredPos = new THREE.Vector3(camX, Math.max(camY, 0.6), camZ);

      // Dynamic FOV
      const baseFOV = 60;
      const targetFOV = baseFOV + THREE.MathUtils.clamp(speedKmh * 0.12, 0, 16);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 3.0);
      this.camera.updateProjectionMatrix();

      const t = 1.0 - Math.exp(-this.followSharpness * delta);
      this.currentPos.lerp(desiredPos, t);
      this.currentLookAt.lerp(lookTarget, t);

      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  getYaw() {
    return this.yaw;
  }
}


// ==================== src/world/TextureGenerator.js ====================

/**
 * TextureGenerator.js
 * Generates rich, crisp procedural textures with HTML5 Canvas.
 * Zero external asset dependencies, 100% reliable, zero network latency.
 */
class TextureGenerator {
  static createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base asphalt
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Fine asphalt noise & aggregates
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Weathering & tire tracks
    ctx.fillStyle = 'rgba(15, 17, 20, 0.25)';
    ctx.fillRect(180, 0, 260, 1024);
    ctx.fillRect(580, 0, 260, 1024);

    // Solid white edge lines (Left-hand drive Kerala highway standard)
    ctx.fillStyle = '#f0f3f6';
    ctx.fillRect(40, 0, 20, 1024);
    ctx.fillRect(964, 0, 20, 1024);

    // Yellow center divider line
    ctx.fillStyle = '#f5b800';
    for (let y = 0; y < 1024; y += 128) {
      ctx.fillRect(504, y + 24, 16, 80);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }

  static createFlyoverRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Modern smooth asphalt
    ctx.fillStyle = '#2c2e33';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    // White dashed lane markers
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < 1024; y += 128) {
      ctx.fillRect(340, y + 24, 12, 80);
      ctx.fillRect(672, y + 24, 12, 80);
    }

    // Solid yellow median strip
    ctx.fillStyle = '#f5c000';
    ctx.fillRect(506, 0, 12, 1024);

    // White edge borders
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 16, 1024);
    ctx.fillRect(958, 0, 16, 1024);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }

  static createConcreteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#9ea3a8';
    ctx.fillRect(0, 0, 512, 512);

    // Weathered concrete noise
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 35;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    // Panel formwork seams
    ctx.strokeStyle = 'rgba(70, 75, 80, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  static createHighwaySign(englishText, malayalamText, distanceText, arrow = '↑') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    // Indian National Highway Green Board
    ctx.fillStyle = '#0a6635';
    ctx.roundRect(10, 10, 1004, 340, 24);
    ctx.fill();

    // White reflective border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.roundRect(24, 24, 976, 312, 16);
    ctx.stroke();

    // Arrow symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 90px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrow, 60, 180);

    // Malayalam text
    ctx.font = 'bold 52px "Noto Sans Malayalam", "Manjari", "Arial", sans-serif';
    ctx.fillText(malayalamText, 190, 115);

    // English text
    ctx.font = '900 62px "Trebuchet MS", "Arial Black", sans-serif';
    ctx.fillText(englishText, 190, 215);

    // Distance or Route
    if (distanceText) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#ffde59';
      ctx.fillText(distanceText, 950, 180);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  static createBrototypeSign() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Premium dark graphite background
    ctx.fillStyle = '#121418';
    ctx.fillRect(0, 0, 1024, 512);

    // Orange accent border
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 14;
    ctx.strokeRect(16, 16, 992, 480);

    // Brototype signature stylized bracket logo
    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.arc(180, 210, 85, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#121418';
    ctx.font = '900 95px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('</>', 180, 210);

    // "BROTOTYPE" bold typography
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 92px "Arial Black", sans-serif';
    ctx.fillText('BROTOTYPE', 310, 180);

    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
    ctx.fillText('KOCHI HUB  •  BROCAMP', 315, 255);

    // Malayalam subtitle & Location
    ctx.fillStyle = '#d0d4dc';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('ബ്രോടൈപ്പ് കൊച്ചി  |  KUNDANNOOR - MARADU', 315, 320);

    // Bottom strip
    ctx.fillStyle = '#ff6b00';
    ctx.fillRect(24, 420, 976, 68);
    ctx.fillStyle = '#121418';
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("KERALA'S LEADING TECH TRAINING ECOSYSTEM", 512, 465);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createForumMallLogo() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    // Deep metallic charcoal
    ctx.fillStyle = '#1a1c23';
    ctx.fillRect(0, 0, 1024, 340);

    // Elegant gold border
    ctx.strokeStyle = '#e5a93b';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 1000, 316);

    // Bold Forum logo
    ctx.fillStyle = '#f5b82e';
    ctx.font = '900 135px "Times New Roman", "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FORUM', 512, 135);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('KOCHI  •  MARADU', 512, 245);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createLuluMallLogo() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    // Clean white mall facade panel
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 360);

    // Outer subtle frame
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 1000, 336);

    // Distinctive green & red Lulu emblem
    // Green circular background for the iconic LuLu letters
    ctx.fillStyle = '#00873e';
    ctx.beginPath();
    ctx.arc(220, 180, 120, 0, Math.PI * 2);
    ctx.fill();

    // Red cursive "LuLu" inside
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 86px "Brush Script MT", "Segoe Script", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LuLu', 220, 175);

    // Text: LULU INTERNATIONAL SHOPPING MALL
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d81e05';
    ctx.font = '900 70px "Arial Black", sans-serif';
    ctx.fillText('LuLu Mall', 380, 140);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('KOCHI  •  EDAPPALLY', 385, 210);

    ctx.fillStyle = '#00873e';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('ലുലു ഇന്റർനാഷണൽ ഷോപ്പിംഗ് മാൾ', 385, 265);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createShopSign(englishName, malayalamName, themeColor = '#b91c1c') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = themeColor;
    ctx.fillRect(0, 0, 512, 200);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 496, 184);

    // Malayalam text on top
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(malayalamName, 256, 65);

    // English text below
    ctx.font = '900 48px "Arial Black", sans-serif';
    ctx.fillText(englishName, 256, 135);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createStadiumBanner() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Kerala Blasters yellow & blue pride
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#f5c518');
    grad.addColorStop(0.5, '#eab308');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 52px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JAWAHARLAL NEHRU INTERNATIONAL STADIUM', 512, 85);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('ജവഹർലാൽ നെഹ്റു സ്റ്റേഡിയം കലൂർ  •  KALOOR', 512, 165);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createNumberPlate(plateText = 'KL 07 CD 2024') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Indian high-security number plate (white reflective)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 64);

    // Blue IND strip on left
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 36, 64);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IND', 18, 38);

    // Black embossed text
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(plateText, 145, 34);

    // Thin black border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, 254, 62);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createFootballPitchTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Striped mown grass
    for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#2d7a32' : '#358c3a';
      ctx.fillRect(0, y, 1024, 64);
    }

    // White pitch markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;

    // Outer boundary
    ctx.strokeRect(60, 60, 904, 904);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(60, 512);
    ctx.lineTo(964, 512);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(512, 512, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(512, 512, 10, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    ctx.strokeRect(260, 60, 504, 180);
    ctx.strokeRect(260, 784, 504, 180);

    // Goal areas
    ctx.strokeRect(380, 60, 264, 70);
    ctx.strokeRect(380, 894, 264, 70);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}


// ==================== src/world/WeatherAtmosphere.js ====================

/**
 * WeatherAtmosphere.js
 * Cinematic Kerala 4:30 PM Golden Hour lighting, tropical atmospheric haze, and time-of-day presets.
 */
class WeatherAtmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.sunLight = null;
    this.hemiLight = null;
    this.currentPreset = 'goldenHour';

    this.initAtmosphere();
  }

  initAtmosphere() {
    // 1. Hemispherical Light (Sky ambient + Green ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xffecd2, 0x3b6528, 1.2);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Directional Sun Light (4:30 PM Kerala Golden Hour Angle)
    this.sunLight = new THREE.DirectionalLight(0xffa858, 2.4);
    this.sunLight.position.set(140, 95, 180);
    this.sunLight.castShadow = true;

    // Optimized shadow frustum covering the playable area around player
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 450;

    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;

    this.scene.add(this.sunLight);

    // 3. Kerala Tropical Atmospheric Haze / Fog
    this.scene.fog = new THREE.FogExp2(0xe5b88c, 0.0028);

    // 4. Background Sky Color
    this.scene.background = new THREE.Color(0xf6caa0);

    // Renderer tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  updateFollowPosition(playerPos) {
    // Keep shadow volume centered around active player
    if (this.sunLight && playerPos) {
      this.sunLight.position.set(playerPos.x + 140, 95, playerPos.z + 180);
      this.sunLight.target.position.copy(playerPos);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  setPreset(preset) {
    this.currentPreset = preset;

    if (preset === 'goldenHour') {
      // 4:30 PM Kerala Warm Golden Hour
      this.sunLight.color.setHex(0xffa858);
      this.sunLight.intensity = 2.4;
      this.sunLight.position.set(140, 80, 180);
      this.hemiLight.color.setHex(0xffecd2);
      this.hemiLight.groundColor.setHex(0x3b6528);
      this.hemiLight.intensity = 1.2;
      this.scene.fog.color.setHex(0xe5b88c);
      this.scene.fog.density = 0.0028;
      this.scene.background.setHex(0xf6caa0);
      this.renderer.toneMappingExposure = 1.1;

    } else if (preset === 'noon') {
      // Bright tropical midday sun
      this.sunLight.color.setHex(0xffffff);
      this.sunLight.intensity = 2.8;
      this.sunLight.position.set(40, 180, 40);
      this.hemiLight.color.setHex(0xbbe1fa);
      this.hemiLight.groundColor.setHex(0x274e13);
      this.hemiLight.intensity = 1.4;
      this.scene.fog.color.setHex(0xbfdbfe);
      this.scene.fog.density = 0.0020;
      this.scene.background.setHex(0x7dd3fc);
      this.renderer.toneMappingExposure = 1.0;

    } else if (preset === 'night') {
      // Dusk / Night with glowing streetlights and neon
      this.sunLight.color.setHex(0x38bdf8);
      this.sunLight.intensity = 0.35;
      this.sunLight.position.set(-60, 70, -60);
      this.hemiLight.color.setHex(0x0f172a);
      this.hemiLight.groundColor.setHex(0x020617);
      this.hemiLight.intensity = 0.5;
      this.scene.fog.color.setHex(0x090d16);
      this.scene.fog.density = 0.0045;
      this.scene.background.setHex(0x090d16);
      this.renderer.toneMappingExposure = 1.25;

    } else if (preset === 'monsoon') {
      // Kerala Monsoon Overcast & moody
      this.sunLight.color.setHex(0x94a3b8);
      this.sunLight.intensity = 1.1;
      this.hemiLight.color.setHex(0x64748b);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.hemiLight.intensity = 0.9;
      this.scene.fog.color.setHex(0x64748b);
      this.scene.fog.density = 0.0055;
      this.scene.background.setHex(0x475569);
      this.renderer.toneMappingExposure = 0.95;
    }
  }
}


// ==================== src/world/FoliageManager.js ====================

/**
 * FoliageManager.js
 * Generates authentic Kerala coconut palms (Cocos nucifera) and tropical greenery.
 * Uses InstancedMesh and merged geometries for maximum 60 FPS performance.
 */
class FoliageManager {
  constructor(scene) {
    this.scene = scene;
    this.palmMeshes = [];
    this.bananaMeshes = [];
  }

  createCoconutTreeModel() {
    const group = new THREE.Group();

    // Trunk: Curved cylinder with rings
    const trunkCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3((Math.random() - 0.5) * 1.5, 5, (Math.random() - 0.5) * 1.5),
      new THREE.Vector3((Math.random() - 0.5) * 2.8, 10 + Math.random() * 2, (Math.random() - 0.5) * 2.8)
    );

    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 20, 0.42, 8, false);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6e5c4a,
      roughness: 0.9,
      metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const crownPos = trunkCurve.getPoint(1);

    // Coconuts cluster
    const nutGeo = new THREE.SphereGeometry(0.32, 7, 7);
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x5b7033, roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const nut = new THREE.Mesh(nutGeo, nutMat);
      const angle = (i / 7) * Math.PI * 2;
      nut.position.set(
        crownPos.x + Math.cos(angle) * 0.45,
        crownPos.y - 0.35 + (i % 2) * 0.15,
        crownPos.z + Math.sin(angle) * 0.45
      );
      group.add(nut);
    }

    // Coconut Fronds (16 leaves radiating out & drooping down)
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x2e6f28,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    const frondCount = 16;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.2);
      const frondLen = 4.2 + Math.random() * 0.8;
      const droop = 1.8 + Math.random() * 0.6;

      const p0 = new THREE.Vector3(0, 0, 0);
      const p1 = new THREE.Vector3(Math.cos(angle) * (frondLen * 0.5), 0.8, Math.sin(angle) * (frondLen * 0.5));
      const p2 = new THREE.Vector3(Math.cos(angle) * frondLen, -droop, Math.sin(angle) * frondLen);

      const leafCurve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const leafGeo = new THREE.TubeGeometry(leafCurve, 10, 0.22, 4, false);

      // Frond leaflets (planar shape for leaf blades)
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0);
      bladeShape.lineTo(0.5, frondLen * 0.5);
      bladeShape.lineTo(0, frondLen);
      bladeShape.lineTo(-0.5, frondLen * 0.5);
      bladeShape.closePath();

      const bladeGeo = new THREE.ShapeGeometry(bladeShape);
      const bladeMesh = new THREE.Mesh(bladeGeo, frondMat);
      bladeMesh.rotation.x = Math.PI / 2;
      bladeMesh.rotation.z = -angle;
      bladeMesh.position.copy(crownPos);
      bladeMesh.scale.set(0.7, 0.7, 0.7);

      const frondStem = new THREE.Mesh(leafGeo, frondMat);
      frondStem.position.copy(crownPos);
      frondStem.castShadow = true;

      group.add(frondStem);
      group.add(bladeMesh);
    }

    return group;
  }

  createBananaTreeModel() {
    const group = new THREE.Group();

    // Pseudostem (greenish-brown trunk)
    const stemGeo = new THREE.CylinderGeometry(0.2, 0.28, 2.8, 7);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a7536, roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.4;
    group.add(stem);

    // Large paddle leaves
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3d8b2d,
      roughness: 0.6,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      leafShape.quadraticCurveTo(0.45, 1.2, 0, 2.5);
      leafShape.quadraticCurveTo(-0.45, 1.2, 0, 0);

      const leafGeo = new THREE.ShapeGeometry(leafShape);
      const leafMesh = new THREE.Mesh(leafGeo, leafMat);
      leafMesh.position.set(0, 2.4, 0);
      leafMesh.rotation.y = angle;
      leafMesh.rotation.x = 0.65;
      leafMesh.scale.set(1.2, 1.2, 1.2);
      leafMesh.castShadow = true;
      group.add(leafMesh);
    }

    return group;
  }

  populateWorld(waterLevel = -0.5) {
    const palmTemplate = this.createCoconutTreeModel();
    const bananaTemplate = this.createBananaTreeModel();

    // 1. Palms along the Kumbalam/Kundannoor backwaters (South Z = +380 to +460)
    for (let x = -240; x <= 240; x += 18 + Math.random() * 10) {
      // Avoid road center
      if (Math.abs(x) < 25) continue;
      const z = 410 + (Math.random() - 0.5) * 40;
      this.spawnPalm(palmTemplate, x, 0, z);
    }

    // 2. Palms along the Kaniyampuzha River shore at Vyttila Mobility Hub (Z = +20 to +90, X = +120 to +220)
    for (let i = 0; i < 28; i++) {
      const x = 140 + Math.random() * 90;
      const z = 20 + Math.random() * 90;
      this.spawnPalm(palmTemplate, x, 0, z);
    }

    // 3. Palms lining the NH 66 corridor medians and sidewalks
    for (let z = -420; z <= 420; z += 35) {
      // Left sidewalk & right sidewalk
      this.spawnPalm(palmTemplate, -22 - Math.random() * 4, 0, z + (Math.random() - 0.5) * 8);
      this.spawnPalm(palmTemplate, 22 + Math.random() * 4, 0, z + (Math.random() - 0.5) * 8);

      // Banana trees in plots behind sidewalks
      if (Math.random() > 0.4) {
        this.spawnBanana(bananaTemplate, -28 - Math.random() * 6, 0, z);
        this.spawnBanana(bananaTemplate, 28 + Math.random() * 6, 0, z);
      }
    }

    // 4. Palms surrounding Kaloor Stadium perimeter (circular grove)
    const stadiumCenterX = -65;
    const stadiumCenterZ = -180;
    const radius = 62;
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const x = stadiumCenterX + Math.cos(angle) * radius;
      const z = stadiumCenterZ + Math.sin(angle) * radius;
      this.spawnPalm(palmTemplate, x, 0, z);
    }

    // 5. Forum Mall and Lulu Mall entrance landscaped palm avenues
    // Forum Mall (Z = +230, X = -45)
    for (let i = 0; i < 8; i++) {
      this.spawnPalm(palmTemplate, -35, 0, 210 + i * 6);
      this.spawnPalm(palmTemplate, -55, 0, 210 + i * 6);
    }

    // Lulu Mall (Z = -360, X = +40 to +140)
    for (let i = 0; i < 10; i++) {
      this.spawnPalm(palmTemplate, 48, 0, -380 + i * 6);
      this.spawnPalm(palmTemplate, 64, 0, -380 + i * 6);
    }

    // Brototype Hub courtyard palms (Z = +310, X = +45)
    this.spawnPalm(palmTemplate, 36, 0, 305);
    this.spawnPalm(palmTemplate, 36, 0, 320);
    this.spawnPalm(palmTemplate, 56, 0, 305);
  }

  spawnPalm(template, x, y, z) {
    const palm = template.clone();
    palm.position.set(x, y, z);
    const scale = 0.85 + Math.random() * 0.35;
    palm.scale.set(scale, scale, scale);
    palm.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(palm);
    this.palmMeshes.push(palm);
  }

  spawnBanana(template, x, y, z) {
    const banana = template.clone();
    banana.position.set(x, y, z);
    const scale = 0.8 + Math.random() * 0.4;
    banana.scale.set(scale, scale, scale);
    banana.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(banana);
    this.bananaMeshes.push(banana);
  }
}


// ==================== src/world/LandmarkManager.js ====================


/**
 * LandmarkManager.js
 * Builds detailed, recognizable procedural 3D architectural models of the 7 required Kochi landmarks.
 */
class LandmarkManager {
  constructor(scene) {
    this.scene = scene;
    this.landmarks = [];
    this.colliders = []; // bounding boxes / obstacles for collision checking
    this.animatedMaterials = [];
  }

  buildAllLandmarks() {
    this.buildKundannoorJunction();
    this.buildBrototypeHub();
    this.buildForumMall();
    this.buildKaloorStadium();
    this.buildLuluMall();
    this.buildVyttilaMobilityHub();
    this.buildFlyoversAndInterchanges();
  }

  // 1. KUNDANNOOR JUNCTION (Z = +360, X = 0)
  buildKundannoorJunction() {
    const group = new THREE.Group();
    group.name = "Landmark_KundannoorJunction";

    // Ground Roundabout Island
    const islandGeo = new THREE.CylinderGeometry(14, 14, 0.4, 32);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x3b7538, roughness: 0.9 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, 0.2, 360);
    group.add(island);

    // Black & Yellow Curb
    const curbGeo = new THREE.CylinderGeometry(14.3, 14.3, 0.35, 32, 1, true);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xf5b800, roughness: 0.8 });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(0, 0.25, 360);
    group.add(curb);

    // Kerala Police Traffic Control Booth
    const boothGroup = new THREE.Group();
    boothGroup.position.set(0, 0.4, 360);

    const boothBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    boothGroup.add(boothBase);

    // Octagonal cabin
    const cabin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    );
    cabin.position.y = 1.45;
    boothGroup.add(cabin);

    // Blue canopy roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
    );
    roof.position.y = 3.1;
    boothGroup.add(roof);

    // Police Beacon light
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 })
    );
    beacon.position.y = 3.7;
    boothGroup.add(beacon);

    group.add(boothGroup);
    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 2, 360), new THREE.Vector3(5, 4, 5)));

    // Overhead NH 66 / NH 85 Highway Gantry Signs
    const gantryWest = this.createOverheadGantry(
      "VYTTILA / EDAPPALLY (NH 66)", "വൈറ്റില / ഇടപ്പള്ളി",
      "THEVARA / MG ROAD", "തേവര / എം.ജി റോഡ്",
      new THREE.Vector3(-18, 0, 335), Math.PI / 2
    );
    group.add(gantryWest);

    const gantrySouth = this.createOverheadGantry(
      "AROOR / ALAPPUZHA (NH 66)", "അരൂർ / ആലപ്പുഴ",
      "MARADU / KUNDANNOOR", "മരട് / കുണ്ടന്നൂർ",
      new THREE.Vector3(0, 0, 395), 0
    );
    group.add(gantrySouth);

    this.scene.add(group);
    this.landmarks.push({ name: "Kundannoor Junction", pos: new THREE.Vector3(0, 0, 360) });
  }

  // 2. BROTOTYPE KOCHI HUB (Z = +310, X = +52, Maradu corridor)
  buildBrototypeHub() {
    const group = new THREE.Group();
    group.name = "Landmark_BrototypeHub";
    const posX = 52;
    const posZ = 310;

    // Edathuruthikaran Holdings - Modern 4-Storey IT Building
    const buildingGeo = new THREE.BoxGeometry(26, 18, 22);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.2
    });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.set(posX, 9, posZ);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Glass Facade Curtain Windows
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.1,
      metalness: 0.85
    });

    for (let floor = 0; floor < 4; floor++) {
      const windowStrip = new THREE.Mesh(
        new THREE.BoxGeometry(24, 2.6, 0.4),
        glassMat
      );
      windowStrip.position.set(posX, 3.5 + floor * 4.2, posZ - 11.1);
      group.add(windowStrip);
    }

    // Brototype Orange Architectural Louver Accent
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff6b00,
      roughness: 0.4,
      metalness: 0.2
    });
    const verticalAccent = new THREE.Mesh(new THREE.BoxGeometry(1.6, 18.2, 22.4), accentMat);
    verticalAccent.position.set(posX - 12.2, 9, posZ);
    group.add(verticalAccent);

    // Large Illuminated BROTOTYPE Signboard
    const signTex = TextureGenerator.createBrototypeSign();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), signMat);
    signBoard.position.set(posX, 14, posZ - 11.3);
    group.add(signBoard);

    // Campus Front Entrance Canopy Portico
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.3 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 6), canopyMat);
    canopy.position.set(posX, 4.2, posZ - 14);
    group.add(canopy);

    // Pillars supporting canopy
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const pil1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 12), pillarMat);
    pil1.position.set(posX - 5, 2.1, posZ - 16.5);
    const pil2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 12), pillarMat);
    pil2.position.set(posX + 5, 2.1, posZ - 16.5);
    group.add(pil1, pil2);

    // Compound Wall with gate
    this.createCompoundWall(posX, posZ - 18, 34, 1.8, group);

    // Paved courtyard in front with parked student bikes
    const courtyardGeo = new THREE.BoxGeometry(34, 0.1, 14);
    const courtyardMat = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.8 });
    const courtyard = new THREE.Mesh(courtyardGeo, courtyardMat);
    courtyard.position.set(posX, 0.05, posZ - 15);
    group.add(courtyard);

    // Collider
    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX, 9, posZ), new THREE.Vector3(28, 18, 24)));

    this.scene.add(group);
    this.landmarks.push({ name: "Brototype Kochi Hub", pos: new THREE.Vector3(posX - 10, 0, posZ - 16) });
  }

  // 3. FORUM KOCHI (Z = +230, X = -55, NH 66 Maradu)
  buildForumMall() {
    const group = new THREE.Group();
    group.name = "Landmark_ForumMall";
    const posX = -55;
    const posZ = 230;

    // Main Mall Structure: Sweeping curved modern structure
    const mallGeo = new THREE.BoxGeometry(38, 24, 30);
    const mallMat = new THREE.MeshStandardMaterial({
      color: 0x242831,
      roughness: 0.35,
      metalness: 0.4
    });
    const mall = new THREE.Mesh(mallGeo, mallMat);
    mall.position.set(posX, 12, posZ);
    mall.castShadow = true;
    mall.receiveShadow = true;
    group.add(mall);

    // Curved Glass Atrium Wing
    const curveGeo = new THREE.CylinderGeometry(14, 14, 24, 16, 1, false, 0, Math.PI);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const curveAtrium = new THREE.Mesh(curveGeo, glassMat);
    curveAtrium.rotation.y = Math.PI / 2;
    curveAtrium.position.set(posX + 18, 12, posZ);
    group.add(curveAtrium);

    // Golden Architectural Fin Accents
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdfa037,
      roughness: 0.25,
      metalness: 0.7
    });
    for (let i = 0; i < 7; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 24.2, 2.5), goldMat);
      fin.position.set(posX + 19.1, 12, posZ - 12 + i * 4);
      group.add(fin);
    }

    // Huge Digital LED Advertising Screen (Dynamic animated canvas)
    const ledCanvas = document.createElement('canvas');
    ledCanvas.width = 512;
    ledCanvas.height = 512;
    const ledCtx = ledCanvas.getContext('2d');
    const ledTex = new THREE.CanvasTexture(ledCanvas);

    const ledScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 12),
      new THREE.MeshBasicMaterial({ map: ledTex })
    );
    ledScreen.rotation.y = Math.PI / 2;
    ledScreen.position.set(posX + 19.3, 13, posZ - 2);
    group.add(ledScreen);

    // Store reference to animate digital LED screen in update()
    this.animatedMaterials.push({
      type: 'ledScreen',
      canvas: ledCanvas,
      ctx: ledCtx,
      texture: ledTex,
      timer: 0
    });

    // Grand "FORUM" Illuminated Logo Sign
    const forumTex = TextureGenerator.createForumMallLogo();
    const forumSign = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 6),
      new THREE.MeshBasicMaterial({ map: forumTex })
    );
    forumSign.rotation.y = Math.PI / 2;
    forumSign.position.set(posX + 19.4, 21.5, posZ);
    group.add(forumSign);

    // Multi-Deck Parking Structure Annex
    const parkingGeo = new THREE.BoxGeometry(24, 16, 22);
    const parkingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const parking = new THREE.Mesh(parkingGeo, parkingMat);
    parking.position.set(posX - 22, 8, posZ);
    group.add(parking);

    // Entrance Portico Canopy
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    canopy.position.set(posX + 24, 4.5, posZ);
    group.add(canopy);

    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX, 12, posZ), new THREE.Vector3(44, 24, 34)));

    this.scene.add(group);
    this.landmarks.push({ name: "Forum Kochi", pos: new THREE.Vector3(posX + 28, 0, posZ) });
  }

  // 4. JAWAHARLAL NEHRU INTERNATIONAL STADIUM, KALOOR (Z = -180, X = -65)
  buildKaloorStadium() {
    const group = new THREE.Group();
    group.name = "Landmark_KaloorStadium";
    const posX = -68;
    const posZ = -180;

    // Outer Circular Concrete Colosseum Structure
    // Tier 1 (Lower Outer Ring)
    const tier1Geo = new THREE.CylinderGeometry(52, 54, 8, 36, 1, true);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85
    });
    const tier1 = new THREE.Mesh(tier1Geo, concreteMat);
    tier1.position.set(posX, 4, posZ);
    tier1.castShadow = true;
    group.add(tier1);

    // Tier 2 (Upper Stepped Ring)
    const tier2Geo = new THREE.CylinderGeometry(46, 50, 7, 36, 1, true);
    const tier2 = new THREE.Mesh(tier2Geo, concreteMat);
    tier2.position.set(posX, 11.5, posZ);
    tier2.castShadow = true;
    group.add(tier2);

    // Radial Exterior Concrete Rib Columns (Signature architectural feature of Kaloor stadium)
    const ribGeo = new THREE.BoxGeometry(1.2, 16, 2.5);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.8 });
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(
        posX + Math.cos(angle) * 53,
        8,
        posZ + Math.sin(angle) * 53
      );
      rib.rotation.y = -angle + Math.PI / 2;
      rib.castShadow = true;
      group.add(rib);
    }

    // Seating Bowl (Kerala Blasters Yellow & Blue)
    const seatsGeo = new THREE.CylinderGeometry(44, 28, 11, 36, 1, true);
    const seatsMat = new THREE.MeshStandardMaterial({
      color: 0xf5b800, // Vibrant Yellow seats
      roughness: 0.7,
      side: THREE.DoubleSide
    });
    const seats = new THREE.Mesh(seatsGeo, seatsMat);
    seats.position.set(posX, 6.5, posZ);
    group.add(seats);

    // Lush Football Pitch & Athletics Track
    const pitchTex = TextureGenerator.createFootballPitchTexture();
    const pitchGeo = new THREE.PlaneGeometry(54, 40);
    const pitchMat = new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.7 });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.set(posX, 0.4, posZ);
    group.add(pitch);

    // Red Running Track Surrounding Pitch
    const trackGeo = new THREE.CylinderGeometry(27.5, 27.5, 0.2, 36);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xa83232, roughness: 0.9 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(posX, 0.25, posZ);
    group.add(track);

    // 4 Iconic Towering Stadium Floodlight Masts (tilted over pitch)
    const mastPositions = [
      { x: posX + 48, z: posZ + 48, rotY: -Math.PI * 0.75 },
      { x: posX - 48, z: posZ + 48, rotY: -Math.PI * 0.25 },
      { x: posX - 48, z: posZ - 48, rotY: Math.PI * 0.25 },
      { x: posX + 48, z: posZ - 48, rotY: Math.PI * 0.75 }
    ];

    mastPositions.forEach(mast => {
      const mastGroup = new THREE.Group();
      mastGroup.position.set(mast.x, 0, mast.z);
      mastGroup.rotation.y = mast.rotY;

      // Triangular steel lattice mast tower
      const towerGeo = new THREE.CylinderGeometry(0.6, 1.8, 34, 4);
      const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.3 });
      const tower = new THREE.Mesh(towerGeo, steelMat);
      tower.position.set(0, 17, 0);
      tower.rotation.x = 0.12; // tilt inward over stadium
      mastGroup.add(tower);

      // Floodlight Bank (Bank of 30 brilliant lamps)
      const bankGeo = new THREE.BoxGeometry(6.5, 3.8, 0.8);
      const bankMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const bank = new THREE.Mesh(bankGeo, bankMat);
      bank.position.set(0, 33.5, 2.2);
      bank.rotation.x = 0.35; // tilt downward towards field
      mastGroup.add(bank);

      // Glowing floodlight lenses
      const lensGeo = new THREE.PlaneGeometry(6.2, 3.4);
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xfffaed
      });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 33.5, 2.65);
      lens.rotation.x = 0.35;
      mastGroup.add(lens);

      group.add(mastGroup);
    });

    // Grand Entrance Plaza & Banner on Banerjee Road side
    const bannerTex = TextureGenerator.createStadiumBanner();
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    banner.rotation.y = Math.PI / 2;
    banner.position.set(posX + 54.5, 9, posZ);
    group.add(banner);

    // Front Plaza arch gates
    const gatePillar1 = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), ribMat);
    gatePillar1.position.set(posX + 58, 4, posZ - 8);
    const gatePillar2 = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), ribMat);
    gatePillar2.position.set(posX + 58, 4, posZ + 8);
    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 18), ribMat);
    archBeam.position.set(posX + 58, 8, posZ);
    group.add(gatePillar1, gatePillar2, archBeam);

    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX, 10, posZ), new THREE.Vector3(105, 20, 105)));

    this.scene.add(group);
    this.landmarks.push({ name: "Kaloor Stadium (JLN)", pos: new THREE.Vector3(posX + 62, 0, posZ) });
  }

  // 5. LULU INTERNATIONAL SHOPPING MALL, EDAPPALLY (Z = -360, X = +75)
  buildLuluMall() {
    const group = new THREE.Group();
    group.name = "Landmark_LuluMall";
    const posX = 75;
    const posZ = -360;

    // Sprawling Main Mall Complex (Signature curved white & glass facade)
    const mainBuildingGeo = new THREE.BoxGeometry(50, 22, 36);
    const facadeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Crisp white/ivory panels
      roughness: 0.3,
      metalness: 0.1
    });
    const mainBuilding = new THREE.Mesh(mainBuildingGeo, facadeMat);
    mainBuilding.position.set(posX, 11, posZ);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    group.add(mainBuilding);

    // Signature Glass Atrium Skylight Dome
    const domeGeo = new THREE.SphereGeometry(12, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.75
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(posX, 21.5, posZ);
    group.add(dome);

    // Multi-Deck Parking Annex
    const parkingGeo = new THREE.BoxGeometry(32, 16, 36);
    const parkingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const parking = new THREE.Mesh(parkingGeo, parkingMat);
    parking.position.set(posX + 40, 8, posZ);
    group.add(parking);

    // Horizontal Glass Ribbon Windows along facade
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8 });
    for (let f = 0; f < 3; f++) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 34), ribbonMat);
      ribbon.position.set(posX - 25.1, 5 + f * 5, posZ);
      group.add(ribbon);
    }

    // Iconic "LuLu" 3D Signboard Facing Edappally Junction / Highway
    const luluTex = TextureGenerator.createLuluMallLogo();
    const luluSign = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 7.5),
      new THREE.MeshBasicMaterial({ map: luluTex })
    );
    luluSign.rotation.y = -Math.PI / 2;
    luluSign.position.set(posX - 25.2, 17, posZ);
    group.add(luluSign);

    // Grand Entrance Drop-off Portico & Water Fountain Courtyard
    const portico = new THREE.Mesh(
      new THREE.BoxGeometry(18, 1, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    portico.position.set(posX - 28, 4.8, posZ);
    group.add(portico);

    // Famous Edappally Skywalk: Enclosed pedestrian bridge from Lulu 2nd floor to Edappally Metro Station!
    // Connects from posX - 25 across highway to X = +12 at Y = 8.5m
    const skywalkLen = 35;
    const skywalkGeo = new THREE.BoxGeometry(skywalkLen, 3.2, 4);
    const skywalkMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.4
    });
    const skywalk = new THREE.Mesh(skywalkGeo, skywalkMat);
    skywalk.position.set(posX - 25 - (skywalkLen / 2), 8.5, posZ + 14);
    group.add(skywalk);

    // Glass windows along the skywalk
    const skywalkGlass = new THREE.Mesh(
      new THREE.BoxGeometry(skywalkLen - 2, 1.8, 4.1),
      domeMat
    );
    skywalkGlass.position.copy(skywalk.position);
    group.add(skywalkGlass);

    // Support pillars for skywalk
    const skyPillarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8.5, 12), skyPillarMat);
    p1.position.set(posX - 40, 4.25, posZ + 14);
    group.add(p1);

    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX + 10, 11, posZ), new THREE.Vector3(75, 22, 40)));

    this.scene.add(group);
    this.landmarks.push({ name: "Lulu Mall Edappally", pos: new THREE.Vector3(posX - 32, 0, posZ) });
  }

  // 6. VYTTILA MOBILITY HUB (Z = +50, X = +130 to +210)
  buildVyttilaMobilityHub() {
    const group = new THREE.Group();
    group.name = "Landmark_VyttilaMobilityHub";
    const posX = 145;
    const posZ = 50;

    // Sprawling Bus Terminal Platform Ground (Asphalt & Paved concourse)
    const platformGeo = new THREE.BoxGeometry(70, 0.3, 85);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(posX, 0.15, posZ);
    group.add(platform);

    // Distinctive Long Curved Blue Bus Bay Canopies (Sawtooth bays)
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Kerala transport blue
      roughness: 0.4,
      metalness: 0.2
    });

    for (let b = 0; b < 3; b++) {
      const bayZ = posZ - 26 + b * 26;

      // Curved canopy roof
      const roofCurve = new THREE.CylinderGeometry(8, 8, 55, 16, 1, false, 0, Math.PI);
      const canopy = new THREE.Mesh(roofCurve, canopyMat);
      canopy.rotation.z = Math.PI / 2;
      canopy.position.set(posX, 5.2, bayZ);
      group.add(canopy);

      // Steel support columns
      for (let c = -20; c <= 20; c += 10) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 5, 8),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7 })
        );
        col.position.set(posX + c, 2.5, bayZ);
        group.add(col);
      }
    }

    // Passenger Terminal & Ticket Concourse Building
    const concourseGeo = new THREE.BoxGeometry(16, 8, 40);
    const concourseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
    const concourse = new THREE.Mesh(concourseGeo, concourseMat);
    concourse.position.set(posX - 30, 4, posZ);
    group.add(concourse);

    // Parked Kerala Buses at the bays!
    // KSRTC Fast Passenger (Red & Yellow)
    this.createStaticBus(posX - 8, 0.3, posZ - 26, 0, '#cc1111', '#f5b800', "KSRTC FAST PASSENGER", group);
    // Kerala Private Bus (Cyan & Green colorful livery)
    this.createStaticBus(posX + 10, 0.3, posZ - 26, 0, '#0d9488', '#ec4899', "VYTTILA - KALOOR", group);
    // KSRTC Ordinary Bus
    this.createStaticBus(posX - 4, 0.3, posZ, 0, '#cc1111', '#ffffff', "KSRTC KOCHI", group);
    // Private Bus
    this.createStaticBus(posX + 12, 0.3, posZ + 26, 0, '#2563eb', '#fbbf24', "ALUVA - VYTTILA", group);

    // KOCHI WATER METRO JETTY TERMINAL (on the Kaniyampuzha backwaters at X = +190, Z = +50)
    const jettyGroup = new THREE.Group();
    jettyGroup.position.set(posX + 42, 0, posZ);

    // Jetty Pontoon over water
    const pontoonGeo = new THREE.BoxGeometry(22, 1.2, 34);
    const pontoonMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.3 });
    const pontoon = new THREE.Mesh(pontoonGeo, pontoonMat);
    pontoon.position.set(0, 0.2, 0);
    jettyGroup.add(pontoon);

    // Water Metro Glass Terminal Building
    const wmBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5, 20),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
    );
    wmBuilding.position.set(0, 2.7, 0);
    jettyGroup.add(wmBuilding);

    // "KOCHI WATER METRO" Signboard
    const wmSignTex = TextureGenerator.createShopSign("WATER METRO", "കൊച്ചി വാട്ടർ മെട്രോ", "#0f766e");
    const wmSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), new THREE.MeshBasicMaterial({ map: wmSignTex }));
    wmSign.position.set(0, 4.2, -10.1);
    jettyGroup.add(wmSign);

    // Docked Water Metro Electric Catamaran Ferry!
    const boatGeo = new THREE.BoxGeometry(6, 2.2, 14);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });
    const boat = new THREE.Mesh(boatGeo, boatMat);
    boat.position.set(13, -0.1, 0);
    jettyGroup.add(boat);

    group.add(jettyGroup);

    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX - 30, 4, posZ), new THREE.Vector3(18, 8, 42)));

    this.scene.add(group);
    this.landmarks.push({ name: "Vyttila Mobility Hub", pos: new THREE.Vector3(posX - 18, 0, posZ) });
  }

  // 7. MAJOR KOCHI FLYOVERS & MULTI-LAYER INTERCHANGES
  buildFlyoversAndInterchanges() {
    const group = new THREE.Group();
    group.name = "Landmark_FlyoverNetwork";

    // A. KUNDANNOOR FLYOVER (Z = +430 to +270 at Y = 7.0m, X = 0)
    this.createHighwayFlyover(0, 7.0, 430, 270, group, "Kundannoor Flyover");

    // B. VYTTILA FLYOVER (Z = +120 to -20 at Y = 8.0m, X = 0)
    this.createHighwayFlyover(0, 8.0, 120, -20, group, "Vyttila Flyover");

    // C. EDAPPALLY FLYOVER (Z = -290 to -420 at Y = 7.5m, X = 0)
    this.createHighwayFlyover(0, 7.5, -290, -420, group, "Edappally Flyover");

    this.scene.add(group);
  }

  createHighwayFlyover(posX, height, startZ, endZ, parentGroup, flyoverName) {
    const length = Math.abs(startZ - endZ);
    const centerZ = (startZ + endZ) / 2;
    const rampLength = 35;
    const flatLength = length - (rampLength * 2);

    const roadTex = TextureGenerator.createFlyoverRoadTexture();
    roadTex.repeat.set(1, length / 24);

    // Elevated Deck
    const deckMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.7,
      metalness: 0.1
    });

    // Main flat middle section
    const deckGeo = new THREE.BoxGeometry(14, 0.9, flatLength);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(posX, height, centerZ);
    deck.receiveShadow = true;
    parentGroup.add(deck);

    // Blue Crash Barriers on both sides
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    const bLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, flatLength), barrierMat);
    bLeft.position.set(posX - 6.8, height + 0.8, centerZ);
    const bRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, flatLength), barrierMat);
    bRight.position.set(posX + 6.8, height + 0.8, centerZ);
    parentGroup.add(bLeft, bRight);

    // Massive Concrete Piers with Flared Hammerheads
    const pierMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createConcreteTexture(),
      roughness: 0.9
    });

    const pierSpacing = 28;
    for (let z = Math.min(startZ, endZ) + rampLength + 10; z <= Math.max(startZ, endZ) - rampLength - 10; z += pierSpacing) {
      // Pier column
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, height, 12), pierMat);
      pier.position.set(posX, height / 2, z);
      pier.castShadow = true;
      parentGroup.add(pier);

      // Flared hammerhead beam
      const cap = new THREE.Mesh(new THREE.BoxGeometry(13.8, 1.4, 2.6), pierMat);
      cap.position.set(posX, height - 0.7, z);
      parentGroup.add(cap);

      // Collider for pier column
      this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(posX, height / 2, z), new THREE.Vector3(3.6, height, 3.6)));
    }

    // Approach and Departure Ramps
    // South Ramp
    const ramp1Geo = new THREE.BoxGeometry(14, 0.9, rampLength);
    const ramp1 = new THREE.Mesh(ramp1Geo, deckMat);
    const angle1 = Math.atan2(height, rampLength);
    ramp1.rotation.x = -Math.sign(startZ - endZ) * angle1;
    ramp1.position.set(posX, height / 2, startZ - Math.sign(startZ - endZ) * (rampLength / 2));
    parentGroup.add(ramp1);

    // North Ramp
    const ramp2Geo = new THREE.BoxGeometry(14, 0.9, rampLength);
    const ramp2 = new THREE.Mesh(ramp2Geo, deckMat);
    ramp2.rotation.x = Math.sign(startZ - endZ) * angle1;
    ramp2.position.set(posX, height / 2, endZ + Math.sign(startZ - endZ) * (rampLength / 2));
    parentGroup.add(ramp2);
  }

  createStaticBus(x, y, z, rotY, primaryColor, secondaryColor, label, group) {
    const bus = new THREE.Group();
    bus.position.set(x, y, z);
    bus.rotation.y = rotY;

    // Bus Body (Length: 10m, Width: 2.8m, Height: 3.2m)
    const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.35 });
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 9.8), bodyMat);
    lowerBody.position.y = 1.3;
    bus.add(lowerBody);

    // Upper body / roof stripe
    const upperMat = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.4 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.78, 1.4, 9.7), upperMat);
    roof.position.y = 2.65;
    bus.add(roof);

    // Glass Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.9 });
    const winSides = new THREE.Mesh(new THREE.BoxGeometry(2.84, 1.0, 8.8), winMat);
    winSides.position.y = 2.45;
    bus.add(winSides);

    // Wheels (6 wheels)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelPositions = [
      [-1.3, 0.5, 2.8], [1.3, 0.5, 2.8],
      [-1.3, 0.5, -2.6], [1.3, 0.5, -2.6],
      [-1.3, 0.5, -3.6], [1.3, 0.5, -3.6]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      bus.add(wheel);
    });

    group.add(bus);
    this.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y + 1.8, z), new THREE.Vector3(3.2, 3.4, 10.2)));
  }

  createOverheadGantry(text1, mal1, text2, mal2, position, rotY) {
    const gantry = new THREE.Group();
    gantry.position.copy(position);
    gantry.rotation.y = rotY;

    // Steel portal frame
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7.5, 12), steelMat);
    p1.position.set(-8, 3.75, 0);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7.5, 12), steelMat);
    p2.position.set(8, 3.75, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(17, 0.8, 0.8), steelMat);
    beam.position.set(0, 7.2, 0);
    gantry.add(p1, p2, beam);

    // Two Highway Boards
    const sign1Tex = TextureGenerator.createHighwaySign(text1, mal1, "NH 66", "↑");
    const board1 = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.4), new THREE.MeshBasicMaterial({ map: sign1Tex }));
    board1.position.set(-4, 5.8, 0.45);
    gantry.add(board1);

    const sign2Tex = TextureGenerator.createHighwaySign(text2, mal2, "", "←");
    const board2 = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.4), new THREE.MeshBasicMaterial({ map: sign2Tex }));
    board2.position.set(4, 5.8, 0.45);
    gantry.add(board2);

    return gantry;
  }

  createCompoundWall(x, z, length, height, group) {
    const wallGeo = new THREE.BoxGeometry(length, height, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(x, height / 2, z);
    group.add(wall);

    // Red Terracotta Coping Tiles on Top
    const tileGeo = new THREE.BoxGeometry(length + 0.2, 0.15, 0.6);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
    const tile = new THREE.Mesh(tileGeo, tileMat);
    tile.position.set(x, height + 0.08, z);
    group.add(tile);
  }

  addCollider(box3) {
    this.colliders.push(box3);
  }

  update(delta) {
    // Animate LED digital screens (Forum mall dynamic ads)
    this.animatedMaterials.forEach(item => {
      if (item.type === 'ledScreen') {
        item.timer += delta;
        const ctx = item.ctx;
        const t = item.timer;

        // Gradient color shift ad
        const hue1 = (t * 25) % 360;
        const hue2 = (hue1 + 60) % 360;
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, `hsl(${hue1}, 80%, 40%)`);
        grad.addColorStop(1, `hsl(${hue2}, 85%, 25%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Bold Ad Typography
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FORUM KOCHI', 256, 160);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('LUXURY SHOPPING & DINE', 256, 230);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('MARADU  •  KUNDANNOOR', 256, 310);

        // Blinking sale pill
        const blink = Math.sin(t * 6) > 0;
        if (blink) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(106, 370, 300, 50);
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 26px sans-serif';
          ctx.fillText('WEEKEND DEALS', 256, 405);
        }

        item.texture.needsUpdate = true;
      }
    });
  }

  getLandmarksList() {
    return this.landmarks;
  }
}


// ==================== src/world/MetroSystem.js ====================


/**
 * MetroSystem.js
 * Builds the elevated Kochi Metro viaduct, stations, and moving 3-car train.
 */
class MetroSystem {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;

    this.trainGroup = null;
    this.trainState = 'moving'; // 'moving' | 'stopping' | 'stopped'
    this.trainSpeed = 0;
    this.targetSpeed = 16.0; // ~58 km/h
    this.trainZ = 60;
    this.trainDirection = -1; // -1 towards Edappally, +1 towards Vyttila
    this.stopTimer = 0;

    // Station positions along corridor
    this.stations = [
      { name: "Vyttila Metro", z: 40, x: 12, height: 12.5 },
      { name: "JLN Stadium Metro", z: -170, x: 14, height: 12.5 },
      { name: "Edappally Metro", z: -340, x: 12, height: 15.0 }
    ];

    this.initMetroViaduct();
    this.initStations();
    this.initMetroTrain();
  }

  initMetroViaduct() {
    const group = new THREE.Group();
    group.name = "Metro_Viaduct";

    // Track path runs from Z = +90 (Vyttila) down to Z = -420 (Edappally)
    const startZ = 90;
    const endZ = -420;
    const trackX = 12;

    // Track geometry with elevation profile
    // Standard height = 12.5m, rises to 15.2m at Edappally (Z = -300 to -380) to cross flyover!
    const pierMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createConcreteTexture(),
      roughness: 0.85
    });

    // Elevated concrete beam segments & piers
    for (let z = startZ; z >= endZ; z -= 14) {
      const height = this.getTrackHeightAtZ(z);

      // Octagonal concrete pier
      const pier = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, height, 8),
        pierMat
      );
      pier.position.set(trackX, height / 2, z);
      pier.castShadow = true;
      group.add(pier);

      // Hammerhead pier cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 1.1, 2.4),
        pierMat
      );
      cap.position.set(trackX, height - 0.55, z);
      group.add(cap);
    }

    // Continuous elevated concrete guideway
    const guidewayMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.8
    });

    const segments = 45;
    for (let i = 0; i < segments; i++) {
      const z1 = startZ - (i / segments) * (startZ - endZ);
      const z2 = startZ - ((i + 1) / segments) * (startZ - endZ);
      const segLen = Math.abs(z1 - z2);
      const segZ = (z1 + z2) / 2;
      const h1 = this.getTrackHeightAtZ(z1);
      const h2 = this.getTrackHeightAtZ(z2);
      const segH = (h1 + h2) / 2;

      // Slab deck
      const slab = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.8, segLen + 0.2), guidewayMat);
      slab.position.set(trackX, segH, segZ);
      slab.rotation.x = Math.atan2(h2 - h1, segLen);
      group.add(slab);

      // Turquoise decorative fascia parapet (Signature Kochi Metro cyan/turquoise color)
      const parapetMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 });
      const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, segLen + 0.2), parapetMat);
      pLeft.position.set(trackX - 2.8, segH + 0.65, segZ);
      pLeft.rotation.x = slab.rotation.x;
      const pRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, segLen + 0.2), parapetMat);
      pRight.position.set(trackX + 2.8, segH + 0.65, segZ);
      pRight.rotation.x = slab.rotation.x;
      group.add(pLeft, pRight);

      // Steel running rails (dual tracks)
      const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      [-1.4, -0.6, 0.6, 1.4].forEach(railOffset => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, segLen + 0.2), railMat);
        rail.position.set(trackX + railOffset, segH + 0.46, segZ);
        rail.rotation.x = slab.rotation.x;
        group.add(rail);
      });
    }

    this.scene.add(group);
  }

  getTrackHeightAtZ(z) {
    // Elevates to 15.2m between -290 and -380 to soar above Edappally flyover!
    if (z <= -280 && z >= -390) {
      const t = Math.sin(((z - -280) / (-390 - -280)) * Math.PI);
      return 12.5 + t * 2.7;
    }
    return 12.5;
  }

  initStations() {
    this.stations.forEach(st => {
      const group = new THREE.Group();
      group.position.set(st.x, 0, st.z);

      // Station Platform Deck
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 1.2, 38),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
      );
      deck.position.set(0, st.height, 0);
      group.add(deck);

      // Arched Station Canopy Roof
      const roofGeo = new THREE.CylinderGeometry(7, 7, 36, 16, 1, false, 0, Math.PI);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4, // Kochi Metro Turquoise
        roughness: 0.3,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.z = Math.PI / 2;
      roof.position.set(0, st.height + 4.8, 0);
      group.add(roof);

      // Platform Screen Doors (Glass)
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.65
      });
      const psdLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 32), glassMat);
      psdLeft.position.set(-3.2, st.height + 1.6, 0);
      const psdRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 32), glassMat);
      psdRight.position.set(3.2, st.height + 1.6, 0);
      group.add(psdLeft, psdRight);

      // Station Signboard
      const signTex = TextureGenerator.createShopSign(st.name.toUpperCase(), "കൊച്ചി മെട്രോ", "#0891b2");
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 2.2),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      sign.position.set(5.3, st.height + 2.8, 0);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);

      // Ground Access Stair Pillars
      const stairPillar = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, st.height, 6),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 })
      );
      stairPillar.position.set(0, st.height / 2, 0);
      group.add(stairPillar);

      this.scene.add(group);
    });
  }

  initMetroTrain() {
    this.trainGroup = new THREE.Group();
    this.trainGroup.name = "KochiMetroTrain";

    // 3 Coaches (Lead Cab, Middle Trailer, Rear Cab)
    // Signature Kochi Metro Livery: Turquoise cyan roof & front, sleek metallic silver body, wave door graphics
    const coachLength = 12.5;
    const coachWidth = 2.8;
    const coachHeight = 3.2;

    for (let c = -1; c <= 1; c++) {
      const coach = new THREE.Group();
      coach.position.set(0, 0, c * (coachLength + 0.6));

      // Coach Body
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Metallic silver
        metalness: 0.7,
        roughness: 0.25
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(coachWidth, coachHeight, coachLength), bodyMat);
      body.position.y = coachHeight / 2 + 0.2;
      coach.add(body);

      // Turquoise Roof Stripe
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(coachWidth * 0.95, 0.4, coachLength), roofMat);
      roof.position.y = coachHeight + 0.2;
      coach.add(roof);

      // Windows strip
      const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, coachLength * 0.85), winMat);
      winL.position.set(-coachWidth / 2 - 0.02, coachHeight * 0.6, 0);
      const winR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, coachLength * 0.85), winMat);
      winR.position.set(coachWidth / 2 + 0.02, coachHeight * 0.6, 0);
      coach.add(winL, winR);

      // Turquoise Wave Door Accents
      const doorAccentMat = new THREE.MeshStandardMaterial({ color: 0x0891b2 });
      [-3, 0, 3].forEach(dz => {
        const d1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 1.6), doorAccentMat);
        d1.position.set(-coachWidth / 2 - 0.03, 1.3, dz);
        const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 1.6), doorAccentMat);
        d2.position.set(coachWidth / 2 + 0.03, 1.3, dz);
        coach.add(d1, d2);
      });

      // Front Cab nose cone on lead & rear coaches
      if (c === 1 || c === -1) {
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.25 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(coachWidth * 0.9, coachHeight * 0.85, 1.4), noseMat);
        nose.position.set(0, coachHeight / 2 + 0.1, c * (coachLength / 2 + 0.7));
        coach.add(nose);

        // Windshield
        const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), winMat);
        ws.position.set(0, coachHeight * 0.7, c * (coachLength / 2 + 1.41));
        if (c === -1) ws.rotation.y = Math.PI;
        coach.add(ws);

        // Glowing LED Headlights
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), headMat);
        h1.position.set(-0.8, 0.8, c * (coachLength / 2 + 1.42));
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), headMat);
        h2.position.set(0.8, 0.8, c * (coachLength / 2 + 1.42));
        coach.add(h1, h2);
      }

      this.trainGroup.add(coach);
    }

    this.scene.add(this.trainGroup);
  }

  update(delta) {
    if (!this.trainGroup) return;

    // Automated train patrol
    const currentH = this.getTrackHeightAtZ(this.trainZ);
    this.trainGroup.position.set(12, currentH + 0.45, this.trainZ);

    if (this.trainState === 'moving') {
      // Accelerate towards targetSpeed
      this.trainSpeed = THREE.MathUtils.lerp(this.trainSpeed, this.targetSpeed, delta * 0.6);
      this.trainZ += this.trainSpeed * this.trainDirection * delta;

      // Check proximity to stations
      for (const st of this.stations) {
        const dist = Math.abs(this.trainZ - st.z);
        if (dist < 4.0 && this.trainSpeed > 5.0) {
          // Trigger station arrival
          this.trainState = 'stopping';
          break;
        }
      }

      // Check end of track turnaround (Z = +80 or Z = -400)
      if (this.trainZ <= -395 && this.trainDirection === -1) {
        this.trainDirection = 1;
        this.trainState = 'stopped';
        this.stopTimer = 5.0;
        this.audioManager?.playMetroChime();
      } else if (this.trainZ >= 75 && this.trainDirection === 1) {
        this.trainDirection = -1;
        this.trainState = 'stopped';
        this.stopTimer = 5.0;
        this.audioManager?.playMetroChime();
      }

    } else if (this.trainState === 'stopping') {
      this.trainSpeed = THREE.MathUtils.lerp(this.trainSpeed, 0, delta * 1.5);
      this.trainZ += this.trainSpeed * this.trainDirection * delta;

      if (this.trainSpeed < 0.2) {
        this.trainSpeed = 0;
        this.trainState = 'stopped';
        this.stopTimer = 4.5; // dwell time at station
        this.audioManager?.playMetroChime();
      }

    } else if (this.trainState === 'stopped') {
      this.stopTimer -= delta;
      if (this.stopTimer <= 0) {
        this.trainState = 'moving';
        this.trainZ += this.trainDirection * 4.2; // advance out of station threshold
      }
    }
  }
}


// ==================== src/world/WorldManager.js ====================


/**
 * WorldManager.js
 * Builds the open-world miniature Kochi terrain, road network, backwaters, and street props.
 */
class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.waterMesh = null;
    this.waterTime = 0;
    this.streetlights = [];
    this.colliders = []; // World colliders

    this.initTerrain();
    this.initBackwaters();
    this.initRoadNetwork();
    this.initStreetFurniture();
    this.initRoadsideShops();
  }

  initTerrain() {
    // Vast tropical ground plane
    const groundGeo = new THREE.PlaneGeometry(900, 1100, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3e682e, // Lush Kerala greenery
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  initBackwaters() {
    // 1. Kumbalam / Kundannoor Backwater Channel (Southern border, Z = +410 to +490)
    // 2. Kaniyampuzha Backwaters at Vyttila (Eastern side, X = +180 to +350, Z = -10 to +110)
    const waterGeo = new THREE.PlaneGeometry(800, 100);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0f4c5c, // Deep tropical backwater teal
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    });

    // South Kumbalam Water Channel
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(0, -0.4, 450);
    this.scene.add(this.waterMesh);

    // Kaniyampuzha River along Vyttila Mobility Hub
    const riverGeo = new THREE.PlaneGeometry(160, 240);
    const river = new THREE.Mesh(riverGeo, waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(220, -0.4, 50);
    this.scene.add(river);

    // Kundannoor Kumbalam Bridge structure carrying NH 66 across the water
    const bridgeGeo = new THREE.BoxGeometry(22, 1.4, 85);
    const bridgeMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createAsphaltTexture(),
      roughness: 0.7
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(0, 0.6, 450);
    bridge.receiveShadow = true;
    this.scene.add(bridge);

    // Bridge concrete railings
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
    const rL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 85), railMat);
    rL.position.set(-10.8, 1.5, 450);
    const rR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 85), railMat);
    rR.position.set(10.8, 1.5, 450);
    this.scene.add(rL, rR);
  }

  initRoadNetwork() {
    const roadGroup = new THREE.Group();
    roadGroup.name = "RoadNetwork";

    const asphaltTex = TextureGenerator.createAsphaltTexture();
    asphaltTex.repeat.set(1, 35);

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.8,
      metalness: 0.1
    });

    // Main Spine: NH 66 Corridor (Width: 20m, Length: 900m from Z = +450 to -450)
    const nh66Geo = new THREE.PlaneGeometry(20, 900);
    const nh66 = new THREE.Mesh(nh66Geo, roadMat);
    nh66.rotation.x = -Math.PI / 2;
    nh66.position.set(0, 0.02, 0);
    nh66.receiveShadow = true;
    roadGroup.add(nh66);

    // Concrete Sidewalks flanking NH 66
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.85 });
    const swLeft = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 900), sidewalkMat);
    swLeft.position.set(-11.8, 0.15, 0);
    const swRight = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 900), sidewalkMat);
    swRight.position.set(11.8, 0.15, 0);
    roadGroup.add(swLeft, swRight);

    // Central Median with Black & Yellow Curb Stones
    const medianMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });
    const median = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 900), medianMat);
    median.position.set(0, 0.2, 0);
    roadGroup.add(median);

    // Arterial Cross Roads:
    // 1. Kundannoor NH 85 / Thevara Bridge Road (Z = +360, Width: 18m, Length: 280m)
    const kRoadGeo = new THREE.PlaneGeometry(280, 18);
    const kRoad = new THREE.Mesh(kRoadGeo, roadMat);
    kRoad.rotation.x = -Math.PI / 2;
    kRoad.position.set(0, 0.025, 360);
    kRoad.receiveShadow = true;
    roadGroup.add(kRoad);

    // 2. Vyttila SA Road (Heading West towards South Station/MG Road) & Kaniyampuzha Road (East)
    const vyttilaCrossGeo = new THREE.PlaneGeometry(360, 20);
    const vyttilaCross = new THREE.Mesh(vyttilaCrossGeo, roadMat);
    vyttilaCross.rotation.x = -Math.PI / 2;
    vyttilaCross.position.set(50, 0.025, 50);
    vyttilaCross.receiveShadow = true;
    roadGroup.add(vyttilaCross);

    // 3. Kaloor Banerjee Road (Z = -180, leading to JLN Stadium)
    const kaloorRoadGeo = new THREE.PlaneGeometry(260, 18);
    const kaloorRoad = new THREE.Mesh(kaloorRoadGeo, roadMat);
    kaloorRoad.rotation.x = -Math.PI / 2;
    kaloorRoad.position.set(-40, 0.025, -180);
    kaloorRoad.receiveShadow = true;
    roadGroup.add(kaloorRoad);

    // 4. Edappally Junction Crossroad (NH 544 to Aluva/Thrissur, Z = -340)
    const edappallyCrossGeo = new THREE.PlaneGeometry(320, 20);
    const edappallyCross = new THREE.Mesh(edappallyCrossGeo, roadMat);
    edappallyCross.rotation.x = -Math.PI / 2;
    edappallyCross.position.set(20, 0.025, -340);
    edappallyCross.receiveShadow = true;
    roadGroup.add(edappallyCross);

    // Zebra Crossings at Junctions
    this.createZebraCrossing(0, 345, 18, 4, roadGroup);
    this.createZebraCrossing(0, 375, 18, 4, roadGroup);
    this.createZebraCrossing(0, 35, 18, 4, roadGroup);
    this.createZebraCrossing(0, 65, 18, 4, roadGroup);
    this.createZebraCrossing(0, -165, 18, 4, roadGroup);
    this.createZebraCrossing(0, -195, 18, 4, roadGroup);
    this.createZebraCrossing(0, -325, 18, 4, roadGroup);
    this.createZebraCrossing(0, -355, 18, 4, roadGroup);

    this.scene.add(roadGroup);
  }

  createZebraCrossing(x, z, width, depth, group) {
    const zebraCanvas = document.createElement('canvas');
    zebraCanvas.width = 256;
    zebraCanvas.height = 128;
    const ctx = zebraCanvas.getContext('2d');
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 256; i += 40) {
      ctx.fillRect(i + 8, 10, 24, 108);
    }
    const zebraTex = new THREE.CanvasTexture(zebraCanvas);
    const crossing = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: zebraTex, roughness: 0.9 })
    );
    crossing.rotation.x = -Math.PI / 2;
    crossing.position.set(x, 0.035, z);
    group.add(crossing);
  }

  initStreetFurniture() {
    const furnitureGroup = new THREE.Group();
    furnitureGroup.name = "StreetFurniture";

    // 1. Streetlights along NH 66 median (every 32m)
    for (let z = -430; z <= 430; z += 32) {
      const lamp = this.createStreetlight(0, 0.3, z);
      furnitureGroup.add(lamp);
    }

    // 2. Kerala Electrical Utility Concrete Poles with Drooping Cables
    for (let z = -420; z <= 420; z += 38) {
      // East side poles
      const pole = this.createKeralaUtilityPole(15.5, 0, z);
      furnitureGroup.add(pole);

      // Drooping cable between consecutive poles
      if (z + 38 <= 420) {
        const cable = this.createDroopingCable(
          new THREE.Vector3(15.5, 7.8, z),
          new THREE.Vector3(15.5, 7.8, z + 38)
        );
        furnitureGroup.add(cable);
      }
    }

    // 3. Traffic Lights at Major Junctions
    const junctionsZ = [360, 50, -180, -340];
    junctionsZ.forEach(jz => {
      furnitureGroup.add(this.createTrafficLight(-11, 0, jz - 12, 0));
      furnitureGroup.add(this.createTrafficLight(11, 0, jz + 12, Math.PI));
    });

    this.scene.add(furnitureGroup);
  }

  createStreetlight(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Galvanized steel pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 8.5, 8), poleMat);
    pole.position.y = 4.25;
    group.add(pole);

    // Dual outreach arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), armMat);
    armL.rotation.z = Math.PI / 4;
    armL.position.set(-0.9, 8.2, 0);

    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), armMat);
    armR.rotation.z = -Math.PI / 4;
    armR.position.set(0.9, 8.2, 0);
    group.add(armL, armR);

    // Glowing LED Luminaire fixtures
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const fixL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.7), fixtureMat);
    fixL.position.set(-1.8, 7.8, 0);

    const fixR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.7), fixtureMat);
    fixR.position.set(1.8, 7.8, 0);
    group.add(fixL, fixR);

    this.streetlights.push({ fixL, fixR });
    return group;
  }

  createKeralaUtilityPole(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Concrete square-tapered pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.5, 0.35), poleMat);
    pole.position.y = 4.25;
    group.add(pole);

    // Steel crossarms (2 crossarms)
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x44403c });
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), steelMat);
    arm1.position.set(0, 7.8, 0);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), steelMat);
    arm2.position.set(0, 7.0, 0);
    group.add(arm1, arm2);

    // Porcelain ceramic insulators
    const insMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.3 });
    [-1.0, 0, 1.0].forEach(ix => {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 6), insMat);
      ins.position.set(ix, 7.95, 0);
      group.add(ins);
    });

    // Transformer cylinder on selected poles
    if (Math.abs(z % 120) < 10) {
      const trans = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x57534e })
      );
      trans.position.set(0.6, 5.5, 0);
      group.add(trans);
    }

    return group;
  }

  createDroopingCable(p1, p2) {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.y -= 1.1; // Catenary droop

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const geo = new THREE.TubeGeometry(curve, 12, 0.025, 4, false);
    const mat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    return new THREE.Mesh(geo, mat);
  }

  createTrafficLight(x, y, z, rotY) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    pole.position.y = 2.75;
    group.add(pole);

    // Signal head box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    box.position.set(0, 4.6, 0.3);
    group.add(box);

    // Red, Amber, Green lenses
    const redLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redLens.position.set(0, 5.15, 0.62);

    const amberLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x334155 }) // off
    );
    amberLens.position.set(0, 4.6, 0.62);

    const greenLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    greenLens.position.set(0, 4.05, 0.62);

    group.add(redLens, amberLens, greenLens);
    return group;
  }

  initRoadsideShops() {
    const shopGroup = new THREE.Group();
    shopGroup.name = "RoadsideShops";

    // 1. Traditional Kerala "ചായക്കട" (Tea Shop & Snacks) near Kaloor (Z = -140, X = 18)
    const teaShop = this.createKeralaTeaShop(19, 0, -140);
    shopGroup.add(teaShop);

    // 2. Hotel Malabar (Z = -220, X = 20)
    const malabarHotel = this.createStoreBuilding(20, 0, -220, "HOTEL MALABAR", "ഹോട്ടൽ മലബാർ", "#b91c1c");
    shopGroup.add(malabarHotel);

    // 3. Kerala Bakery (Z = +160, X = -20)
    const bakery = this.createStoreBuilding(-20, 0, 160, "COCHIN BAKERY", "കൊച്ചിൻ ബേക്കറി", "#047857");
    shopGroup.add(bakery);

    // 4. Milma Milk Booth (Z = +280, X = -18)
    const milma = this.createMilmaBooth(-18, 0, 280);
    shopGroup.add(milma);

    // 5. Classic Kerala Bus Stop Shelters
    const busStop1 = this.createKeralaBusShelter(-15, 0, 180, "MARADU BUS STOP");
    const busStop2 = this.createKeralaBusShelter(-15, 0, -110, "KALOOR STADIUM STOP");
    shopGroup.add(busStop1, busStop2);

    // 6. Large Advertising Hoardings / Billboards
    const billboard1 = this.createHighwayBillboard(
      "KERALA BLASTERS FC", "മഞ്ഞപ്പട - YENNUM YELLOW!",
      "#facc15", "#1e3a8a",
      new THREE.Vector3(-24, 0, 100), Math.PI / 2
    );
    const billboard2 = this.createHighwayBillboard(
      "KALYAN SILKS", "കല്യാൺ സിൽക്സ്  •  KOCHI",
      "#dc2626", "#ffffff",
      new THREE.Vector3(25, 0, -80), -Math.PI / 2
    );
    shopGroup.add(billboard1, billboard2);

    this.scene.add(shopGroup);
  }

  createKeralaTeaShop(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Main tea shack structure
    const shackGeo = new THREE.BoxGeometry(8, 3.8, 6);
    const shackMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
    const shack = new THREE.Mesh(shackGeo, shackMat);
    shack.position.set(0, 1.9, 0);
    group.add(shack);

    // Sloped red terracotta tiled roof
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.8, 4), roofMat);
    roof.position.set(0, 4.5, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Open storefront counter
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.1, 1.2), counterMat);
    counter.position.set(-1.8, 0.55, -2.8);
    group.add(counter);

    // Glass snacks case (Pazhampori / Samosa display)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.6 });
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.8), glassMat);
    caseMesh.position.set(-1.8, 1.45, -2.8);
    group.add(caseMesh);

    // Authentic Kerala Signboard: "ചായ & കടി"
    const signTex = TextureGenerator.createShopSign("TEA & SNACKS", "ചായക്കട & കടി", "#b45309");
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 3.2, -3.05);
    group.add(sign);

    return group;
  }

  createStoreBuilding(x, y, z, engTitle, malTitle, color) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const buildingGeo = new THREE.BoxGeometry(10, 7.5, 12);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.set(0, 3.75, 0);
    group.add(building);

    // Signboard
    const signTex = TextureGenerator.createShopSign(engTitle, malTitle, color);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.4), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 6.2, -6.05);
    group.add(sign);

    // Storefront glass
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 0.2), glassMat);
    glass.position.set(0, 1.8, -6.02);
    group.add(glass);

    return group;
  }

  createMilmaBooth(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Blue & White Milma Booth
    const boothGeo = new THREE.BoxGeometry(4.5, 3.2, 3.5);
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const booth = new THREE.Mesh(boothGeo, boothMat);
    booth.position.y = 1.6;
    group.add(booth);

    // Milma sign
    const signTex = TextureGenerator.createShopSign("MILMA BOOTH", "മിൽമ ബൂത്ത്", "#0284c7");
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.3), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 2.4, 1.8);
    group.add(sign);

    return group;
  }

  createKeralaBusShelter(x, y, z, stopName) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Curved green roof canopy
    const roofCurve = new THREE.CylinderGeometry(3.5, 3.5, 7.5, 12, 1, false, 0, Math.PI);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
    const canopy = new THREE.Mesh(roofCurve, canopyMat);
    canopy.rotation.z = Math.PI / 2;
    canopy.position.set(0, 3.2, 0);
    group.add(canopy);

    // Steel support frame & passenger bench
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 0.6), frameMat);
    bench.position.set(0, 0.45, 0);
    group.add(bench);

    // Back advertising board
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.8, 0.1), boardMat);
    board.position.set(0, 1.8, -1.2);
    group.add(board);

    return group;
  }

  createHighwayBillboard(title, sub, bgColor, textColor, pos, rotY) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    // Steel pillar
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 12), steelMat);
    pillar.position.y = 6;
    group.add(pillar);

    // Canvas texture for billboard ad
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = textColor;
    ctx.font = '900 78px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 512, 220);

    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(sub, 512, 330);

    const tex = new THREE.CanvasTexture(canvas);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.position.set(0, 13, 0.3);
    group.add(board);

    return group;
  }

  update(delta) {
    // Animate water subtle surface ripples
    this.waterTime += delta * 1.2;
    if (this.waterMesh) {
      this.waterMesh.position.y = -0.4 + Math.sin(this.waterTime) * 0.04;
    }
  }
}


// ==================== src/entities/PlayerController.js ====================

/**
 * PlayerController.js
 * High-fidelity GTA-style character controller inspired by Franklin Clinton (GTA V).
 * Features:
 * - Franklin aesthetic: Buzzcut, facial features, layered navy workshirt with white undersleeves, watch, jeans, sneakers
 * - Multiple switchable aesthetic outfits (Franklin Classic, Kochi Floral Linen, Street Hoodie, Kerala Kasavu)
 * - Full locomotion: Walking, sprinting, jumping, landing recoil, head look
 * - Mobile virtual controls support
 */
class PlayerController {
  constructor(scene, cameraController, audioManager) {
    this.scene = scene;
    this.cameraController = cameraController;
    this.audioManager = audioManager;

    this.mesh = null;
    this.limbs = {};
    this.materials = {};

    // Locomotion state
    this.position = new THREE.Vector3(0, 0, 340);
    this.velocity = new THREE.Vector3();
    this.targetRotation = 0;
    this.currentRotation = 0;

    this.walkSpeed = 4.4;
    this.runSpeed = 9.0;
    this.jumpForce = 8.2;
    this.gravity = -24.0;

    this.isGrounded = true;
    this.isMoving = false;
    this.isRunning = false;
    this.isJumping = false;

    this.animTime = 0;
    this.footstepTimer = 0;
    this.isActive = true;

    // Outfits
    this.currentOutfit = 'franklinClassic';

    this.initModel();
  }

  initModel() {
    this.mesh = new THREE.Group();
    this.mesh.name = "PlayerCharacter";
    this.mesh.position.copy(this.position);

    // 1. Materials setup (customizable per outfit)
    // Franklin's warm brown skin tone
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x8a5233,
      roughness: 0.6,
      metalness: 0.05
    });
    this.materials.skin = skinMat;

    // Dark buzzcut fade hair
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.95
    });
    this.materials.hair = hairMat;

    // Franklin's signature Navy Button-up Workshirt
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x22374e, // Deep navy blue
      roughness: 0.55
    });
    this.materials.shirt = shirtMat;

    // White Long Thermal Undersleeve
    const undersleeveMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.6
    });
    this.materials.undersleeve = undersleeveMat;

    // Blue Denim Jeans
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x253852,
      roughness: 0.7
    });
    this.materials.pants = pantsMat;

    // Sneakers (White & Black trim)
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    this.materials.shoe = shoeMat;

    // Watch / Belt metal
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.2 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });

    // 2. Head Hierarchy (Sculpted Franklin features)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.82;

    // Head base (jaw and skull)
    const headGeo = new THREE.BoxGeometry(0.32, 0.36, 0.34);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.16;
    head.castShadow = true;
    headGroup.add(head);

    // Chiseled jaw / chin
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.18), skinMat);
    chin.position.set(0, 0.04, -0.1);
    headGroup.add(chin);

    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), skinMat);
    nose.position.set(0, 0.16, -0.19);
    headGroup.add(nose);

    // Ears
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), skinMat);
    earL.position.set(-0.18, 0.16, 0);
    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), skinMat);
    earR.position.set(0.18, 0.16, 0);
    headGroup.add(earL, earR);

    // Buzzcut Hair (Fade texture on sides, top volume)
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.14, 0.35), hairMat);
    hairTop.position.set(0, 0.32, 0);
    headGroup.add(hairTop);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), skinMat);
    neck.position.y = 0.02;
    headGroup.add(neck);

    this.mesh.add(headGroup);
    this.limbs.head = headGroup;

    // 3. Torso & Shirt Hierarchy
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.35;

    // Main Torso / Workshirt
    const chestGeo = new THREE.BoxGeometry(0.66, 0.72, 0.38);
    const chest = new THREE.Mesh(chestGeo, shirtMat);
    chest.castShadow = true;
    torsoGroup.add(chest);

    // Shirt Collar flaps
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), shirtMat);
    collarL.position.set(-0.16, 0.38, -0.18);
    collarL.rotation.z = -0.3;
    const collarR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), shirtMat);
    collarR.position.set(0.16, 0.38, -0.18);
    collarR.rotation.z = 0.3;
    torsoGroup.add(collarL, collarR);

    // Chest Pockets (Signature workshirt detail)
    const pocketGeo = new THREE.BoxGeometry(0.16, 0.16, 0.03);
    const pL = new THREE.Mesh(pocketGeo, shirtMat);
    pL.position.set(-0.18, 0.12, -0.2);
    const pR = new THREE.Mesh(pocketGeo, shirtMat);
    pR.position.set(0.18, 0.12, -0.2);
    torsoGroup.add(pL, pR);

    // White Undershirt visible at open neck
    const undershirtNeck = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), undersleeveMat);
    undershirtNeck.position.set(0, 0.28, -0.201);
    torsoGroup.add(undershirtNeck);

    this.mesh.add(torsoGroup);
    this.limbs.torso = torsoGroup;

    // 4. Pelvis & Belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.34), pantsMat);
    pelvis.position.y = 0.92;
    this.mesh.add(pelvis);
    this.limbs.pelvis = pelvis;

    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.36), beltMat);
    belt.position.y = 1.0;
    this.mesh.add(belt);

    // Belt Buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.04), metalMat);
    buckle.position.set(0, 1.0, -0.19);
    this.mesh.add(buckle);

    // 5. Left Arm: Navy Short Sleeve + White Undersleeve + Wristwatch
    const lShoulder = new THREE.Group();
    lShoulder.position.set(-0.42, 1.62, 0);

    // Upper Arm: Short workshirt sleeve
    const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.2), shirtMat);
    lUpperArm.position.y = -0.18;
    lUpperArm.castShadow = true;
    lShoulder.add(lUpperArm);

    // Forearm: White Long Undersleeve
    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), undersleeveMat);
    lForearm.position.y = -0.52;
    lForearm.castShadow = true;
    lShoulder.add(lForearm);

    // Left Hand
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), skinMat);
    lHand.position.y = -0.78;
    lShoulder.add(lHand);

    // Silver Wristwatch on Left Wrist
    const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), metalMat);
    watch.position.set(0, -0.71, 0);
    lShoulder.add(watch);

    this.mesh.add(lShoulder);
    this.limbs.lArm = lShoulder;

    // 6. Right Arm: Navy Short Sleeve + White Undersleeve + Hand
    const rShoulder = new THREE.Group();
    rShoulder.position.set(0.42, 1.62, 0);

    const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.2), shirtMat);
    rUpperArm.position.y = -0.18;
    rUpperArm.castShadow = true;
    rShoulder.add(rUpperArm);

    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), undersleeveMat);
    rForearm.position.y = -0.52;
    rForearm.castShadow = true;
    rShoulder.add(rForearm);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), skinMat);
    rHand.position.y = -0.78;
    rShoulder.add(rHand);

    this.mesh.add(rShoulder);
    this.limbs.rArm = rShoulder;

    // 7. Left Leg: Jeans + Sneaker
    const lHip = new THREE.Group();
    lHip.position.set(-0.17, 0.92, 0);

    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.25), pantsMat);
    lLeg.position.y = -0.41;
    lLeg.castShadow = true;
    lHip.add(lLeg);

    // Sneaker upper
    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.38), shoeMat);
    lShoe.position.set(0, -0.86, -0.05);
    lShoe.castShadow = true;
    lHip.add(lShoe);

    // Sneaker thick rubber sole
    const lSole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.4), soleMat);
    lSole.position.set(0, -0.93, -0.05);
    lHip.add(lSole);

    this.mesh.add(lHip);
    this.limbs.lLeg = lHip;

    // 8. Right Leg: Jeans + Sneaker
    const rHip = new THREE.Group();
    rHip.position.set(0.17, 0.92, 0);

    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.25), pantsMat);
    rLeg.position.y = -0.41;
    rLeg.castShadow = true;
    rHip.add(rLeg);

    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.38), shoeMat);
    rShoe.position.set(0, -0.86, -0.05);
    rShoe.castShadow = true;
    rHip.add(rShoe);

    const rSole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.4), soleMat);
    rSole.position.set(0, -0.93, -0.05);
    rHip.add(rSole);

    this.mesh.add(rHip);
    this.limbs.rLeg = rHip;

    this.scene.add(this.mesh);
    this.cameraController.setTarget(this.mesh, 'player');
  }

  setOutfit(outfitId) {
    this.currentOutfit = outfitId;

    if (outfitId === 'franklinClassic') {
      // Signature Franklin Clinton: Navy Workshirt + White Undersleeve + Dark Jeans
      this.materials.shirt.color.setHex(0x22374e);
      this.materials.undersleeve.color.setHex(0xf1f5f9);
      this.materials.pants.color.setHex(0x253852);
      this.materials.shoe.color.setHex(0xf8fafc);

    } else if (outfitId === 'kochiLinen') {
      // Kerala Aesthetic Floral / Pastel Linen Vacation Shirt
      this.materials.shirt.color.setHex(0x14b8a6); // Emerald Teal Linen
      this.materials.undersleeve.color.setHex(0xfef08a); // Pale Gold undersleeve
      this.materials.pants.color.setHex(0xd6d3d1); // Sand Khaki Chinos
      this.materials.shoe.color.setHex(0x78350f); // Leather loafers

    } else if (outfitId === 'blackLeather') {
      // GTA Street Biker / Midnight Racer
      this.materials.shirt.color.setHex(0x18181b); // Black leather
      this.materials.undersleeve.color.setHex(0x3f3f46); // Charcoal undersleeve
      this.materials.pants.color.setHex(0x09090b); // Black denim
      this.materials.shoe.color.setHex(0xdc2626); // Red sneakers

    } else if (outfitId === 'kasavuMundu') {
      // Authentic Kerala Kasavu Silk Style
      this.materials.shirt.color.setHex(0x0f172a); // Silk black shirt
      this.materials.undersleeve.color.setHex(0x0f172a);
      this.materials.pants.color.setHex(0xfef9c3); // Off-white Kasavu cream
      this.materials.shoe.color.setHex(0xd97706); // Kolhapuri tan footwear
    }
  }

  update(delta, inputManager, colliders = []) {
    if (!this.isActive) return;

    // Movement inputs (keyboard or mobile joystick)
    const camYaw = this.cameraController.getYaw();
    const moveX = inputManager.getMoveX();
    const moveZ = inputManager.getMoveZ();

    const inputLength = Math.hypot(moveX, moveZ);
    this.isMoving = inputLength > 0.08;
    this.isRunning = this.isMoving && inputManager.isSprinting();

    const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;

    if (this.isMoving) {
      const inputAngle = Math.atan2(moveX, moveZ);
      this.targetRotation = camYaw + inputAngle + Math.PI;

      const forward = new THREE.Vector3(Math.sin(camYaw + inputAngle), 0, Math.cos(camYaw + inputAngle)).normalize();
      this.velocity.x = forward.x * currentSpeed;
      this.velocity.z = forward.z * currentSpeed;
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * 14);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * 14);
    }

    // Jumping & Gravity
    if (this.isGrounded) {
      if (inputManager.keys.jump || inputManager.consumeAction('jump')) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        this.isJumping = true;
        this.audioManager?.playActionClick();
      }
    } else {
      this.velocity.y += this.gravity * delta;
    }

    // Apply displacement with collision check
    const nextPos = this.position.clone().addScaledVector(this.velocity, delta);

    const playerRadius = 0.55;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(nextPos.x - playerRadius, nextPos.y, nextPos.z - playerRadius),
      new THREE.Vector3(nextPos.x + playerRadius, nextPos.y + 2.0, nextPos.z + playerRadius)
    );

    let collides = false;
    for (const col of colliders) {
      if (col.intersectsBox(playerBox)) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      this.position.x = nextPos.x;
      this.position.z = nextPos.z;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    this.position.y += this.velocity.y * delta;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.isJumping = false;
    }

    // Smooth character turning
    if (this.isMoving) {
      let diff = this.targetRotation - this.currentRotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.currentRotation += diff * Math.min(delta * 14, 1.0);
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.currentRotation;

    // Animation updates
    this.updateAnimation(delta);

    // Footsteps SFX
    if (this.isMoving && this.isGrounded) {
      this.footstepTimer += delta * (this.isRunning ? 2.9 : 1.9);
      if (this.footstepTimer > 1.0) {
        this.audioManager?.playFootstep(this.isRunning);
        this.footstepTimer = 0;
      }
    }
  }

  updateAnimation(delta) {
    if (this.isJumping) {
      this.limbs.lLeg.rotation.x = -0.42;
      this.limbs.rLeg.rotation.x = 0.36;
      this.limbs.lArm.rotation.x = -0.85;
      this.limbs.rArm.rotation.x = -0.85;
      this.limbs.torso.rotation.x = 0.16;
      return;
    }

    if (this.isMoving) {
      const animSpeed = this.isRunning ? 14.5 : 8.5;
      this.animTime += delta * animSpeed;

      const swing = Math.sin(this.animTime);
      const armSwingMag = this.isRunning ? 1.0 : 0.6;
      const legSwingMag = this.isRunning ? 0.9 : 0.55;

      this.limbs.lLeg.rotation.x = swing * legSwingMag;
      this.limbs.rLeg.rotation.x = -swing * legSwingMag;
      this.limbs.lArm.rotation.x = -swing * armSwingMag;
      this.limbs.rArm.rotation.x = swing * armSwingMag;

      this.limbs.torso.rotation.x = this.isRunning ? 0.2 : 0.06;
      this.limbs.torso.position.y = 1.35 + Math.abs(Math.sin(this.animTime * 2)) * 0.05;
      this.limbs.head.position.y = 1.82 + Math.abs(Math.sin(this.animTime * 2)) * 0.04;

    } else {
      this.animTime += delta * 2.2;
      const breath = Math.sin(this.animTime) * 0.025;

      this.limbs.lLeg.rotation.x = THREE.MathUtils.lerp(this.limbs.lLeg.rotation.x, 0, delta * 8);
      this.limbs.rLeg.rotation.x = THREE.MathUtils.lerp(this.limbs.rLeg.rotation.x, 0, delta * 8);
      this.limbs.lArm.rotation.x = THREE.MathUtils.lerp(this.limbs.lArm.rotation.x, 0, delta * 8);
      this.limbs.rArm.rotation.x = THREE.MathUtils.lerp(this.limbs.rArm.rotation.x, 0, delta * 8);

      this.limbs.torso.rotation.x = 0;
      this.limbs.torso.position.y = 1.35 + breath;
      this.limbs.head.position.y = 1.82 + breath * 0.8;
    }
  }

  setActive(active) {
    this.isActive = active;
    this.mesh.visible = active;
  }

  teleport(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.mesh.position.copy(pos);
  }
}


// ==================== src/entities/VehicleController.js ====================


/**
 * VehicleController.js
 * GTA V style arcade drivable car with progressive acceleration, speed-dependent steering,
 * body roll physics, steerable wheels, brake lights, tire skid, and audio engine integration.
 */
class VehicleController {
  constructor(scene, cameraController, audioManager, initialPos = new THREE.Vector3(4, 0, 330)) {
    this.scene = scene;
    this.cameraController = cameraController;
    this.audioManager = audioManager;

    this.mesh = null;
    this.frontWheels = [];
    this.allWheels = [];
    this.brakeLights = [];
    this.headlights = [];

    // Vehicle physics state
    this.position = initialPos.clone();
    this.rotationY = 0;
    this.speed = 0; // m/s
    this.acceleration = 12.0; // m/s^2
    this.maxSpeed = 38.0; // ~137 km/h
    this.reverseMaxSpeed = -10.0; // ~36 km/h
    this.brakeForce = 22.0;
    this.dragCoeff = 0.85; // Natural rolling resistance
    this.steerAngle = 0;
    this.maxSteerAngle = 0.58; // radians (~33 deg)

    // Body roll / suspension pitch
    this.chassisMesh = null;
    this.bodyRoll = 0;
    this.bodyPitch = 0;

    // Drifting & skid
    this.isDrifting = false;
    this.driftIntensity = 0;

    this.isDrivenByPlayer = false;

    this.initModel();
  }

  initModel() {
    this.mesh = new THREE.Group();
    this.mesh.name = "DrivableCar";
    this.mesh.position.copy(this.position);

    // Chassis Group (for suspension pitch and roll)
    this.chassisMesh = new THREE.Group();
    this.mesh.add(this.chassisMesh);

    // Main Car Body (Kerala White Metallic finish)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.25
    });

    // Lower Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
    lowerBody.position.y = 0.65;
    lowerBody.castShadow = true;
    this.chassisMesh.add(lowerBody);

    // Cabin / Roof
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.7, 2.4);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 1.32, -0.2);
    cabin.castShadow = true;
    this.chassisMesh.add(cabin);

    // Windshield & Windows (Glossy tinted glass)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 0.95
    });

    // Front Windshield (sloped)
    const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.85), glassMat);
    frontWindshield.position.set(0, 1.25, -1.45);
    frontWindshield.rotation.x = -Math.PI / 3.2;
    this.chassisMesh.add(frontWindshield);

    // Rear Windshield
    const rearWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.75), glassMat);
    rearWindshield.position.set(0, 1.28, 1.05);
    rearWindshield.rotation.x = Math.PI / 3.4;
    this.chassisMesh.add(rearWindshield);

    // Side Windows
    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 2.2), glassMat);
    sideWinL.position.set(-0.91, 1.3, -0.2);
    const sideWinR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 2.2), glassMat);
    sideWinR.position.set(0.91, 1.3, -0.2);
    this.chassisMesh.add(sideWinL, sideWinR);

    // Front Grille & Kerala Number Plate
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.1), grilleMat);
    grille.position.set(0, 0.65, -2.22);
    this.chassisMesh.add(grille);

    const plateTex = TextureGenerator.createNumberPlate("KL 07 CD 2024");
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });

    const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), plateMat);
    frontPlate.position.set(0, 0.45, -2.23);
    frontPlate.rotation.y = Math.PI;
    this.chassisMesh.add(frontPlate);

    const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), plateMat);
    rearPlate.position.set(0, 0.55, 2.22);
    this.chassisMesh.add(rearPlate);

    // Headlights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
    hL.position.set(-0.75, 0.72, -2.22);
    const hR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
    hR.position.set(0.75, 0.72, -2.22);
    this.chassisMesh.add(hL, hR);
    this.headlights.push(hL, hR);

    // Brake Lights (Glowing Red)
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.3
    });
    const bL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), brakeMat);
    bL.position.set(-0.75, 0.75, 2.22);
    const bR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), brakeMat);
    bR.position.set(0.75, 0.75, 2.22);
    this.chassisMesh.add(bL, bR);
    this.brakeLights.push(bL, bR);

    // 4 Alloy Wheels with Rubber Tires
    const wheelPositions = [
      { x: -1.02, y: 0.36, z: -1.35, isFront: true },  // Front-Left
      { x: 1.02, y: 0.36, z: -1.35, isFront: true },   // Front-Right
      { x: -1.02, y: 0.36, z: 1.35, isFront: false },  // Rear-Left
      { x: 1.02, y: 0.36, z: 1.35, isFront: false }    // Rear-Right
    ];

    wheelPositions.forEach(wp => {
      const wheelMount = new THREE.Group();
      wheelMount.position.set(wp.x, wp.y, wp.z);

      const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
      const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 8);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.2 });

      const wheelMesh = new THREE.Mesh(tireGeo, tireMat);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;

      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.rotation.z = Math.PI / 2;

      const wheelSpinGroup = new THREE.Group();
      wheelSpinGroup.add(wheelMesh, rimMesh);
      wheelMount.add(wheelSpinGroup);

      this.mesh.add(wheelMount);
      this.allWheels.push(wheelSpinGroup);

      if (wp.isFront) {
        this.frontWheels.push(wheelMount);
      }
    });

    this.scene.add(this.mesh);
  }

  update(delta, inputManager, colliders = []) {
    if (!this.isDrivenByPlayer) {
      // Passive vehicle friction if rolling
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 3.0);
      this.mesh.userData.speed = this.speed;
      return;
    }

    const moveZ = inputManager.getMoveZ();
    const moveX = inputManager.getMoveX();
    const isAccelerating = inputManager.keys.forward || moveZ < -0.15;
    const isBraking = inputManager.keys.backward || moveZ > 0.15;
    const isHandbraking = inputManager.keys.handbrake;

    // 1. Acceleration & Progressive Speed
    if (isAccelerating) {
      if (this.speed < 0) {
        // Braking while in reverse
        this.speed += this.brakeForce * delta;
      } else {
        // Progressive acceleration curve
        const speedRatio = Math.max(0, this.speed / this.maxSpeed);
        const effectiveAccel = this.acceleration * (1.0 - speedRatio * 0.45);
        this.speed = Math.min(this.speed + effectiveAccel * delta, this.maxSpeed);
      }
    } else if (isBraking) {
      if (this.speed > 0.5) {
        // Active braking
        this.speed = Math.max(this.speed - this.brakeForce * delta, 0);
      } else {
        // Reverse gear
        this.speed = Math.max(this.speed - (this.acceleration * 0.6) * delta, this.reverseMaxSpeed);
      }
    } else {
      // Drag & friction
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * this.dragCoeff);
    }

    // 2. Handbrake & Drifting
    if (isHandbraking && Math.abs(this.speed) > 4) {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 2.2);
      this.isDrifting = true;
      this.driftIntensity = THREE.MathUtils.lerp(this.driftIntensity, 1.0, delta * 8);
    } else {
      this.isDrifting = false;
      this.driftIntensity = THREE.MathUtils.lerp(this.driftIntensity, 0, delta * 4);
    }
    this.audioManager?.setTireSkid(this.driftIntensity);

    // 3. Speed-dependent Steering
    // Steer angle is larger at low speed, tighter and stable at high speed
    const speedKmh = Math.abs(this.speed) * 3.6;
    const steerFactor = 1.0 - THREE.MathUtils.clamp(speedKmh / 120, 0, 0.65);
    let targetSteer = 0;
    if (Math.abs(moveX) > 0.08) {
      targetSteer = -moveX * this.maxSteerAngle * steerFactor;
    } else {
      if (inputManager.keys.left) targetSteer += this.maxSteerAngle * steerFactor;
      if (inputManager.keys.right) targetSteer -= this.maxSteerAngle * steerFactor;
    }

    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * 12);

    // Visually turn front wheels
    this.frontWheels.forEach(w => {
      w.rotation.y = this.steerAngle;
    });

    // Rotate car heading if moving
    if (Math.abs(this.speed) > 0.2) {
      const turnMultiplier = (this.isDrifting ? 1.6 : 1.0);
      const angularVelocity = (this.speed / 2.7) * Math.sin(this.steerAngle) * turnMultiplier;
      this.rotationY += angularVelocity * delta;
    }

    // 4. Update Position with World Collision
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    const nextPos = this.position.clone().addScaledVector(forwardVec, this.speed * delta);

    // Collision check against world
    const carBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(nextPos.x, nextPos.y + 0.8, nextPos.z),
      new THREE.Vector3(2.3, 1.6, 4.6)
    );

    let collides = false;
    for (const col of colliders) {
      if (col.intersectsBox(carBox)) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      this.position.copy(nextPos);
    } else {
      // Elastic bounce off obstacle
      this.speed = -this.speed * 0.35;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
    this.mesh.userData.speed = this.speed;

    // 5. Spin wheels relative to vehicle speed
    const wheelCircumference = 2 * Math.PI * 0.36;
    const wheelRotDelta = (this.speed * delta / wheelCircumference) * (Math.PI * 2);
    this.allWheels.forEach(w => {
      w.rotation.x -= wheelRotDelta;
    });

    // 6. Body Roll & Pitch (suspension dynamics)
    const targetPitch = (isAccelerating ? -0.04 : 0) + (isBraking ? 0.08 : 0);
    const targetRoll = -this.steerAngle * (this.speed / this.maxSpeed) * 0.18;
    this.bodyPitch = THREE.MathUtils.lerp(this.bodyPitch, targetPitch, delta * 8);
    this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, targetRoll, delta * 8);
    this.chassisMesh.rotation.x = this.bodyPitch;
    this.chassisMesh.rotation.z = this.bodyRoll;

    // 7. Brake Lights Glow
    const isBrakingActive = (isBraking && this.speed > 0) || isHandbraking;
    this.brakeLights.forEach(bl => {
      bl.material.emissiveIntensity = isBrakingActive ? 1.5 : 0.2;
    });

    // 8. Vehicle Horn (Key H)
    if (inputManager.consumeAction('horn')) {
      this.audioManager?.playHorn();
    }

    // 9. Reset Vehicle (Key R)
    if (inputManager.consumeAction('resetVehicle')) {
      this.position.y = 0;
      this.speed = 0;
      this.rotationY = 0;
    }

    // 10. Update synthesized engine sound
    const rpm = Math.min(1.0, 0.2 + (speedKmh / 140) * 0.8 + (isAccelerating ? 0.25 : 0));
    this.audioManager?.updateCarEngine(rpm, speedKmh, true);
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  getGear() {
    if (this.speed < -0.5) return 'R';
    const kmh = this.getSpeedKmh();
    if (kmh < 2) return '1';
    if (kmh < 35) return '2';
    if (kmh < 65) return '3';
    if (kmh < 95) return '4';
    return '5';
  }

  setDriven(isDriven) {
    this.isDrivenByPlayer = isDriven;
    if (!isDriven) {
      this.audioManager?.updateCarEngine(0, 0, false);
      this.audioManager?.setTireSkid(0);
    }
  }

  getExitPosition() {
    // Left side door (driver's side in India / RHD or exit near curb)
    const exitOffset = new THREE.Vector3(-1.8, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    return this.position.clone().add(exitOffset);
  }
}


// ==================== src/entities/MotorcycleController.js ====================

/**
 * MotorcycleController.js
 * Rideable Kerala Royal Enfield style motorcycle with lean physics and thumping audio.
 */
class MotorcycleController {
  constructor(scene, cameraController, audioManager, initialPos = new THREE.Vector3(38, 0, 298)) {
    this.scene = scene;
    this.cameraController = cameraController;
    this.audioManager = audioManager;

    this.mesh = null;
    this.handlebars = null;
    this.wheels = [];
    this.riderProxy = null;

    this.position = initialPos.clone();
    this.rotationY = 0;
    this.speed = 0;
    this.acceleration = 16.0;
    this.maxSpeed = 34.0; // ~122 km/h
    this.brakeForce = 24.0;
    this.steerAngle = 0;
    this.leanAngle = 0;

    this.isRiddenByPlayer = false;

    this.initModel();
  }

  initModel() {
    this.mesh = new THREE.Group();
    this.mesh.name = "RideableMotorcycle";
    this.mesh.position.copy(this.position);

    // Motorcycle Frame & Engine (Dark Metallic / Chrome)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x14532d, metalness: 0.5, roughness: 0.2 }); // British Racing / Kerala Bullet Green

    // Main backbone frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.8), frameMat);
    frame.position.y = 0.65;
    this.mesh.add(frame);

    // Engine Block
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.65), chromeMat);
    engine.position.set(0, 0.45, 0.05);
    this.mesh.add(engine);

    // Exhaust Pipe
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0.25, 0.3, 0.5);
    this.mesh.add(pipe);

    // Classic Teardrop Fuel Tank
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.35, 0.8), tankMat);
    tank.position.set(0, 0.9, -0.3);
    this.mesh.add(tank);

    // Rider Seat
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.7), seatMat);
    seat.position.set(0, 0.82, 0.35);
    this.mesh.add(seat);

    // Wheels (Front & Rear spoked wheels)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);

    const fWheel = new THREE.Mesh(tireGeo, wheelMat);
    fWheel.rotation.z = Math.PI / 2;
    fWheel.position.set(0, 0.35, -1.05);
    this.mesh.add(fWheel);
    this.wheels.push(fWheel);

    const rWheel = new THREE.Mesh(tireGeo, wheelMat);
    rWheel.rotation.z = Math.PI / 2;
    rWheel.position.set(0, 0.35, 0.95);
    this.mesh.add(rWheel);
    this.wheels.push(rWheel);

    // Front Fork & Handlebars
    this.handlebars = new THREE.Group();
    this.handlebars.position.set(0, 0.95, -0.75);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), chromeMat);
    bar.rotation.z = Math.PI / 2;
    this.handlebars.add(bar);

    // Chrome Headlight
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffedd5 })
    );
    head.position.set(0, 0.05, -0.2);
    this.handlebars.add(head);

    this.mesh.add(this.handlebars);

    // Rider Avatar Proxy when mounted
    this.riderProxy = new THREE.Group();
    const riderSkin = new THREE.MeshStandardMaterial({ color: 0x935f3d });
    const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.28), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    riderTorso.position.set(0, 1.25, 0.25);
    const riderHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), riderSkin);
    riderHead.position.set(0, 1.68, 0.22);
    this.riderProxy.add(riderTorso, riderHead);
    this.riderProxy.visible = false;
    this.mesh.add(this.riderProxy);

    this.scene.add(this.mesh);
  }

  update(delta, inputManager, colliders = []) {
    if (!this.isRiddenByPlayer) {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 3);
      this.mesh.userData.speed = this.speed;
      return;
    }

    const moveZ = inputManager.getMoveZ();
    const moveX = inputManager.getMoveX();

    if (inputManager.keys.forward || moveZ < -0.15) {
      this.speed = Math.min(this.speed + this.acceleration * delta, this.maxSpeed);
    } else if (inputManager.keys.backward || moveZ > 0.15) {
      if (this.speed > 0.5) {
        this.speed = Math.max(this.speed - this.brakeForce * delta, 0);
      } else {
        this.speed = Math.max(this.speed - 4 * delta, -5);
      }
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 1.2);
    }

    // Steering
    let targetSteer = 0;
    if (Math.abs(moveX) > 0.08) {
      targetSteer = -moveX * 0.5;
    } else {
      if (inputManager.keys.left) targetSteer += 0.5;
      if (inputManager.keys.right) targetSteer -= 0.5;
    }
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * 14);

    if (this.handlebars) {
      this.handlebars.rotation.y = this.steerAngle;
    }

    if (Math.abs(this.speed) > 0.3) {
      this.rotationY += (this.speed / 2.2) * Math.sin(this.steerAngle) * delta;
    }

    // Motorcycle Banking / Lean
    const targetLean = this.steerAngle * (this.speed / this.maxSpeed) * 0.75;
    this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, targetLean, delta * 10);
    this.mesh.rotation.z = this.leanAngle;

    // Movement
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    const nextPos = this.position.clone().addScaledVector(forward, this.speed * delta);

    // Collision check
    const bikeBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(nextPos.x, nextPos.y + 0.6, nextPos.z),
      new THREE.Vector3(1.2, 1.2, 2.4)
    );

    let collides = false;
    for (const col of colliders) {
      if (col.intersectsBox(bikeBox)) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      this.position.copy(nextPos);
    } else {
      this.speed = -this.speed * 0.2;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
    this.mesh.userData.speed = this.speed;

    // Spin wheels
    const wheelRot = (this.speed * delta / (2 * Math.PI * 0.35)) * (Math.PI * 2);
    this.wheels.forEach(w => w.rotation.x -= wheelRot);

    // Audio thumping
    const rpm = Math.min(1.0, 0.25 + (Math.abs(this.speed) / this.maxSpeed) * 0.75);
    this.audioManager?.updateBikeEngine(rpm, Math.abs(this.speed) * 3.6, true);
  }

  setRidden(ridden) {
    this.isRiddenByPlayer = ridden;
    this.riderProxy.visible = ridden;
    if (!ridden) {
      this.audioManager?.updateBikeEngine(0, 0, false);
      this.mesh.rotation.z = 0;
    }
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  getExitPosition() {
    const exitOffset = new THREE.Vector3(-1.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    return this.position.clone().add(exitOffset);
  }
}


// ==================== src/entities/TrafficSystem.js ====================

/**
 * TrafficSystem.js
 * Left-hand Indian traffic simulation featuring Auto Rickshaws, KSRTC buses,
 * private buses, sedans, and motorbikes with waypoint lane following and vehicle pooling.
 */
class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];

    // Left-Hand Traffic Lanes:
    // Lane 1: Heading North (-Z) on West side: X = -4.8
    // Lane 2: Heading South (+Z) on East side: X = +4.8
    // Lane 3: Flyover North: X = -3.2, Y = 7.5
    // Lane 4: Flyover South: X = +3.2, Y = 7.5
    this.initTrafficFleet();
  }

  initTrafficFleet() {
    const fleetDefinitions = [
      { type: 'autorickshaw', count: 6 },
      { type: 'ksrtcBus', count: 3 },
      { type: 'privateBus', count: 2 },
      { type: 'car', count: 9 },
      { type: 'bike', count: 5 }
    ];

    fleetDefinitions.forEach(def => {
      for (let i = 0; i < def.count; i++) {
        const vehicle = this.createTrafficVehicle(def.type);
        this.resetVehiclePosition(vehicle, Math.random() * 800 - 400);
        this.scene.add(vehicle.mesh);
        this.vehicles.push(vehicle);
      }
    });
  }

  createTrafficVehicle(type) {
    const mesh = new THREE.Group();
    const wheels = [];

    let speed = 9.0 + Math.random() * 4.0; // ~32 to 46 km/h
    let length = 4.2;

    if (type === 'autorickshaw') {
      // Iconic Indian Auto Rickshaw (Green body, yellow canopy)
      speed = 8.5;
      length = 2.8;

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 }); // Kerala Green
      const hoodMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }); // Yellow top

      // Lower body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.6), bodyMat);
      body.position.y = 0.55;
      mesh.add(body);

      // Yellow canopy hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.85, 2.2), hoodMat);
      hood.position.set(0, 1.25, 0.1);
      mesh.add(hood);

      // Front wheel (single center wheel)
      const fWheel = this.createWheel(0.24, 0.14);
      fWheel.position.set(0, 0.24, -1.1);
      mesh.add(fWheel);
      wheels.push(fWheel);

      // Rear wheels (2 wheels)
      const rWheelL = this.createWheel(0.24, 0.14);
      rWheelL.position.set(-0.68, 0.24, 0.85);
      const rWheelR = this.createWheel(0.24, 0.14);
      rWheelR.position.set(0.68, 0.24, 0.85);
      mesh.add(rWheelL, rWheelR);
      wheels.push(rWheelL, rWheelR);

      // Single center headlight
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffedd5 }));
      head.position.set(0, 0.65, -1.32);
      mesh.add(head);

    } else if (type === 'ksrtcBus') {
      // Kerala State RTC Bus ("ആനവണ്ടി" - Red & Yellow)
      speed = 10.5;
      length = 9.8;

      const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
      const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 9.4), redMat);
      lower.position.y = 1.2;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.58, 1.3, 9.3), yellowMat);
      upper.position.y = 2.45;
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.9, 8.4), winMat);
      win.position.y = 2.25;

      mesh.add(lower, upper, win);

      // 6 Wheels
      const wPos = [[-1.2, -2.8], [1.2, -2.8], [-1.2, 2.6], [1.2, 2.6], [-1.2, 3.6], [1.2, 3.6]];
      wPos.forEach(([wx, wz]) => {
        const w = this.createWheel(0.48, 0.26);
        w.position.set(wx, 0.48, wz);
        mesh.add(w);
        wheels.push(w);
      });

    } else if (type === 'privateBus') {
      // Kerala Private Stage Carriage Bus (Cyan & Purple graphics)
      speed = 11.0;
      length = 9.5;

      const cyanMat = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.35 });
      const pinkMat = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.4 });
      const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, 9.2), cyanMat);
      lower.position.y = 1.2;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.48, 1.3, 9.1), pinkMat);
      upper.position.y = 2.45;
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.9, 8.2), winMat);
      win.position.y = 2.25;

      mesh.add(lower, upper, win);

      const wPos = [[-1.15, -2.6], [1.15, -2.6], [-1.15, 2.6], [1.15, 2.6]];
      wPos.forEach(([wx, wz]) => {
        const w = this.createWheel(0.46, 0.24);
        w.position.set(wx, 0.46, wz);
        mesh.add(w);
        wheels.push(w);
      });

    } else if (type === 'bike') {
      speed = 11.5;
      length = 2.0;

      const bikeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.6), bikeMat);
      frame.position.y = 0.55;
      mesh.add(frame);

      // Rider figure
      const riderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const rider = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.3), riderMat);
      rider.position.set(0, 1.05, 0.1);
      mesh.add(rider);

      const fW = this.createWheel(0.32, 0.1);
      fW.position.set(0, 0.32, -0.75);
      const rW = this.createWheel(0.32, 0.1);
      rW.position.set(0, 0.32, 0.75);
      mesh.add(fW, rW);
      wheels.push(fW, rW);

    } else {
      // Standard Passenger Car / Hatchback (White, Red, Silver)
      const colors = [0xf8fafc, 0xdc2626, 0x94a3b8, 0x1e293b];
      const carColor = colors[Math.floor(Math.random() * colors.length)];
      const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.3 });
      const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.2), bodyMat);
      lower.position.y = 0.55;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.62, 2.2), bodyMat);
      cabin.position.set(0, 1.15, -0.15);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.5, 2.0), winMat);
      glass.position.set(0, 1.15, -0.15);

      mesh.add(lower, cabin, glass);

      const wPos = [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]];
      wPos.forEach(([wx, wz]) => {
        const w = this.createWheel(0.34, 0.22);
        w.position.set(wx, 0.34, wz);
        mesh.add(w);
        wheels.push(w);
      });
    }

    return {
      mesh,
      wheels,
      type,
      length,
      speed,
      currentSpeed: speed,
      direction: -1, // -1 is North, +1 is South
      laneX: -4.8,
      z: 0
    };
  }

  createWheel(radius, width) {
    const geo = new THREE.CylinderGeometry(radius, radius, width, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  resetVehiclePosition(vehicle, startZ) {
    // Left-hand traffic logic:
    // Northbound goes along West lane (X = -4.8 or -6.8)
    // Southbound goes along East lane (X = +4.8 or +6.8)
    const isNorthbound = Math.random() > 0.5;
    vehicle.direction = isNorthbound ? -1 : 1;
    vehicle.laneX = isNorthbound ? -(3.5 + Math.random() * 3.2) : (3.5 + Math.random() * 3.2);
    vehicle.z = startZ;
    vehicle.mesh.position.set(vehicle.laneX, 0, vehicle.z);
    vehicle.mesh.rotation.y = isNorthbound ? 0 : Math.PI;
  }

  update(delta) {
    const totalVehicles = this.vehicles.length;

    for (let i = 0; i < totalVehicles; i++) {
      const v = this.vehicles[i];

      // Distance checking: Check if another vehicle in the same lane is ahead
      let isBlocked = false;
      for (let j = 0; j < totalVehicles; j++) {
        if (i === j) continue;
        const other = this.vehicles[j];
        if (other.direction === v.direction && Math.abs(other.laneX - v.laneX) < 2.0) {
          const distZ = (other.z - v.z) * v.direction;
          if (distZ > 0 && distZ < v.length + 5.0) {
            isBlocked = true;
            break;
          }
        }
      }

      // Decelerate if blocked, otherwise resume target speed
      const targetSpeed = isBlocked ? 0 : v.speed;
      v.currentSpeed = THREE.MathUtils.lerp(v.currentSpeed, targetSpeed, delta * 3.0);

      // Advance along road
      v.z += v.currentSpeed * v.direction * delta;

      // Recycle at highway bounds (-440 to +440)
      if (v.direction === -1 && v.z < -440) {
        this.resetVehiclePosition(v, 430);
      } else if (v.direction === 1 && v.z > 440) {
        this.resetVehiclePosition(v, -430);
      }

      v.mesh.position.set(v.laneX, 0, v.z);

      // Rotate wheels
      const rotDelta = (v.currentSpeed * delta / 0.7) * Math.PI;
      v.wheels.forEach(w => w.rotation.x -= rotDelta);
    }
  }
}


// ==================== src/entities/PedestrianSystem.js ====================

/**
 * PedestrianSystem.js
 * Manages walking Kerala pedestrian NPCs on sidewalks and landmark plazas.
 */
class PedestrianSystem {
  constructor(scene) {
    this.scene = scene;
    this.pedestrians = [];

    this.initPedestrians();
  }

  initPedestrians() {
    const totalCount = 24;

    for (let i = 0; i < totalCount; i++) {
      const isMundu = Math.random() > 0.5; // Traditional Kerala mundu attire
      const ped = this.createPedestrianModel(isMundu);

      // Random starting position on sidewalks or mall courtyards
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (12.2 + Math.random() * 2.5);
      const z = Math.random() * 700 - 350;

      ped.position.set(x, 0, z);
      this.scene.add(ped);

      this.pedestrians.push({
        mesh: ped,
        x,
        z,
        direction: Math.random() > 0.5 ? 1 : -1,
        speed: 1.2 + Math.random() * 0.7,
        walkTime: Math.random() * 10,
        limbs: ped.userData.limbs,
        idleTimer: 0
      });
    }
  }

  createPedestrianModel(isMundu) {
    const group = new THREE.Group();
    const limbs = {};

    const skinColors = [0x8d5524, 0x935f3d, 0x6e3c1b];
    const shirtColors = [0xffffff, 0x1e3a8a, 0x047857, 0xb91c1c, 0xd97706];

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColors[Math.floor(Math.random() * skinColors.length)],
      roughness: 0.7
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColors[Math.floor(Math.random() * shirtColors.length)],
      roughness: 0.6
    });
    const lowerMat = new THREE.MeshStandardMaterial({
      color: isMundu ? 0xf8fafc : 0x334155, // White mundu or dark trousers
      roughness: 0.8
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), shirtMat);
    torso.position.y = 1.35;
    group.add(torso);
    limbs.torso = torso;

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinMat);
    head.position.y = 1.82;
    group.add(head);

    // Arms
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirtMat);
    lArm.position.set(-0.32, 1.35, 0);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirtMat);
    rArm.position.set(0.32, 1.35, 0);
    group.add(lArm, rArm);
    limbs.lArm = lArm;
    limbs.rArm = rArm;

    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), lowerMat);
    lLeg.position.set(-0.14, 0.45, 0);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), lowerMat);
    rLeg.position.set(0.14, 0.45, 0);
    group.add(lLeg, rLeg);
    limbs.lLeg = lLeg;
    limbs.rLeg = rLeg;

    group.userData.limbs = limbs;
    return group;
  }

  update(delta) {
    this.pedestrians.forEach(p => {
      if (p.idleTimer > 0) {
        p.idleTimer -= delta;
        // Idle breathing
        p.limbs.torso.position.y = 1.35 + Math.sin(p.walkTime * 2) * 0.02;
        return;
      }

      // Walking forward
      p.walkTime += delta * 6;
      p.z += p.speed * p.direction * delta;

      // Animate limb swings
      const swing = Math.sin(p.walkTime);
      p.limbs.lLeg.rotation.x = swing * 0.45;
      p.limbs.rLeg.rotation.x = -swing * 0.45;
      p.limbs.lArm.rotation.x = -swing * 0.45;
      p.limbs.rArm.rotation.x = swing * 0.45;

      // Turn around at corridor boundaries
      if (p.z > 390 && p.direction === 1) {
        p.direction = -1;
        p.mesh.rotation.y = Math.PI;
      } else if (p.z < -390 && p.direction === -1) {
        p.direction = 1;
        p.mesh.rotation.y = 0;
      }

      // Random occasional idle pause
      if (Math.random() < 0.001) {
        p.idleTimer = 3.0 + Math.random() * 4.0;
      }

      p.mesh.position.set(p.x, 0, p.z);
    });
  }
}


// ==================== src/ui/MiniMap.js ====================
/**
 * MiniMap.js
 * GTA V style bottom-left radar displaying player position, heading, roads,
 * backwaters, traffic blips, and Kochi landmarks.
 */
class MiniMap {
  constructor(canvasId = 'minimap-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = canvasId;
    }
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width = 180;
    this.height = this.canvas.height = 180;
    this.radarRadius = 82;
  }

  update(playerPos, playerHeading, landmarks = [], vehicles = []) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const scale = 0.32; // world meters to radar pixels

    ctx.clearRect(0, 0, this.width, this.height);

    // Radar circular backdrop
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.radarRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Transform radar relative to player orientation
    ctx.translate(cx, cy);
    ctx.rotate(-playerHeading);

    // Draw Main NH 66 Road Corridor (Runs along Z axis)
    const relX = -playerPos.x * scale;
    const relZ = -playerPos.z * scale;

    ctx.fillStyle = '#475569';
    // NH 66
    ctx.fillRect(relX - 4, -400 * scale + relZ, 8, 900 * scale);

    // Cross roads
    // Kundannoor NH 85 (Z = +360)
    ctx.fillRect(-150 * scale + relX, (360 - playerPos.z) * scale - 3, 300 * scale, 6);
    // Vyttila SA Road (Z = +50)
    ctx.fillRect(-150 * scale + relX, (50 - playerPos.z) * scale - 4, 300 * scale, 8);
    // Kaloor Banerjee Road (Z = -180)
    ctx.fillRect(-150 * scale + relX, (-180 - playerPos.z) * scale - 3, 300 * scale, 6);
    // Edappally Cross (Z = -340)
    ctx.fillRect(-150 * scale + relX, (-340 - playerPos.z) * scale - 4, 300 * scale, 8);

    // Water channels (Kumbalam South & Kaniyampuzha East)
    ctx.fillStyle = '#0284c7';
    // Kumbalam
    ctx.fillRect(-250 * scale + relX, (440 - playerPos.z) * scale, 500 * scale, 40 * scale);
    // Kaniyampuzha
    ctx.fillRect((180 - playerPos.x) * scale, (20 - playerPos.z) * scale, 80 * scale, 90 * scale);

    // Nearby traffic vehicles (yellow dots)
    ctx.fillStyle = '#facc15';
    vehicles.forEach(v => {
      const vx = (v.mesh.position.x - playerPos.x) * scale;
      const vz = (v.mesh.position.z - playerPos.z) * scale;
      if (Math.hypot(vx, vz) < this.radarRadius) {
        ctx.beginPath();
        ctx.arc(vx, vz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Landmark Icons / Markers
    landmarks.forEach(lm => {
      const lx = (lm.pos.x - playerPos.x) * scale;
      const lz = (lm.pos.z - playerPos.z) * scale;
      if (Math.hypot(lx, lz) < this.radarRadius - 8) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(lx, lz, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    ctx.restore();

    // Radar Outer Ring & Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, this.radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Player Direction Arrow in Center
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx + 5, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // North Compass Indicator
    const northAngle = -playerHeading;
    const nx = cx + Math.sin(northAngle) * (this.radarRadius - 12);
    const ny = cy - Math.cos(northAngle) * (this.radarRadius - 12);
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }
}


// ==================== src/ui/HUD.js ====================
/**
 * HUD.js
 * Enhanced UI with:
 * - Speedometer
 * - Location Banners
 * - Radio Station Indicator & Controls
 * - Audio Settings Drawer (Master, Music, SFX sliders)
 * - Franklin Aesthetic Outfits Switcher
 * - Mobile Touch Controls (Joystick, Buttons)
 */
class HUD {
  constructor(options = {}) {
    this.onTeleport = options.onTeleport;
    this.onPresetChange = options.onPresetChange;
    this.audioManager = options.audioManager;
    this.playerController = options.playerController;

    this.currentZone = "";
    this.bannerTimeout = null;

    // DOM Elements
    this.promptEl = document.getElementById('interaction-prompt');
    this.speedometerEl = document.getElementById('speedometer');
    this.speedValEl = document.getElementById('speed-value');
    this.gearValEl = document.getElementById('gear-value');
    this.speedBarEl = document.getElementById('speed-bar-fill');
    this.locationBannerEl = document.getElementById('location-banner');
    this.locationTitleEl = document.getElementById('location-title');
    this.locationSubEl = document.getElementById('location-sub');

    // Radio
    this.radioPill = document.getElementById('radio-pill');
    this.radioTrackEl = document.getElementById('radio-track-name');

    // Settings Modal
    this.settingsModal = document.getElementById('settings-modal');

    this.initEventListeners();
  }

  initEventListeners() {
    // Teleport dropdown
    const teleportSelect = document.getElementById('teleport-select');
    if (teleportSelect) {
      teleportSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.onTeleport?.(e.target.value);
          e.target.value = "";
        }
      });
    }

    // Atmosphere presets
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.onPresetChange?.(btn.dataset.preset);
      });
    });

    // Settings Modal Toggle
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.toggleSettingsModal();
      });
    }
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        this.toggleSettingsModal(false);
      });
    }

    // Volume Sliders
    const masterSlider = document.getElementById('slider-master-vol');
    const musicSlider = document.getElementById('slider-music-vol');
    const sfxSlider = document.getElementById('slider-sfx-vol');

    if (masterSlider) {
      masterSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioManager?.setMasterVolume(val);
        document.getElementById('val-master-vol').textContent = `${Math.round(val * 100)}%`;
      });
    }
    if (musicSlider) {
      musicSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioManager?.setMusicVolume(val);
        document.getElementById('val-music-vol').textContent = `${Math.round(val * 100)}%`;
      });
    }
    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioManager?.setSfxVolume(val);
        document.getElementById('val-sfx-vol').textContent = `${Math.round(val * 100)}%`;
      });
    }

    // Radio Next Track Button
    const radioBtn = document.getElementById('radio-btn');
    if (radioBtn) {
      radioBtn.addEventListener('click', () => {
        const track = this.audioManager?.nextRadioTrack();
        this.showRadioToast(track);
      });
    }

    // Outfits Buttons
    const outfitBtns = document.querySelectorAll('.outfit-card');
    outfitBtns.forEach(card => {
      card.addEventListener('click', () => {
        outfitBtns.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const outfit = card.dataset.outfit;
        this.playerController?.setOutfit(outfit);
        this.audioManager?.playActionClick();
      });
    });
  }

  toggleSettingsModal(forceState) {
    if (!this.settingsModal) return;
    const isVisible = this.settingsModal.classList.contains('visible');
    const newState = (forceState !== undefined) ? forceState : !isVisible;
    if (newState) {
      this.settingsModal.classList.add('visible');
    } else {
      this.settingsModal.classList.remove('visible');
    }
  }

  showRadioToast(trackName) {
    if (!this.radioPill || !this.radioTrackEl) return;
    this.radioTrackEl.textContent = trackName;
    this.radioPill.classList.add('visible');
    clearTimeout(this.radioTimeout);
    this.radioTimeout = setTimeout(() => {
      this.radioPill.classList.remove('visible');
    }, 4000);
  }

  showInteractionPrompt(text) {
    if (!this.promptEl) return;
    const btnEnterMobile = document.getElementById('btn-enter-exit');

    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.style.display = 'block';
      if (btnEnterMobile) btnEnterMobile.classList.add('highlight');
    } else {
      this.promptEl.style.display = 'none';
      if (btnEnterMobile) btnEnterMobile.classList.remove('highlight');
    }
  }

  updateSpeedometer(speedKmh, gear, isVisible) {
    if (!this.speedometerEl) return;
    if (isVisible) {
      this.speedometerEl.style.display = 'flex';
      if (this.speedValEl) this.speedValEl.textContent = Math.round(speedKmh);
      if (this.gearValEl) this.gearValEl.textContent = gear;
      if (this.speedBarEl) {
        const pct = Math.min(100, (speedKmh / 140) * 100);
        this.speedBarEl.style.width = `${pct}%`;
      }
    } else {
      this.speedometerEl.style.display = 'none';
    }
  }

  checkLocationZone(pos) {
    let zone = "";
    let sub = "";

    const x = pos.x;
    const z = pos.z;

    if (z > 330 && z <= 420) {
      zone = "KUNDANNOOR JUNCTION";
      sub = "കുണ്ടന്നൂർ ജംഗ്ഷൻ  •  NH 66 / NH 85";
    } else if (z > 270 && z <= 330 && x > 15) {
      zone = "BROTOTYPE KOCHI HUB";
      sub = "ബ്രോടൈപ്പ് കൊച്ചി  •  EDATHURUTHIKARAN HOLDINGS";
    } else if (z > 190 && z <= 265 && x < -15) {
      zone = "FORUM KOCHI";
      sub = "ഫോറം മാൾ കൊച്ചി  •  MARADU BYPASS";
    } else if (z > 0 && z <= 90 && x > 70) {
      zone = "VYTTILA MOBILITY HUB";
      sub = "വൈറ്റില മൊബിലിറ്റി ഹബ്ബ്  •  WATER METRO & TERMINAL";
    } else if (z > 10 && z <= 90 && x <= 70) {
      zone = "VYTTILA JUNCTION & FLYOVER";
      sub = "വൈറ്റില ജംഗ്ഷൻ  •  KERALA'S TRANSIT HUB";
    } else if (z >= -230 && z <= -130 && x < -10) {
      zone = "JAWAHARLAL NEHRU STADIUM";
      sub = "ജവഹർലാൽ നെഹ്റു സ്റ്റേഡിയം  •  KALOOR";
    } else if (z >= -420 && z <= -310) {
      zone = "LULU INTERNATIONAL MALL";
      sub = "ലുലു മാൾ കൊച്ചി  •  EDAPPALLY JUNCTION";
    }

    if (zone && zone !== this.currentZone) {
      this.currentZone = zone;
      this.triggerLocationBanner(zone, sub);
    }
  }

  triggerLocationBanner(title, sub) {
    if (!this.locationBannerEl) return;
    this.locationTitleEl.textContent = title;
    this.locationSubEl.textContent = sub;
    this.locationBannerEl.classList.add('visible');

    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.locationBannerEl.classList.remove('visible');
    }, 4500);
  }
}


// ==================== src/main.js ====================
















class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container') || document.body;
    this.clock = new THREE.Clock();

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 1200);
    this.camera.position.set(0, 3, 345);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Systems
    this.input = new InputManager(this.renderer.domElement);
    this.audio = new AudioManager();
    this.cameraCtrl = new CameraController(this.camera, this.renderer.domElement);
    this.atmosphere = new WeatherAtmosphere(this.scene, this.renderer);
    this.world = new WorldManager(this.scene);
    this.foliage = new FoliageManager(this.scene);
    this.foliage.populateWorld();

    this.landmarks = new LandmarkManager(this.scene);
    this.landmarks.buildAllLandmarks();

    this.metro = new MetroSystem(this.scene, this.audio);

    // Entities
    this.player = new PlayerController(this.scene, this.cameraCtrl, this.audio);
    // Spawns drivable white Kerala car right in front of Kundannoor Junction
    this.car = new VehicleController(this.scene, this.cameraCtrl, this.audio, new THREE.Vector3(4, 0, 335));
    // Spawns rideable Royal Enfield motorcycle near Brototype Hub
    this.bike = new MotorcycleController(this.scene, this.cameraCtrl, this.audio, new THREE.Vector3(36, 0, 305));

    this.traffic = new TrafficSystem(this.scene);
    this.pedestrians = new PedestrianSystem(this.scene);

    // Active mode: 'foot' | 'car' | 'bike'
    this.mode = 'foot';

    // UI
    this.miniMap = new MiniMap('minimap-canvas');
    this.hud = new HUD({
      onTeleport: (loc) => this.handleTeleport(loc),
      onPresetChange: (preset) => this.atmosphere.setPreset(preset),
      audioManager: this.audio,
      playerController: this.player
    });

    // Handle Window Resizing
    window.addEventListener('resize', () => this.onWindowResize());

    // Start Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleVehicleInteractions() {
    const enterExit = this.input.consumeAction('enterExit');

    if (this.mode === 'foot') {
      const playerPos = this.player.position;
      const distToCar = playerPos.distanceTo(this.car.position);
      const distToBike = playerPos.distanceTo(this.bike.position);

      if (distToCar < 3.8) {
        this.hud.showInteractionPrompt("[E] Enter Car");
        if (enterExit) {
          this.enterCar();
        }
      } else if (distToBike < 3.2) {
        this.hud.showInteractionPrompt("[E] Ride Royal Enfield");
        if (enterExit) {
          this.enterBike();
        }
      } else {
        this.hud.showInteractionPrompt(null);
      }

    } else if (this.mode === 'car') {
      this.hud.showInteractionPrompt("[E] Exit Car  •  [H] Horn  •  [R] Reset");
      if (enterExit) {
        this.exitCar();
      }

    } else if (this.mode === 'bike') {
      this.hud.showInteractionPrompt("[E] Dismount Bike");
      if (enterExit) {
        this.exitBike();
      }
    }
  }

  enterCar() {
    this.mode = 'car';
    this.player.setActive(false);
    this.car.setDriven(true);
    this.cameraCtrl.setTarget(this.car.mesh, 'vehicle');
    this.hud.showInteractionPrompt(null);
  }

  exitCar() {
    const exitPos = this.car.getExitPosition();
    this.car.setDriven(false);
    this.player.teleport(exitPos);
    this.player.setActive(true);
    this.cameraCtrl.setTarget(this.player.mesh, 'player');
    this.mode = 'foot';
    this.hud.showInteractionPrompt(null);
  }

  enterBike() {
    this.mode = 'bike';
    this.player.setActive(false);
    this.bike.setRidden(true);
    this.cameraCtrl.setTarget(this.bike.mesh, 'bike');
    this.hud.showInteractionPrompt(null);
  }

  exitBike() {
    const exitPos = this.bike.getExitPosition();
    this.bike.setRidden(false);
    this.player.teleport(exitPos);
    this.player.setActive(true);
    this.cameraCtrl.setTarget(this.player.mesh, 'player');
    this.mode = 'foot';
    this.hud.showInteractionPrompt(null);
  }

  handleTeleport(locationId) {
    const locations = {
      kundannoor: new THREE.Vector3(0, 0, 350),
      brototype: new THREE.Vector3(36, 0, 305),
      forum: new THREE.Vector3(-28, 0, 230),
      vyttila: new THREE.Vector3(0, 0, 50),
      vyttila_hub: new THREE.Vector3(120, 0, 50),
      kaloor: new THREE.Vector3(-35, 0, -175),
      lulu: new THREE.Vector3(42, 0, -355)
    };

    const targetPos = locations[locationId];
    if (!targetPos) return;

    if (this.mode === 'foot') {
      this.player.teleport(targetPos);
    } else if (this.mode === 'car') {
      this.car.position.copy(targetPos);
      this.car.speed = 0;
      this.car.rotationY = 0;
    } else if (this.mode === 'bike') {
      this.bike.position.copy(targetPos);
      this.bike.speed = 0;
      this.bike.rotationY = 0;
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. Interactions
    this.handleVehicleInteractions();

    // 2. Entities & Physics
    const colliders = this.landmarks.colliders;

    this.player.update(delta, this.input, colliders);
    this.car.update(delta, this.input, colliders);
    this.bike.update(delta, this.input, colliders);

    this.traffic.update(delta);
    this.pedestrians.update(delta);
    this.metro.update(delta);
    this.world.update(delta);
    this.landmarks.update(delta);

    // 3. Camera & Shadow volume
    this.cameraCtrl.update(delta, this.input);

    let activePos = this.player.position;
    let activeHeading = this.player.currentRotation;

    if (this.mode === 'car') {
      activePos = this.car.position;
      activeHeading = this.car.rotationY;
      this.hud.updateSpeedometer(this.car.getSpeedKmh(), this.car.getGear(), true);
    } else if (this.mode === 'bike') {
      activePos = this.bike.position;
      activeHeading = this.bike.rotationY;
      this.hud.updateSpeedometer(this.bike.getSpeedKmh(), 'D', true);
    } else {
      this.hud.updateSpeedometer(0, 'P', false);
    }

    this.atmosphere.updateFollowPosition(activePos);

    // 4. UI Updates
    this.hud.checkLocationZone(activePos);
    this.miniMap.update(activePos, activeHeading, this.landmarks.getLandmarksList(), this.traffic.vehicles);

    // 5. Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate game once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});

