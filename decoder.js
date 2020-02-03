export default class Decoder {
  /**
   * @param {WebAssembly.ExportValue} wasm WebAssembly instance from decoder.wasm.
   * @param {Uint8Array} data MP3 data to decode.
   */
  constructor(wasm, data) {
    this.wasm = wasm;
    this.wasm.init();
    this.wasm.set_mp3_data_size(data.byteLength);
    const mp3DataInWasm = new Uint8Array(
      this.wasm.memory.buffer,
      this.wasm.mp3_data_base(),
      this.wasm.mp3_data_size()
    );
    mp3DataInWasm.set(data);

    // Calculate duration.
    this.duration = this.seek(-1);
    this.seek(0);
  }

  /**
   * Seeks to the specified position in seconds.
   * @param {number} position Position to seek in seconds.
   * @returns {number} The current position in seconds.
   */
  seek(position) {
    this.wasm.seek(position);
    return this.wasm.current_time();
  }

  /**
   * Decodes MP3 data from the current position. The decoder advances to the new position.
   * @param {number} duration seconds to decode.
   * @returns {object} Decoded results.
   */
  decode(duration) {
    const startTime = this.wasm.current_time();
    this.wasm.decode(duration);
    const pcm = new Int16Array(
      this.wasm.memory.buffer,
      this.wasm.pcm_data_base(),
      this.wasm.pcm_data_size() / 2
    );
    const results = {
      pcm: pcm,
      numChannels: this.wasm.num_channels(),
      totalNumSamples: this.wasm.total_num_samples(),
      numSamplesPerFrame: this.wasm.num_samples_per_frame(),
      numFrames: this.wasm.num_frames(),
      samplingRate: this.wasm.sampling_rate(),
      startTime: startTime,
      duration: this.wasm.duration()
    };
    return results;
  }

  /**
   * @returns {number} The current position in seconds.
   */
  current_time() {
    return this.wasm.current_time();
  }
}
