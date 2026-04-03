/*
 * Stub symbols for qjsc_repl so nbqjs can be built without the
 * full qjsc toolchain (which requires a running host qjsc to compile
 * repl.js to C first).  The interactive REPL is not needed for
 * nbqjs — it only runs compiled NeoBasic output.
 */
#include <stdint.h>

const uint8_t qjsc_repl[] = { 0 };
const uint32_t qjsc_repl_size = 0;
