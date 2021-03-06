import { AsyncIterator } from "./async.ts";

function* map<T, U>(gen: Iterable<T>, fn: (x: T) => U): Iterable<U> {
  for (const x of gen) {
    yield fn(x);
  }
}

function* flatMap<T, U>(
  gen: Iterable<T>,
  fn: (x: T) => Iterable<U>,
): Iterable<U> {
  for (const x of gen) {
    yield* fn(x);
  }
}

function* filter<T>(gen: Iterable<T>, fn: (x: T) => boolean): Iterable<T> {
  for (const x of gen) {
    if (fn(x)) {
      yield x;
    }
  }
}

function* filterType<T, U extends T>(
  gen: Iterable<T>,
  typeCheck: (x: T) => x is U,
): Iterable<U> {
  for (const x of gen) {
    if (typeCheck(x)) {
      yield x;
    }
  }
}

function* filterMap<T, U>(
  gen: Iterable<T>,
  fn: (x: T) => U | undefined,
): Iterable<U> {
  for (const x of gen) {
    const y = fn(x);
    if (y !== undefined) {
      yield y;
    }
  }
}

function* take<T>(gen: Iterable<T>, num: number): Iterable<T> {
  let i = 0;
  for (const x of gen) {
    if (i < num) {
      yield x;
      i += 1;
    } else {
      break;
    }
  }
}

function* takeWhile<T>(gen: Iterable<T>, fn: (x: T) => boolean): Iterable<T> {
  for (const x of gen) {
    if (fn(x)) {
      yield x;
    } else {
      break;
    }
  }
}

function* skip<T>(gen: Iterable<T>, num: number): Iterable<T> {
  let i = 0;
  for (const x of gen) {
    if (i >= num) {
      yield x;
    }
    i += 1;
  }
}

function* skipWhile<T>(gen: Iterable<T>, fn: (x: T) => boolean): Iterable<T> {
  let conditionMet = false;
  for (const x of gen) {
    if (conditionMet || fn(x)) {
      yield x;
      conditionMet = true;
    }
  }
}

function* use<T>(gen: Iterable<T>, fn: (x: T) => void): Iterable<T> {
  for (const x of gen) {
    fn(x);
    yield x;
  }
}

export interface IterableObject<T> {
  [key: string]: T;
}

function* iterateKeysInternal<T>(obj: IterableObject<T>): Iterable<string> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      yield key;
    }
  }
}

export function iterateKeys<T>(obj: IterableObject<T>): Iterator<string> {
  return Iterator.iterable(iterateKeysInternal(obj));
}

function* iterateArray<T>(array: T[]): Iterable<T> {
  for (let i = 0; i < array.length; i++) {
    yield array[i];
  }
}

function* iterateSet<T>(set: Set<T>): Iterable<T> {
  for (const x of set) {
    yield x;
  }
}

function* enumerate<T>(gen: Iterable<T>): Iterable<[T, number]> {
  let i = 0;
  for (const element of gen) {
    yield [element, i];
    i += 1;
  }
}

function* iterateReadonlyArray<T>(array: readonly T[]): Iterable<Readonly<T>> {
  for (const element of array) {
    yield element;
  }
}

function* range(low: number, high: number): Iterable<number> {
  for (let i = low; i < high; i++) {
    yield i;
  }
}

function* concatenate<T, U>(a: Iterable<T>, b: Iterable<U>): Iterable<T | U> {
  yield* a;
  yield* b;
}

async function* toAsync<T>(gen: Iterable<T>): AsyncIterable<T> {
  yield* gen;
}

function* zip<T, U>(a: Iterable<T>, b: Iterable<U>): Iterable<[T, U]> {
  const aGen = a[Symbol.iterator]();
  const bGen = b[Symbol.iterator]();

  while (true) {
    const aVal = aGen.next();
    const bVal = bGen.next();

    if (!(aVal.done || bVal.done)) {
      yield [aVal.value, bVal.value];
    } else {
      break;
    }
  }
}

export class Iterator<T> implements Iterable<T> {
  private generator: Iterable<T>;

  constructor(generator: Iterable<T>) {
    if (generator instanceof Array) {
      this.generator = iterateArray(generator);
    } else if (generator instanceof Set) {
      this.generator = iterateSet(generator);
    } else {
      this.generator = generator;
    }
  }

  public static keys<T>(obj: IterableObject<T>): Iterator<string> {
    return Iterator.iterable(iterateKeysInternal(obj));
  }

  public static values<T>(obj: IterableObject<T>): Iterator<T> {
    return Iterator.keys(obj).map((key) => obj[key]);
  }

  public static entries<T>(obj: IterableObject<T>): Iterator<[string, T]> {
    return Iterator.keys(obj).map((key) => [key, obj[key]]);
  }

  public static array<T>(array: T[]): Iterator<T> {
    return Iterator.iterable(iterateArray(array));
  }

