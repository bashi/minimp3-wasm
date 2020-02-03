import Decoder from "./decoder.js";

async function instantiate() {
  const res = await fetch("out/decoder.opt.wasm");
  const buffer = await res.arrayBuffer();
  const wasm = await WebAssembly.instantiate(buffer, {});
  return wasm.instance.exports;
}

async function fetchTestData() {
  const res = await fetch("testdata/test1.mp3");
  const buffer = await res.arrayBuffer();
  const data = new Uint8Array(buffer);
  return data;
}

class WaveCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  /**
   * @param {Int16Array} pcm PCM data to draw
   */
  drawPcm(pcm, offset, length) {
    offset = offset || 0;
    length = length || pcm.length;

    const cs = getComputedStyle(this.canvas);
    const width = parseFloat(cs.width);
    const height = parseFloat(cs.height);

    const dpr = window.devicePixelRatio;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);

    const m = height / 2;

    const xadv = 0.1;
    const sadv = Math.floor((length / width) * xadv);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.strokeStyle = "#6374f2";
    this.ctx.beginPath();
    let spos = offset;
    for (let x = 0; x < width; x += xadv) {
      if (spos >= length) break;
      const y = m - m * (pcm[spos] / 32768.0);
      this.ctx.lineTo(x, y);
      spos += sadv;
    }
    this.ctx.stroke();
  }
}

function toMonoPcm(decodeResults) {
  if (decodeResults.numChannels === 1) {
    return decodeResults.pcm;
  }
  const length = Math.floor(
    decodeResults.pcm.length / decodeResults.numChannels
  );
  const pcm = new Int16Array(length);
  for (let i = 0, j = 0; i < length; i++ , j += decodeResults.numChannels) {
    pcm[i] = decodeResults.pcm[j];
  }
  return pcm;
}

async function main() {
  window.wasmInstance = await instantiate();

  const data = await fetchTestData();
  window.decoder = new Decoder(wasmInstance, data);

  const canvas = document.getElementById("wave-canvas");
  window.waveCanvas = new WaveCanvas(canvas);

  const DURATION_TO_DECODE = 10;

  function decodeAndDrawWave() {
    const results = decoder.decode(DURATION_TO_DECODE);
    const pcm = toMonoPcm(results);
    waveCanvas.drawPcm(pcm);
    window.decodeResults = results;
    window.monoPcm = pcm;
  }

  // Position
  const positionBar = document.getElementById("position-bar");
  function setBarPosition(pos) {
    positionBar.style.marginLeft = "" + pos + "px";
  }

  function playDecoded(decodeResults) {
    if (!window.audioCtx) {
      window.audioCtx = new AudioContext();
    }

    if (window.bufferSource) {
      bufferSource.stop();
    }

    const buffer = audioCtx.createBuffer(
      1,
      decodeResults.totalNumSamples,
      decodeResults.samplingRate
    );
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < decodeResults.totalNumSamples; i++) {
      const v = window.monoPcm[i];
      channelData[i] = v >= 0x8000 ? -(0x10000 - v) / 0x8000 : v / 0x7fff;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.addEventListener("ended", _ => {
      window.isPlaying = false;
    });
    source.start();
    window.bufferSource = source;
    window.isPlaying = true;
    window.playbackStartTime = performance.now();

    setBarPosition(0);

    const callback = _ => {
      if (!window.isPlaying) return;
      const elapsed = performance.now() - window.playbackStartTime;
      const relative = elapsed / (DURATION_TO_DECODE * 1000.0);

      const cs = getComputedStyle(canvas);
      const width = parseFloat(cs.width);
      const pos = width * relative;
      setBarPosition(pos);
      requestAnimationFrame(_ => callback());
    };
    requestAnimationFrame(_ => callback());
  }

  const seekRange = document.getElementById("seek-range");
  window.seekRange = seekRange;
  seekRange.min = 0;
  seekRange.max = decoder.duration - DURATION_TO_DECODE;
  seekRange.addEventListener("change", _ => {
    decoder.seek(seekRange.value);
    setBarPosition(0);
    decodeAndDrawWave();
  });

  const playButton = document.getElementById("play-button");
  playButton.addEventListener("click", _ => {
    if (window.decodeResults) {
      playDecoded(decodeResults);
    }
  });

  const stopButton = document.getElementById("stop-button");
  stopButton.addEventListener("click", _ => {
    if (window.bufferSource) {
      bufferSource.stop();
    }
  });

  decodeAndDrawWave();
}

document.addEventListener("DOMContentLoaded", _ => main());
