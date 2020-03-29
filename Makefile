all: dist/decoder.opt.wasm dist/decoder.opt.wasm

dist/decoder.opt.wasm: dist/decoder.wasm
	wasm-opt -Os dist/decoder.wasm -o dist/decoder.opt.wasm

dist/decoder.wasm: minimp3/minimp3.h include/stdlib.h include/string.h decoder.c
	clang -Wall -Os -Iinclude --target=wasm32-unknown-unknown -nostdlib -fvisibility=hidden -Wl,--export-dynamic -Wl,--export=__heap_base -Wl,--no-entry -o dist/decoder.wasm decoder.c

.PHONY: clean

clean:
	-rm -f dist/decoder.wasm dist/decoder.opt.wasm
