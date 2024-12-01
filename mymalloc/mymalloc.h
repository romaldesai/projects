#ifndef _MYMALLOC_H
#define _MYMALLOC_H

#include <stddef.h>

void* mymalloc(size_t size, char *file, int line);
void  myfree(void *ptr, char *file, int line);


#define malloc(x) mymalloc(x, __FILE__, __LINE__)
#define free(x) myfree(x, __FILE__, __LINE__)
#define MEMLENGTH 4096
#define ALIGNMENT 8

static void init ();




union HEAP{
    unsigned char bytes[MEMLENGTH];
    double not_used;
};

static union HEAP global_heap;
static int initialized = 0;

struct CHUNK
{
    size_t size;
    char   is_used;
    struct CHUNK* next;
    char *payload;
};


#endif
