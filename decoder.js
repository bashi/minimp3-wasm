export default class Decoder {
  /**
   * @param {WebAssembly.ExportValue} wasm WebAssembly instance from decoder.wasm.
   * @param {Uint8Array} data MP3 data to decode.
   */
  constructor(wasm, data) {
    this.wasm = wasm;
    this.wasm.decoder_init();

    // Set `data` in Wasm memory.
    this.wasm.decoder_set_mp3_data_size(data.byteLength);
    const mp3DataInWasm = new Uint8Array(
      this.wasm.memory.buffer,
      this.wasm.decoder_mp3_data_offset(),
      this.wasm.decoder_mp3_data_size()
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
    this.wasm.decoder_seek(position);
    return this.currentTime();
  }

  /**
   * Decodes MP3 data from the current position. The decoder advances to the new position.
   * @param {number} duration seconds to decode.
   * @returns {object} Decoded results.
   */
  decode(duration) {
    const startTime = this.currentTime();
    this.wasm.decoder_decode(duration);
    const pcm = new Int16Array(
      this.wasm.memory.buffer,
      this.wasm.decoder_pcm_data_offset(),
      this.wasm.decoder_pcm_data_size() / 2
    );
    const samplingRate = this.wasm.decode_results_sampling_rate();
    const numChannels = this.wasm.decode_results_num_channels();
    const numSamples = this.wasm.decode_results_num_samples();
    const actualDuration = (numSamples / numChannels) / samplingRate;
    return {
      pcm: pcm,
      startTime: startTime,
      duration: actualDuration,
      samplingRate: samplingRate,
      numChannels: numChannels,
      numSamples: numSamples,
    };
  }

  /**
   * @returns {number} The current position in seconds.
   */
  currentTime() {
    return this.wasm.decoder_current_time();
  }

  // TODO: Remove.
  status() {
    const status = {
      mp3_data_offset: this.wasm.decoder_mp3_data_offset(),
      decoder_mp3_data_size: this.wasm.decoder_mp3_data_size(),
      decoder_pcm_data_offset: this.wasm.decoder_pcm_data_offset(),
      decoder_pcm_data_size: this.wasm.decoder_pcm_data_size(),
      decoder_byte_offset: this.wasm.decoder_byte_offset(),
      decoder_current_time: this.wasm.decoder_current_time(),
    };
    console.table(status);
  }
}
