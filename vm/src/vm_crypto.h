#ifndef VM_CRYPTO_H
#define VM_CRYPTO_H

#include <stddef.h>
#include <stdint.h>

void chacha20(uint8_t *out, const uint8_t *in, size_t len,
			  const uint8_t key[32], const uint8_t nonce[12], uint32_t counter);

void sha256(uint8_t out[32], const uint8_t *data, size_t len);

void hmac_sha256(uint8_t out[32], const uint8_t *key, size_t key_len,
				 const uint8_t *msg, size_t msg_len);

int ct_compare(const uint8_t *a, const uint8_t *b, size_t len);

#endif
