#include "vm_antidbg.h"
#include <emscripten.h>
#include <string.h>

#define MAX_EXEC_COUNT 64
#define CALL_INIT 0x01
#define CALL_EXEC 0x02

static volatile uint32_t g_call_seq;
static volatile uint32_t g_exec_count;
static volatile double g_last_ts;
static volatile uint32_t g_integrity;

static uint32_t fnv1a(uint32_t h, const void *data, int n) {
	const uint8_t *p = (const uint8_t *)data;
	for (int i = 0; i < n; i++) {
		h ^= p[i];
		h *= 0x01000193;
	}
	return h;
}

static double now_ms(void) {
	return EM_ASM_DOUBLE({ return Date.now(); });
}

void antidbg_init(void) {
	g_call_seq = CALL_INIT;
	g_exec_count = 0;
	g_last_ts = now_ms();

	uint32_t seed = 0x811c9dc5;
	uint32_t tmp = g_call_seq;
	seed = fnv1a(seed, &tmp, 4);
	g_integrity = seed;
}

void antidbg_on_exec(void) {
	g_exec_count++;
	g_call_seq |= CALL_EXEC;
	g_last_ts = now_ms();

	uint32_t ec = g_exec_count;
	g_integrity = fnv1a(g_integrity, &ec, 4);
}

int antidbg_check(void) {
	if (!(g_call_seq & CALL_INIT))
		return -1;

	if (g_exec_count > MAX_EXEC_COUNT)
		return -2;

	double t = now_ms();
	double delta = t - g_last_ts;
	g_last_ts = t;
	if (delta > 120000.0 || delta < 0.0)
		return -3;

	return 0;
}

uint32_t antidbg_state(void) {
	uint32_t h = g_integrity;
	uint32_t ec = g_exec_count;
	h = fnv1a(h, &ec, 4);
	h ^= (uint32_t)(g_last_ts);
	return h;
}
