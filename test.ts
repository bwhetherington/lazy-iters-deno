import { AsyncIterator } from './mod.ts';

const fibs = AsyncIterator.from(async ({ $yield }) => {
  let a = 0;
  let b = 1;
  while (true) {
    await $yield(a);
    const temp = a;
    a = b;
    b = b + temp;
  }
});

for await (const x of fibs.take(10)) {
  console.log(x);
}

// await fibs.take(10).forEach(console.log);