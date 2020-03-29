# minimp3-wasm

A demo of compiling [minimp3](https://github.com/lieff/minimp3) to WebAssembly without [Emscripten](https://emscripten.org/).

## Usage

```js
import { createDecoder } from './dist/minimp3-wasm.js';

const mp3Data = /* Some Uint8Array */;
const decoder = await createDecoder(mp3Data, './dist/decoder.opt.wasm');

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
$ npm install
$ npm run build
```

The decoder wasm and its bindings will be generated under `dist/` directory.
