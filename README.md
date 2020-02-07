# minimp3-wasm

A demo of compiling [minimp3](https://github.com/lieff/minimp3) to WebAssembly without [Emscripten](https://emscripten.org/).

## Usage

```js
import Decoder from './decoder.js';

const mp3Data = /* Some Uint8Array */;
const { instance } = await WebAssembly.instantiateStreaming(fetch('./out/decoder.opt.wasm'));
const decoder = new Decoder(instance.exports, mp3Data);

decoder.seek(/*position_in_secounds=*/30);
const results = decoder.decode(/*duration_in_seconds=*/10);
// => { pcm: Int16Array(...), ... }
```

## Building

Prerequisites:
* [clang](http://releases.llvm.org/) 9 or later
* [wasm-opt](https://github.com/WebAssembly/binaryen)

```sh
$ make
```

The decoder wasm will be generated under `out/` directory.
