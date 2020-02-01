#if !defined(NULL)
#define NULL ((void *)0)
#endif

#define WASM_EXPORT __attribute__((visibility("default")))

#define MINIMP3_ONLY_MP3
#define MINIMP3_NO_SIMD
#define MINIMP3_NONSTANDARD_BUT_LOGICAL
#define MINIMP3_IMPLEMENTATION
#include "minimp3/minimp3.h"

extern unsigned char __heap_base;

const size_t WASM_PAGE_SIZE = 1024 * 64;

size_t heap_size() {
  uintptr_t heap_base = (uintptr_t)&__heap_base;
  return __builtin_wasm_memory_size(0) * WASM_PAGE_SIZE - heap_base;
}

void grow_memory_if_needed(size_t required_bytes) {
  size_t current_byte_size = heap_size();
  if (current_byte_size < required_bytes) {
    int num_pages = (required_bytes - current_byte_size) / WASM_PAGE_SIZE + 1;
    __builtin_wasm_memory_grow(0, num_pages);
  }
}

typedef struct decode_results {
  size_t num_samples;
  size_t num_bytes;
  int sampling_rate;
  double duration;
} decode_results_t;

static struct {
  mp3dec_t mp3d;

  size_t mp3_data_size;
  size_t pcm_data_size;

  size_t byte_offset;
  double current_time;
} g_decoder;

static decode_results_t g_decode_results;

WASM_EXPORT
void init() { mp3dec_init(&g_decoder.mp3d); }

WASM_EXPORT
double current_time() { return g_decoder.current_time; }

WASM_EXPORT
size_t num_samples() { return g_decode_results.num_samples; }

WASM_EXPORT
size_t num_bytes() { return g_decode_results.num_bytes; }

WASM_EXPORT
int sampling_rate() { return g_decode_results.sampling_rate; }

WASM_EXPORT
double duration() { return g_decode_results.duration; }

WASM_EXPORT
const uint8_t *mp3_data_base() { return &__heap_base; }

WASM_EXPORT
size_t mp3_data_size() { return g_decoder.mp3_data_size; }

WASM_EXPORT
void set_mp3_data_size(size_t mp3_data_size) {
  size_t required_bytes = mp3_data_size;
  grow_memory_if_needed(required_bytes);

  g_decoder.mp3_data_size = mp3_data_size;
  g_decoder.pcm_data_size = 0;

  g_decoder.byte_offset = 0;
  g_decoder.current_time = 0.0;
}

WASM_EXPORT
const uint8_t *pcm_data_base() {
  return mp3_data_base() + g_decoder.mp3_data_size;
}

WASM_EXPORT
size_t pcm_data_size() { return g_decoder.pcm_data_size; }

// Seek to the given `target_duration_in_seconds`. If it's less than
// zero, seek to the end.
void seek_internal(const uint8_t *mp3_data, size_t mp3_data_size,
                   double target_duration_in_seconds, decode_results_t *out) {
  size_t num_bytes = 0;
  double duration = 0.0;
  size_t num_samples = 0;
  int sampling_rate = 0;

  while (num_bytes < mp3_data_size) {
    mp3dec_frame_info_t frame;
    int samples = mp3dec_decode_frame(&g_decoder.mp3d, mp3_data + num_bytes,
                                      mp3_data_size - num_bytes, NULL, &frame);
    if (samples == 0) {
      if (frame.frame_bytes > 0) {
        // Skipped ID3 or invalid data.
        num_bytes += frame.frame_bytes;
        continue;
      }
      // Insufficient data
      break;
    }

    if (sampling_rate == 0) {
      sampling_rate = frame.hz;
    } else if (sampling_rate != frame.hz) {
      // Mismatch sampling rate.
      break;
    }

    double advance_in_seconds = (double)samples / (double)frame.hz;
    if (target_duration_in_seconds >= 0.0 &&
        duration + advance_in_seconds >= target_duration_in_seconds)
      break;

    num_bytes += frame.frame_bytes;
    duration += advance_in_seconds;
    num_samples += samples;
  }

  out->num_samples = num_samples;
  out->num_bytes = num_bytes;
  out->sampling_rate = sampling_rate;
  out->duration = duration;
}

