
#include <stdlib.h>
#include <stdio.h>
#include "mymalloc.h"

struct CHUNK* mylist = NULL;


void checkmemleak (void)
{
    
   int leak = 0;
   int leakitems = 0;
   struct CHUNK* tmp = mylist;

   while (tmp != NULL){ 
      if (tmp->is_used == 1){
    	leakitems += 1;
        leak = leak + tmp->size;
      } 
      else
      {
	    tmp = tmp->next;
      }
   }
   printf ("%d bytes leaked in %d objects\n",  leak, leakitems);
}
void init (){
    
    if (!initialized){
        mylist = (struct CHUNK*)&global_heap;
        mylist->is_used = 0;
        mylist->size = MEMLENGTH - sizeof(struct CHUNK);
        mylist->next = NULL;
        mylist->payload = ((char*)mylist) + sizeof(struct CHUNK);
        initialized = 1;

        if (atexit(checkmemleak) != 0) {
            printf("Failed to register the memleakcheck  function with atexit\n");
            exit (2);
        }
    }
}


void* mymalloc(size_t size, char *file, int line)
{
    if (!initialized)
       init();
    size_t newSize = size;
    if (size % ALIGNMENT != 0)
       newSize = size + (size % ALIGNMENT);

    struct CHUNK* tmp = mylist;
    int used_mem = 0;
    int biggest_block = 0;
    int allocation_count = 0;
    while (tmp != NULL)
    {
    if (tmp->is_used == 0 && tmp->size == newSize)
    {
        tmp->is_used = 1;
        return tmp->payload;
    }

    else if (tmp->is_used == 0 && tmp->size > newSize + sizeof(struct CHUNK))
    {

        
        void* ptr = (void*)(tmp);
        ptr = (char *) ptr + sizeof(struct CHUNK) + newSize;
        struct CHUNK* newNode = (struct CHUNK*)ptr;
        newNode->size = tmp->size - (newSize + (sizeof(struct CHUNK)));
        newNode->is_used = 0;
        newNode->next = tmp->next;
        newNode->payload = ((char*)newNode) + sizeof(struct CHUNK);

        tmp->is_used = 1;
        tmp->size = newSize;
        tmp->next = newNode;

        return tmp->payload;
    }
    else if (tmp->is_used)
    {
        if (tmp->size > biggest_block)
        {
            biggest_block = tmp->size;
        }
        ++allocation_count;
        used_mem += tmp->size + (allocation_count * sizeof(struct CHUNK));
    }
    tmp = tmp->next;
    }//while   
    if (tmp == NULL)
    {
    //printf("Memory not available: memory requested =  %ld and total memory used = %d plus header size = %d and biggest block available = %d\n", size, sizeof(struct CHUNK), used_mem, biggest_block);
        printf("Unable to allocate %ld bytes\n", size);
    }
    return NULL;
}


void compact_mem()
{
    struct CHUNK* tmp = mylist; 
    while (tmp != NULL)  
    {
        if (tmp->is_used == 0 && tmp->next != NULL && tmp->next->is_used == 0)
        {
           tmp->size = tmp->size + tmp->next->size + sizeof (struct CHUNK);
           tmp->next = tmp->next->next;
        }
        else
        {
            tmp = tmp->next;
        }
    }
}
void  myfree(void *ptr, char *file, int line)
{

    if (!initialized)
       init ();

    struct CHUNK* tmp = mylist;   
    char found = 0;
    while (tmp != NULL)
    {
        if (tmp->payload == ptr)
        {
            
            tmp->is_used = 0;
            found = 1;
            break;

        }
        else
           tmp = tmp->next;
        
    }
    if (found == 1)
       compact_mem();
    else
    {
        printf ("free: Inappropriate pointer (%s %d)\n", file, line);
	    exit (2);
    }
}
