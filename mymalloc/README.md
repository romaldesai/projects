# P1
mymalloc

Rushil Patel - rp1224
Romal Desai - rsd101


Test Plan:
Simple Allocation and Free:
Test allocating a block of memory, use it, and free it right after. This ensures that both mymalloc() and myfree() work without issues.
Check that mymalloc() doesn’t return NULL when there’s enough memory and that myfree() doesn’t throw any errors.

Multiple Allocations:
Allocate multiple blocks of different sizes and ensure each allocation gives a different, non-overlapping pointer.
This will test that mymalloc() is correctly handling available space and that chunks are well-managed.

Memory Fragmentation and Coalescing:
Allocate and free memory blocks in different patterns (e.g., free some but not others) and then try to allocate a larger block that would require coalescing smaller free chunks.
This ensures that myfree() correctly merges adjacent free chunks when possible.

Error Handling in Free:
Test freeing invalid pointers (such as freeing the same pointer twice, or freeing pointers that weren’t returned by mymalloc()).
The program should print an error and exit with a status code of 2 when trying to free invalid memory.

Memory Leak Detection:
Run a program that allocates memory but does not free it. At the end of the program, the memory leak detection should kick in and print the number of leaked bytes and objects.

Test Programs:
Allocate a few small blocks and then free them right away to check basic functionality.
Allocate memory in different sizes, then free non-adjacent blocks. After that, it allocates a larger block to ensure that free chunks are being coalesced properly.
Try freeing pointers that were not allocated by mymalloc(), checks for double free, and ensures the program exits correctly when these errors occur.
Allocate memory without freeing it, and then exits. On exit, checkmemleak() should detect the leak and print out the amount of leaked memory.

Design Notes: n/a
