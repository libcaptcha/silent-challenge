#ifndef VM_ANTIDBG_H
#define VM_ANTIDBG_H

#include <stdint.h>

void antidbg_init(void);
void antidbg_on_exec(void);
int antidbg_check(void);
uint32_t antidbg_state(void);

#endif
