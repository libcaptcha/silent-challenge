#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "quickjs.h"
#include "vm_antidbg.h"
#include "vm_crypto.h"
#include "vm_exports.h"
#include "vm_keys.h"

#define MAGIC_BC 0x564d4243
#define MAGIC_RESP 0x564d5250
#define NONCE_LEN 12
#define MAC_LEN 32
#define MAX_TOKEN 64

static JSRuntime *g_rt;
static JSContext *g_ctx;
static char g_token_hex[MAX_TOKEN * 2 + 1];
static int g_token_len;

static JSValue js_vm_ts(JSContext *ctx, JSValueConst this_val, int argc,
						JSValueConst *argv) {
	double t = EM_ASM_DOUBLE({ return Date.now(); });
	return JS_NewFloat64(ctx, t);
}

static JSValue js_vm_integrity(JSContext *ctx, JSValueConst this_val, int argc,
							   JSValueConst *argv) {
	uint32_t s = antidbg_state();
	return JS_NewUint32(ctx, s);
}

static JSValue js_vm_check(JSContext *ctx, JSValueConst this_val, int argc,
						   JSValueConst *argv) {
	int r = antidbg_check();
	return JS_NewInt32(ctx, r);
}

static JSValue js_vm_token(JSContext *ctx, JSValueConst this_val, int argc,
						   JSValueConst *argv) {
	if (g_token_len == 0)
		return JS_NewString(ctx, "");
	return JS_NewStringLen(ctx, g_token_hex, g_token_len);
}

static JSValue js_console_log(JSContext *ctx, JSValueConst this_val, int argc,
							  JSValueConst *argv) {
	for (int i = 0; i < argc; i++) {
		const char *s = JS_ToCString(ctx, argv[i]);
		if (s) {
			EM_ASM({ console.log(UTF8ToString($0)); }, s);
			JS_FreeCString(ctx, s);
		}
	}
	return JS_UNDEFINED;
}

static void register_intrinsics(JSContext *ctx) {
	JSValue g = JS_GetGlobalObject(ctx);

	JS_SetPropertyStr(ctx, g, "__vm_ts",
					  JS_NewCFunction(ctx, js_vm_ts, "__vm_ts", 0));
	JS_SetPropertyStr(
		ctx, g, "__vm_integrity",
		JS_NewCFunction(ctx, js_vm_integrity, "__vm_integrity", 0));
	JS_SetPropertyStr(ctx, g, "__vm_check",
					  JS_NewCFunction(ctx, js_vm_check, "__vm_check", 0));
	JS_SetPropertyStr(ctx, g, "__vm_token",
					  JS_NewCFunction(ctx, js_vm_token, "__vm_token", 0));

	JSValue console = JS_NewObject(ctx);
	JS_SetPropertyStr(ctx, console, "log",
					  JS_NewCFunction(ctx, js_console_log, "log", 1));
	JS_SetPropertyStr(ctx, g, "console", console);

	JS_FreeValue(ctx, g);
}

EMSCRIPTEN_KEEPALIVE
int vm_init(void) {
	antidbg_init();

	g_rt = JS_NewRuntime();
	if (!g_rt)
		return -1;

	JS_SetMemoryLimit(g_rt, 8 * 1024 * 1024);
	JS_SetMaxStackSize(g_rt, 256 * 1024);

	g_ctx = JS_NewContext(g_rt);
	if (!g_ctx) {
		JS_FreeRuntime(g_rt);
		g_rt = NULL;
		return -1;
	}

	register_intrinsics(g_ctx);
	return 0;
}

EMSCRIPTEN_KEEPALIVE
void vm_destroy(void) {
	if (g_ctx) {
		JS_FreeContext(g_ctx);
		g_ctx = NULL;
	}
	if (g_rt) {
		JS_FreeRuntime(g_rt);
		g_rt = NULL;
	}
}

static uint32_t read_u32_le(const uint8_t *p) {
	return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) |
		   ((uint32_t)p[3] << 24);
}

