export interface DecodeResult {
    pcm: Int16Array;
    startTime: number;
    duration: number;
    samplingRate: number;
    numChannels: number;
    numSamples: number;
}
export declare class Decoder {
    private wasm;
    duration: number;
    /**
     * @param {Record<String, any>} wasm WebAssembly exports.
     * @param {Uint8Array} data MP3 data to decode.
     */
    constructor(wasm: Record<string, any>, data: Uint8Array);
    /**
     * Seeks to the specified position in seconds.
     * @param {number} position Position to seek in seconds.
     * @returns {number} The current position in seconds.
     */
    seek(position: number): number;
    /**
     * Decodes MP3 data from the current position. The decoder advances to the new position.
     * @param {number} duration seconds to decode.
     * @returns {object} Decoded results.
     */
    decode(duration: number): DecodeResult;
    /**
     * @returns {number} The current position in seconds.
     */
    currentTime(): number;
}
export declare function createDecoder(data: Uint8Array, wasmUrl?: string): Promise<Decoder>;
