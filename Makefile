all: out/decoder.opt.wasm out/decoder.opt.wasm

out/decoder.opt.wasm: out/decoder.wasm
	wasm-opt -Os out/decoder.wasm -o out/decoder.opt.wasm

out/decoder.wasm: minimp3/minimp3.h include/stdlib.h include/string.h decoder.c
	clang -Wall -Os -Iinclude --target=wasm32-unknown-unknown -nostdlib -fvisibility=hidden -Wl,--export-dynamic -Wl,--export=__heap_base -Wl,--no-entry -o out/decoder.wasm decoder.c

.PHONY: clean

clean:
	-rm -f out/decoder.wasm out/decoder.opt.wasm
