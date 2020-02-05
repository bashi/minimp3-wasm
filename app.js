import Decoder from "./decoder.js";

async function instantiate() {
  const res = await fetch("out/decoder.opt.wasm");
  const buffer = await res.arrayBuffer();
  const wasm = await WebAssembly.instantiate(buffer, {});
  return wasm.instance.exports;
}

async function fetchTestData() {
  const res = await fetch("testdata/test3.mp3");
  const buffer = await res.arrayBuffer();
  const data = new Uint8Array(buffer);
  return data;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Int16Array} pcm PCM data to draw
 */
function drawPcm(canvas, pcm) {
  const offset = 0;
  const length = pcm.length;
  const ctx = canvas.getContext("2d");

  const cs = getComputedStyle(canvas);
  const width = parseFloat(cs.width);
  const height = parseFloat(cs.height);

  const dpr = window.devicePixelRatio;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const m = height / 2;

  const xadv = 0.1;
  const sadv = Math.floor((length / width) * xadv);

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#6374f2";
  ctx.beginPath();
  let spos = offset;
  for (let x = 0; x < width; x += xadv) {
    if (spos >= length) break;
    const y = m - m * (pcm[spos] / 32768.0);
    ctx.lineTo(x, y);
    spos += sadv;
  }
  ctx.stroke();
}

/**
 * @param {Int16Array} pcm PCM data
 * @param {number} numChannels Number of channels in `pcm`
 * @returns {Int16Array} Mono PCM data
 */
function toMonoPcm(pcm, numChannels) {
  if (numChannels === 1) {
    return pcm;
  }
  const length = Math.floor(pcm.length / numChannels);
  const mono = new Int16Array(length);
  for (let i = 0, j = 0; i < length; i += 1, j += numChannels) {
    mono[i] = pcm[j];
  }
  return mono;
}

class DecodedSamplesPlayer {
  /**
   * @param {Int16Array} pcm Mono PCM
   * @param {number} samplingRate sampling rate
   */
  constructor(pcm, samplingRate) {
    this.pcm = pcm;
    this.samplingRate = samplingRate;
  }

  /**
   * @param {AudioContext} ctx 
   */
  play(ctx) {
    this.stop();

    const buffer = ctx.createBuffer(1, this.pcm.length, this.samplingRate);
    const channelData = buffer.getChannelData(0);
    // int16 -> float32
    for (let i = 0; i < this.pcm.length; i++) {
      const v = this.pcm[i];
      channelData[i] = v >= 32768 ? -(65536 - v) / 32768 : v / 32767;
      // channelData[i] = v >= 0x8000 ? -(0x10000 - v) / 0x8000 : v / 0x7fff;
    }

    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.connect(ctx.destination);
    this.source.addEventListener('ended', _ => {
      this.source = null;
    });
    this.source.start();
  }

  stop() {
    if (this.source) {
      this.source.stop();
    }
  }

  isPlaying() {
    return !!this.source;
  }
}

class App {
  constructor(wasmInstance, mp3) {
    this.decoder = new Decoder(wasmInstance, mp3);
    this.durationToDecode = 10;

    this.canvas = document.getElementById('wave-canvas');
    this.positionBar = document.getElementById('position-bar');

    // Seek Range
    const seekRange = document.getElementById('seek-range');
    seekRange.min = 0;
    seekRange.max = this.decoder.duration - this.durationToDecode;
    seekRange.addEventListener('change', _ => {
      if (this.player) {
        this.player.stop();
      }

      this._seek(seekRange.value);
      this._decode(this.durationToDecode);
    });

    // Play button
    document.getElementById('play-button').addEventListener('click', _ => {
      this._togglePlaying();
    });
  }

  _seek(duration) {
    this.decoder.seek(duration);
    this._setBarPosition(0);
  }

  _decode(duration) {
    this.decoded = this.decoder.decode(duration);
    this.mono = toMonoPcm(this.decoded.pcm, this.decoded.numChannels);
    this.player = new DecodedSamplesPlayer(this.mono, this.decoded.samplingRate);
    drawPcm(this.canvas, this.mono);
  }

  _togglePlaying() {
    if (!this.player) return;
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.player.isPlaying()) {
      this.player.stop();
    } else {
      this.player.play(this.audioCtx);
      this._startAnimation();
    }
  }

  _startAnimation() {
    this._setBarPosition(0);
    const startTime = performance.now();
    const callback = _ => {
      if (!this.player) return;
      if (!this.player.isPlaying()) return;

      const elapsed = performance.now() - startTime;
      const r = elapsed / (this.durationToDecode * 1000.0);

      const cs = getComputedStyle(this.canvas);
      const width = parseFloat(cs.width);
      const pos = width * r;
      this._setBarPosition(pos);
      requestAnimationFrame(_ => callback());
    }
    requestAnimationFrame(_ => callback());
  }

  _setBarPosition(pos) {
    this.positionBar.style.marginLeft = '' + pos + 'px';
  }
}

async function main() {
  const wasmInstance = await instantiate();
  const mp3 = await fetchTestData();
  window.app = new App(wasmInstance, mp3);

  app._decode(5);
}

document.addEventListener('DOMContentLoaded', _ => main());
