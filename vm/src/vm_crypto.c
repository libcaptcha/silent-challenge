#include "vm_crypto.h"
#include <stdlib.h>
#include <string.h>

static uint32_t rotl32(uint32_t v, int n) { return (v << n) | (v >> (32 - n)); }

#define QR(a, b, c, d)                                                         \
	do {                                                                       \
		a += b;                                                                \
		d ^= a;                                                                \
		d = rotl32(d, 16);                                                     \
		c += d;                                                                \
		b ^= c;                                                                \
		b = rotl32(b, 12);                                                     \
		a += b;                                                                \
		d ^= a;                                                                \
		d = rotl32(d, 8);                                                      \
		c += d;                                                                \
		b ^= c;                                                                \
		b = rotl32(b, 7);                                                      \
	} while (0)

static void chacha20_block(uint32_t out[16], const uint32_t in[16]) {
	uint32_t x[16];
	memcpy(x, in, 64);
	for (int i = 0; i < 10; i++) {
		QR(x[0], x[4], x[8], x[12]);
		QR(x[1], x[5], x[9], x[13]);
		QR(x[2], x[6], x[10], x[14]);
		QR(x[3], x[7], x[11], x[15]);
		QR(x[0], x[5], x[10], x[15]);
		QR(x[1], x[6], x[11], x[12]);
		QR(x[2], x[7], x[8], x[13]);
		QR(x[3], x[4], x[9], x[14]);
	}
	for (int i = 0; i < 16; i++)
		out[i] = x[i] + in[i];
}

static uint32_t load32_le(const uint8_t *p) {
	return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) |
		   ((uint32_t)p[3] << 24);
}

static void store32_le(uint8_t *p, uint32_t v) {
	p[0] = (uint8_t)v;
	p[1] = (uint8_t)(v >> 8);
	p[2] = (uint8_t)(v >> 16);
	p[3] = (uint8_t)(v >> 24);
}

void chacha20(uint8_t *out, const uint8_t *in, size_t len,
			  const uint8_t key[32], const uint8_t nonce[12],
			  uint32_t counter) {
	uint32_t state[16];
	state[0] = 0x61707865;
	state[1] = 0x3320646e;
	state[2] = 0x79622d32;
	state[3] = 0x6b206574;
	for (int i = 0; i < 8; i++)
		state[4 + i] = load32_le(key + 4 * i);
	state[12] = counter;
	for (int i = 0; i < 3; i++)
		state[13 + i] = load32_le(nonce + 4 * i);

	uint32_t blk[16];
	size_t off = 0;
	while (off < len) {
		chacha20_block(blk, state);
		uint8_t ks[64];
		for (int i = 0; i < 16; i++)
			store32_le(ks + 4 * i, blk[i]);
		size_t chunk = len - off;
		if (chunk > 64)
			chunk = 64;
		for (size_t i = 0; i < chunk; i++)
			out[off + i] = in[off + i] ^ ks[i];
		off += chunk;
		state[12]++;
	}
}

static const uint32_t K256[64] = {
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
	0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
	0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
	0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
	0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
	0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
	0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
	0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
	0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};

#define RR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define S0(x) (RR(x, 2) ^ RR(x, 13) ^ RR(x, 22))
#define S1(x) (RR(x, 6) ^ RR(x, 11) ^ RR(x, 25))
#define s0(x) (RR(x, 7) ^ RR(x, 18) ^ ((x) >> 3))
#define s1(x) (RR(x, 17) ^ RR(x, 19) ^ ((x) >> 10))
#define CH(x, y, z) (((x) & (y)) ^ ((~(x)) & (z)))
#define MAJ(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))

static uint32_t load32_be(const uint8_t *p) {
	return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
		   ((uint32_t)p[2] << 8) | (uint32_t)p[3];
}

static void store32_be(uint8_t *p, uint32_t v) {
	p[0] = (uint8_t)(v >> 24);
	p[1] = (uint8_t)(v >> 16);
	p[2] = (uint8_t)(v >> 8);
	p[3] = (uint8_t)v;
}

static void sha256_transform(uint32_t h[8], const uint8_t blk[64]) {
	uint32_t w[64];
	for (int i = 0; i < 16; i++)
		w[i] = load32_be(blk + 4 * i);
	for (int i = 16; i < 64; i++)
		w[i] = s1(w[i - 2]) + w[i - 7] + s0(w[i - 15]) + w[i - 16];

	uint32_t a = h[0], b = h[1];
	uint32_t c = h[2], d = h[3];
	uint32_t e = h[4], f = h[5];
	uint32_t g = h[6], hh = h[7];

	for (int i = 0; i < 64; i++) {
		uint32_t t1 = hh + S1(e) + CH(e, f, g) + K256[i] + w[i];
		uint32_t t2 = S0(a) + MAJ(a, b, c);
		hh = g;
		g = f;
		f = e;
		e = d + t1;
		d = c;
		c = b;
		b = a;
		a = t1 + t2;
	}
	h[0] += a;
	h[1] += b;
	h[2] += c;
	h[3] += d;
	h[4] += e;
	h[5] += f;
	h[6] += g;
	h[7] += hh;
}

void sha256(uint8_t out[32], const uint8_t *data, size_t len) {
	uint32_t h[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
					 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};

	size_t i = 0;
	for (; i + 64 <= len; i += 64)
		sha256_transform(h, data + i);

	uint8_t buf[128];
	size_t rem = len - i;
	memcpy(buf, data + i, rem);
	buf[rem++] = 0x80;

	if (rem > 56) {
		memset(buf + rem, 0, 128 - rem);
		sha256_transform(h, buf);
		memset(buf, 0, 56);
	} else {
		memset(buf + rem, 0, 56 - rem);
	}

	uint64_t bits = (uint64_t)len * 8;
	for (int j = 7; j >= 0; j--)
		buf[56 + (7 - j)] = (uint8_t)(bits >> (j * 8));
	sha256_transform(h, buf);

	for (int j = 0; j < 8; j++)
		store32_be(out + 4 * j, h[j]);
}

void hmac_sha256(uint8_t out[32], const uint8_t *key, size_t key_len,
				 const uint8_t *msg, size_t msg_len) {
	uint8_t kpad[64];
	uint8_t tk[32];

	if (key_len > 64) {
		sha256(tk, key, key_len);
		key = tk;
		key_len = 32;
	}
	memset(kpad, 0, 64);
	memcpy(kpad, key, key_len);

	uint8_t ipad[64];
	for (int i = 0; i < 64; i++)
		ipad[i] = kpad[i] ^ 0x36;

	size_t ilen = 64 + msg_len;
	uint8_t *ibuf = (uint8_t *)malloc(ilen);
	memcpy(ibuf, ipad, 64);
	memcpy(ibuf + 64, msg, msg_len);

	uint8_t ihash[32];
	sha256(ihash, ibuf, ilen);
	free(ibuf);

	uint8_t obuf[96];
	for (int i = 0; i < 64; i++)
		obuf[i] = kpad[i] ^ 0x5c;
	memcpy(obuf + 64, ihash, 32);

	sha256(out, obuf, 96);
}

int ct_compare(const uint8_t *a, const uint8_t *b, size_t len) {
	volatile uint8_t diff = 0;
	for (size_t i = 0; i < len; i++)
		diff |= a[i] ^ b[i];
	return diff == 0 ? 0 : -1;
}
