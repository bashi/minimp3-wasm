export interface DecodeResult {
  pcm: Int16Array,
  startTime: number,
  duration: number,
  samplingRate: number,
  numChannels: number,
  numSamples: number,
}

export class Decoder {
  private wasm: Record<string, any>;
  public duration: number;

  /**
   * @param {Record<String, any>} wasm WebAssembly exports.
   * @param {Uint8Array} data MP3 data to decode.
   */
  constructor(wasm: Record<string, any>, data: Uint8Array) {
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
  seek(position: number): number {
    this.wasm.decoder_seek(position);
    return this.currentTime();
  }

  /**
   * Decodes MP3 data from the current position. The decoder advances to the new position.
   * @param {number} duration seconds to decode.
   * @returns {object} Decoded results.
   */
  decode(duration: number): DecodeResult {
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
  currentTime(): number {
    return this.wasm.decoder_current_time();
  }
}

export async function createDecoder(data: Uint8Array, wasmUrl?: string): Promise<Decoder> {
  wasmUrl = wasmUrl || 'decoder.opt.wasm';
  const res = await fetch(wasmUrl);
  const buffer = await res.arrayBuffer();
  let wasm = await WebAssembly.instantiate(buffer, {});
  return new Decoder(wasm.instance.exports, data);
}
