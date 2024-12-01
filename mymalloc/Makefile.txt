all: myheap

myheap: memtest.o libmylib.a
	gcc -o myheap memtest.o -L. -lmylib -lm

memtest.o: memtest.c 
	gcc -o memtest.o -c memtest.c 

mymalloc.o: mymalloc.c 
	gcc -o mymalloc.o -c -shared mymalloc.c


libmylib.a: mymalloc.o 
	ar rcs libmylib.a mymalloc.o

libs: libmylib.a

clean:
	rm -f myheap *.o *.a *.gch #This way is cleaner than your clean