WASM_EXPORT
void seek(double position_in_seconds) {
  decode_results_t results;
  seek_internal(mp3_data_base(), g_decoder.mp3_data_size, position_in_seconds,
                &results);
  memcpy(&g_decode_results, &results, sizeof(decode_results_t));

  g_decoder.byte_offset = results.num_bytes;
  g_decoder.current_time = results.duration;
}

void decode_internal(const uint8_t *mp3_data, size_t mp3_data_size,
                     size_t target_num_samples, decode_results_t *out) {
  size_t num_bytes = 0;
  double duration = 0.0;
  size_t num_samples = 0;
  int sampling_rate = 0;
  mp3d_sample_t *pcm = (mp3d_sample_t *)pcm_data_base();

  while (num_bytes < mp3_data_size && num_samples < target_num_samples) {
    mp3dec_frame_info_t frame;
    int samples = mp3dec_decode_frame(&g_decoder.mp3d, mp3_data + num_bytes,
                                      mp3_data_size - num_bytes, pcm, &frame);
    if (samples == 0) {
      if (frame.frame_bytes > 0) {
        // Skipped ID3 or invalid data.
        num_bytes += frame.frame_bytes;
        continue;
      }
      // Insufficient data
      break;
    }

    if (sampling_rate == 0) {
      sampling_rate = frame.hz;
    } else if (sampling_rate != frame.hz) {
      // Mismatch sampling rate.
      break;
    }

    double advance_in_seconds = (double)samples / (double)frame.hz;

    num_bytes += frame.frame_bytes;
    duration += advance_in_seconds;
    num_samples += samples;
    pcm += samples;
  }

  out->num_samples = num_samples;
  out->num_bytes = num_bytes;
  out->sampling_rate = sampling_rate;
  out->duration = duration;
}

WASM_EXPORT
void decode(double duration_in_seconds) {
  // Seek first to calculate how many samples to decode.
  decode_results_t seek_results;
  seek_internal(mp3_data_base() + g_decoder.byte_offset,
                g_decoder.mp3_data_size - g_decoder.byte_offset,
                duration_in_seconds, &seek_results);

  // Allocate memory for decoded data (pcm).
  size_t pcm_data_size = seek_results.num_samples * sizeof(mp3d_sample_t);
  size_t required_bytes = g_decoder.mp3_data_size + pcm_data_size;
  grow_memory_if_needed(required_bytes);

  g_decoder.pcm_data_size = pcm_data_size;

  // Perform actual decoding.
  decode_results_t decode_results;
  decode_internal(mp3_data_base() + g_decoder.byte_offset,
                  g_decoder.mp3_data_size - g_decoder.byte_offset,
                  seek_results.num_samples, &decode_results);
  memcpy(&g_decode_results, &decode_results, sizeof(decode_results_t));

  // Update decoder state
  g_decoder.byte_offset += decode_results.num_bytes;
  g_decoder.current_time += decode_results.duration;
}

// stdlib dummy implementation

void *memcpy(void *dest, const void *src, size_t n) {
  return memmove(dest, src, n);
}

void *memset(void *s, int c, size_t n) {
  char *dst = s;
  while (n > 0) {
    *dst = (char)(c);
    dst++;
    n--;
  }
  return s;
}

// https://codereview.stackexchange.com/questions/174935/implementation-of-memmove
void *memmove(void *dest, const void *src, size_t n) {
  char *d = (char *)(dest);
  const char *s = (char const *)(src);

  // If s and d are in distinct objects, the comparison is
  // unspecified behaviour, but either branch will work.
  if (s < d) {
    s += n;
    d += n;
    while (n--) *--d = *--s;
  } else {
    while (n--) *d++ = *s++;
  }

  return dest;
}
