import { assertEquals } from "https://deno.land/std@0.99.0/testing/asserts.ts";
import { Iterator } from "../mod.ts";

Deno.test("generator iterator", () => {
  function* fibs(): Iterable<number> {
    let a = 0;
    let b = 1;
    while (true) {
      yield a;
      const temp = a;
      a = b;
      b = temp + b;
    }
  }

  const sumOfFirstTenEvenFibs = Iterator.iterable(fibs())
    .filter((x) => x % 2 == 0)
    .take(10)
    .fold(0, (total, num) => total + num);
  assertEquals(sumOfFirstTenEvenFibs, 257114);
});