  public static readonlyArray<T>(array: readonly T[]): Iterator<Readonly<T>> {
    return Iterator.iterable(iterateReadonlyArray(array));
  }

  public static set<T>(set: Set<T>): Iterator<T> {
    return Iterator.iterable(iterateSet(set));
  }

  public static iterable<T>(gen: Iterable<T>): Iterator<T> {
    return new Iterator(gen);
  }

  public static range(low: number, high: number): Iterator<number> {
    return Iterator.iterable(range(low, high));
  }

  public *[Symbol.iterator](): Generator<T> {
    for (const x of this.generator) {
      yield x;
    }
  }

  public concatenate<U>(other: Iterable<U>): Iterator<T | U> {
    return Iterator.iterable(concatenate(this, other));
  }

  public enumerate(): Iterator<[T, number]> {
    return Iterator.iterable(enumerate(this.generator));
  }

  public map<U>(fn: (x: T) => U): Iterator<U> {
    return Iterator.iterable(map(this.generator, fn));
  }

  public flatMap<U>(fn: (x: T) => Iterable<U>): Iterator<U> {
    return Iterator.iterable(flatMap(this.generator, fn));
  }

  public filter(fn: (x: T) => boolean): Iterator<T> {
    return Iterator.iterable(filter(this.generator, fn));
  }

  public filterType<U extends T>(fn: (x: T) => x is U): Iterator<U> {
    return Iterator.iterable(filterType(this.generator, fn));
  }

  public filterMap<U>(fn: (x: T) => U | undefined): Iterator<U> {
    return Iterator.iterable(filterMap(this.generator, fn));
  }

  public fold<U>(initial: U, fn: (acc: U, x: T) => U): U {
    let output = initial;
    for (const x of this.generator) {
      output = fn(output, x);
    }
    return output;
  }

  /**
   * Produces a new Iterator.iterable which yields some number of elements from the
   * beginning of this Iterator.iterable.
   * @param amount The number of elements to take
   */
  public take(amount: number): Iterator<T> {
    return Iterator.iterable(take(this.generator, amount));
  }

  /**
   * Produces a new Iterator.iterable which yields values until one does not satisfy
   * the given predicate. The first value not to satisfy the given predicate is
   * not included in the new Iterator.iterable.
   * @param fn A predicate function
   */
  public takeWhile(fn: (x: T) => boolean): Iterator<T> {
    return Iterator.iterable(takeWhile(this.generator, fn));
  }

  /**
   * Produces a new Iterator.iterable which ignores some number of elements at the
   * beginning.
   * @param amount The number of elements to skip
   */
  public skip(amount: number): Iterator<T> {
    return Iterator.iterable(skip(this.generator, amount));
  }

  /**
   * Produces a new Iterator.iterable which ignores elements of this Iterator.iterable while a
   * given predicate holds. The first element of the new Iterator.iterable will be the
   * first element which does not satisfy the given predicate.
   * @param fn A predicate function
   */
  public skipWhile(fn: (x: T) => boolean): Iterator<T> {
    return Iterator.iterable(skipWhile(this.generator, fn));
  }

  /**
   * Produces a new Iterator.iterable which executes the specified function on each
   * element before yielding it.
   * @param fn A function
   */
  public use(fn: (x: T) => void): Iterator<T> {
    return Iterator.iterable(use(this.generator, fn));
  }

  /**
   * Executes the specified function once on each element of this Iterator.iterable.
   * @param fn A function
   */
  public forEach(fn: (x: T) => void): void {
    for (const x of this.generator) {
      fn(x);
    }
  }

  /**
   * Produces an array containing all elements of this Iterator.iterable.
   */
  public toArray(): T[] {
    const arr = [];
    for (const x of this.generator) {
      arr.push(x);
    }
    return arr;
  }

  /**
   * Determines whether at least one element of this Iterator.iterable satisfies the
   * given predicate.
   * @param fn A predicate function
   */
  public any(fn: (x: T) => boolean): boolean {
    return !!this.find(fn);
  }

  /**
   * Determines whether every element of this Iterator.iterable satisfies the given
   * predicate.
   * @param fn A predicate function
   */
  public all(fn: (x: T) => boolean): boolean {
    return !this.any((x) => !fn(x));
  }

  /**
   * Produces the first element of this Iterator.iterable that satisfies the given predicate.
   * @param fn A predicate function
   */
  public find(fn: (x: T) => boolean): T | undefined {
    return this.filter(fn).first();
  }

  public first(): T | undefined {
    for (const x of this.generator) {
      return x;
    }
  }

  public count(): number {
    let count = 0;
    this.forEach(() => {
      count += 1;
    });
    return count;
  }

  public zip<U>(b: Iterable<U>): Iterator<[T, U]> {
    return Iterator.iterable(zip(this.generator, b));
  }

  public toAsync(): AsyncIterator<T> {
    return AsyncIterator.iterable(toAsync(this.generator));
  }
}