static void write_u32_le(uint8_t *out, uint32_t v) {
	out[0] = (uint8_t)(v);
	out[1] = (uint8_t)(v >> 8);
	out[2] = (uint8_t)(v >> 16);
	out[3] = (uint8_t)(v >> 24);
}

static uint8_t *encrypt_and_sign(const char *str, size_t str_len,
								 int *out_len) {
	uint8_t resp_nonce[NONCE_LEN];
	double ts = EM_ASM_DOUBLE({ return Date.now(); });
	uint64_t ts_u = (uint64_t)ts;
	memcpy(resp_nonce, &ts_u, 8);
	uint32_t ctr = antidbg_state();
	memcpy(resp_nonce + 8, &ctr, 4);

	uint8_t *resp_ct = (uint8_t *)malloc(str_len);
	if (!resp_ct)
		return NULL;

	chacha20(resp_ct, (const uint8_t *)str, str_len, VM_KEY_ENCRYPT, resp_nonce,
			 1);

	size_t total = 8 + NONCE_LEN + str_len + MAC_LEN;
	uint8_t *resp = (uint8_t *)malloc(total);
	if (!resp) {
		free(resp_ct);
		return NULL;
	}

	write_u32_le(resp, MAGIC_RESP);
	write_u32_le(resp + 4, (uint32_t)total);
	memcpy(resp + 8, resp_nonce, NONCE_LEN);
	memcpy(resp + 8 + NONCE_LEN, resp_ct, str_len);
	free(resp_ct);

	hmac_sha256(resp + 8 + NONCE_LEN + str_len, VM_KEY_SIGN, 32, resp + 8,
				NONCE_LEN + str_len);

	*out_len = (int)total;
	return resp;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *vm_exec_bytecode(const uint8_t *bundle, int bundle_len, int *out_len) {
	*out_len = 0;

	antidbg_on_exec();
	if (antidbg_check() != 0)
		return NULL;

	if (bundle_len < 20)
		return NULL;

	uint32_t magic = read_u32_le(bundle);
	if (magic != MAGIC_BC)
		return NULL;

	uint32_t bc_len = read_u32_le(bundle + 4);
	if ((int)(8 + NONCE_LEN + bc_len) > bundle_len)
		return NULL;

	const uint8_t *nonce_in = bundle + 8;
	const uint8_t *ct_in = bundle + 8 + NONCE_LEN;

	g_token_len = 0;
	g_token_hex[0] = '\0';
	int tail = 8 + NONCE_LEN + bc_len;
	if (bundle_len >= tail + 4) {
		uint32_t tlen = read_u32_le(bundle + tail);
		if (tlen > 0 && tlen <= MAX_TOKEN
			&& tail + 4 + (int)tlen <= bundle_len) {
			const uint8_t *tb = bundle + tail + 4;
			for (uint32_t i = 0; i < tlen; i++) {
				g_token_hex[i * 2] =
					"0123456789abcdef"[tb[i] >> 4];
				g_token_hex[i * 2 + 1] =
					"0123456789abcdef"[tb[i] & 0xf];
			}
			g_token_hex[tlen * 2] = '\0';
			g_token_len = (int)(tlen * 2);
		}
	}

	uint8_t *bc = (uint8_t *)malloc(bc_len);
	if (!bc)
		return NULL;

	chacha20(bc, ct_in, bc_len, VM_KEY_DECRYPT, nonce_in, 1);

	JSValue val = JS_ReadObject(g_ctx, bc, bc_len, JS_READ_OBJ_BYTECODE);
	free(bc);

	if (JS_IsException(val)) {
		JS_FreeValue(g_ctx, val);
		return NULL;
	}

	JSValue result = JS_EvalFunction(g_ctx, val);
	if (JS_IsException(result)) {
		JS_FreeValue(g_ctx, result);
		return NULL;
	}

	const char *str = JS_ToCString(g_ctx, result);
	JS_FreeValue(g_ctx, result);
	if (!str)
		return NULL;

	uint8_t *resp = encrypt_and_sign(str, strlen(str), out_len);
	JS_FreeCString(g_ctx, str);
	return resp;
}

EMSCRIPTEN_KEEPALIVE
void vm_free(void *ptr) { free(ptr); }
