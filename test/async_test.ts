import { assertEquals } from "https://deno.land/std@0.99.0/testing/asserts.ts";
import { AsyncIterator } from "../mod.ts";

Deno.test("async fibonacci generator", async () => {
  const fibs = AsyncIterator.build<number>(async ({ $yield }) => {
    let a = 0;
    let b = 1;
    while (true) {
      await $yield(a);
      const temp = a;
      a = b;
      b = b + temp;
    }
  });

  let timesCompleted = 0;
  fibs.onComplete = () => {
    timesCompleted += 1;
  };

  const sumOfFirstTenEvenFibs = await fibs
    .filter((x) => x % 2 == 0)
    .take(10)
    .fold(
      0,
      (total, num) => total + num,
    );
  assertEquals(sumOfFirstTenEvenFibs, 257114);

  assertEquals(timesCompleted, 1);
});
