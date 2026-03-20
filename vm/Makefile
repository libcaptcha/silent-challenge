QJS_DIR   := vendor/quickjs
SRC_DIR   := src
BUILD_DIR := build
OUT_DIR   := web

.PHONY: all build compile clean

all: build

build:
	node scripts/build.js

compile:
	@test -n "$(INPUT)" || \
		(echo "Usage: make compile INPUT=file.js" && exit 1)
	node scripts/compile.js $(INPUT)

clean:
	rm -rf $(BUILD_DIR)
	rm -f $(OUT_DIR)/vm.js $(OUT_DIR)/vm.wasm
	rm -f $(OUT_DIR)/loader.js
