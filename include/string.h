#ifndef _STRING_H
#define _STRING_H

typedef unsigned long size_t;

#if !defined(NULL)
#define NULL ((void *)0)
#endif

void *memcpy(void *dest, const void *src, size_t n);
void *memset(void *s, int c, size_t n);
void *memmove(void *dest, const void *src, size_t n);

#endif  // _STRING_H
