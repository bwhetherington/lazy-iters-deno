type MaybePromise<T> = T | Promise<T>;

type MaybeAsyncIterable<T> = AsyncIterable<T> | Iterable<T>;

async function* map<T, U>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<U>,
): AsyncIterable<U> {
  for await (const x of gen) {
    yield await fn(x);
  }
}

async function* flatMap<T, U>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybeAsyncIterable<U>,
): AsyncIterable<U> {
  for await (const x of gen) {
    yield* fn(x);
  }
}

async function* filter<T>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<boolean>,
): AsyncIterable<T> {
  for await (const x of gen) {
    if (await fn(x)) {
      yield x;
    }
  }
}

async function* filterType<T, U extends T>(
  gen: AsyncIterable<T>,
  typeCheck: (x: T) => x is U,
): AsyncIterable<U> {
  for await (const x of gen) {
    if (typeCheck(x)) {
      yield x;
    }
  }
}

async function* filterMap<T, U>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<U | undefined>,
): AsyncIterable<U> {
  for await (const x of gen) {
    const y = await fn(x);
    if (y !== undefined) {
      yield y;
    }
  }
}

async function* take<T>(gen: AsyncIterable<T>, num: number): AsyncIterable<T> {
  let i = 0;
  for await (const x of gen) {
    if (i < num) {
      yield x;
      i += 1;

      // Immediately stop if this was the last iteration
      if (i == num) {
        return;
      }
    } else {
      break;
    }
  }
}

async function* takeWhile<T>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<boolean>,
): AsyncIterable<T> {
  for await (const x of gen) {
    if (await fn(x)) {
      yield x;
    } else {
      break;
    }
  }
}

async function* skip<T>(gen: AsyncIterable<T>, num: number): AsyncIterable<T> {
  let i = 0;
  for await (const x of gen) {
    if (i >= num) {
      yield x;
    }
    i += 1;
  }
}

async function* skipWhile<T>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<boolean>,
): AsyncIterable<T> {
  let conditionMet = false;
  for await (const x of gen) {
    if (conditionMet || (await fn(x))) {
      yield x;
      conditionMet = true;
    }
  }
}

async function* use<T>(
  gen: AsyncIterable<T>,
  fn: (x: T) => MaybePromise<void>,
): AsyncIterable<T> {
  for await (const x of gen) {
    fn(x);
    yield x;
  }
}

async function* enumerate<T>(
  gen: AsyncIterable<T>,
): AsyncIterable<[T, number]> {
  let i = 0;
  for await (const element of gen) {
    yield [element, i];
    i += 1;
  }
}

async function* zip<T, U>(
  a: AsyncIterable<T>,
  b: AsyncIterable<U>,
): AsyncIterable<[T, U]> {
  const aGen = a[Symbol.asyncIterator]();
  const bGen = b[Symbol.asyncIterator]();

  while (true) {
    const [aVal, bVal] = await Promise.all([aGen.next(), bGen.next()]);

    if (!(aVal.done || bVal.done)) {
      yield [aVal.value, bVal.value];
    } else {
      break;
    }
  }
}

async function* debounce<T>(
  gen: AsyncIterable<T>,
  time: number,
): AsyncIterable<T> {
  const timeMs = time * 1000;
  let lastTime = Date.now();

  for await (const x of gen) {
    const currentTime = Date.now();
    if (currentTime - lastTime >= timeMs) {
      lastTime = currentTime;
      yield x;
    }
  }
}

interface IteratorFunctions<T> {
  $yield(arg: T): Promise<void>;
  $yieldAll(args: Iterable<T>): Promise<void>;
  $return(): Promise<void>;
}

function buildIterator<T>(
  body: (fns: IteratorFunctions<T>) => void,
): AsyncIterable<T> {
  let yieldQueue: T[] = [];
  let resolver = (_?: void) => {};
  let yieldResolver = (_?: void) => {};
  let guard = new Promise<void>((resolve) => {
    resolver = resolve;
  });
  let yieldGuard = new Promise<void>((resolve) => {
    yieldResolver = resolve;
  });
  let isRunning = true;

  const $yield = async (arg: T) => {
    yieldQueue.push(arg);
    resolver();
    guard = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    await yieldGuard;
  };

  const $return = async () => {
    resolver();
    isRunning = false;
    await yieldGuard;
  };

  const $yieldAll = async (iterable: Iterable<T>) => {
    for (const x of iterable) {
      await $yield(x);
    }
  };

  body({ $yield, $yieldAll, $return });

  return (async function* () {
    while (isRunning) {
      for (const val of yieldQueue) {
        yield val;
      }
      yieldResolver();
      yieldGuard = new Promise((resolve) => {
        yieldResolver = resolve;
      });
      yieldQueue = [];
      await guard;
    }
  })();
}

export class AsyncIterator<T> implements AsyncIterable<T> {
  public onComplete?: () => void;

  private generator: AsyncIterable<T>;

  constructor(generator: AsyncIterable<T>, onComplete?: () => void) {
    this.generator = generator;
    this.onComplete = onComplete;
  }

  public static iterable<T>(
    generator: AsyncIterable<T>,
    onComplete?: () => void,
  ): AsyncIterator<T> {
    return new AsyncIterator(generator, onComplete);
  }

  public static build<T>(
    body: (fns: IteratorFunctions<T>) => void,
    onComplete?: () => void,
  ): AsyncIterator<T> {
    return AsyncIterator.iterable(buildIterator(body), onComplete);
  }

  public async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for await (const x of this.generator) {
      yield x;
    }
    this.cleanup();
  }

  private chain<U>(gen: AsyncIterable<U>): AsyncIterator<U> {
    return AsyncIterator.iterable(gen, this.onComplete);
  }

  public debounce(time: number): AsyncIterator<T> {
    return this.chain(debounce(this, time));
  }

  public enumerate(): AsyncIterator<[T, number]> {
    return this.chain(enumerate(this));
  }

  public map<U>(fn: (x: T) => MaybePromise<U>): AsyncIterator<U> {
    return this.chain(map(this, fn));
  }

  public flatMap<U>(fn: (x: T) => MaybeAsyncIterable<U>): AsyncIterator<U> {
    return this.chain(flatMap(this, fn));
  }

  public filter(fn: (x: T) => MaybePromise<boolean>): AsyncIterator<T> {
    return this.chain(filter(this, fn));
  }

  public filterType<U extends T>(fn: (x: T) => x is U): AsyncIterator<U> {
    return this.chain(filterType(this, fn));
  }

  public filterMap<U>(
    fn: (x: T) => MaybePromise<U | undefined>,
  ): AsyncIterator<U> {
    return this.chain(filterMap(this, fn));
  }

  public async fold<U>(
    initial: U,
    fn: (acc: U, x: T) => MaybePromise<U>,
  ): Promise<U> {
    let output = initial;
    for await (const x of this) {
      output = await fn(output, x);
    }
    return output;
  }

  public join<U>(other: AsyncIterator<U>): AsyncIterator<T | U> {
    const iter = AsyncIterator.build<T | U>(async ({ $yield }) => {
      const thisPromise = (async () => {
        for await (const x of this) {
          await $yield(x);
        }
      })();
      const otherPromise = (async () => {
        for await (const y of other) {
          await $yield(y);
        }
      })();
      await Promise.all([thisPromise, otherPromise]);
    });

    iter.onComplete = () => {
      this.onComplete?.();
      other.onComplete?.();
    };

    return iter;
  }

  /**
   * Produces a new iterator which yields some number of elements from the
   * beginning of this iterator.
   * @param amount The number of elements to take
   */
  public take(amount: number): AsyncIterator<T> {
    return this.chain(take(this, amount));
  }

  /**
   * Produces a new iterator which yields values until one does not satisfy
   * the given predicate. The first value not to satisfy the given predicate is
   * not included in the new iterator.
   * @param fn A predicate function
   */
  public takeWhile(fn: (x: T) => MaybePromise<boolean>): AsyncIterator<T> {
    return this.chain(takeWhile(this, fn));
  }

  /**
   * Produces a new iterator which ignores some number of elements at the
   * beginning.
   * @param amount The number of elements to skip
   */
  public skip(amount: number): AsyncIterator<T> {
    return this.chain(skip(this, amount));
  }

  /**
   * Produces a new iterator which ignores elements of this iterator while a
   * given predicate holds. The first element of the new iterator will be the
   * first element which does not satisfy the given predicate.
   * @param fn A predicate function
   */
  public skipWhile(fn: (x: T) => MaybePromise<boolean>): AsyncIterator<T> {
    return this.chain(skipWhile(this, fn));
  }

  /**
   * Produces a new iterator which executes the specified function on each
   * element before yielding it.
   * @param fn A function
   */
  public use(fn: (x: T) => MaybePromise<void>): AsyncIterator<T> {
    return this.chain(use(this, fn));
  }

  /**
   * Executes the specified function once on each element of this iterator.
   * @param fn A function
   */
  public async forEach(fn: (x: T) => MaybePromise<void>): Promise<void> {
    for await (const x of this) {
      fn(x);
    }
  }

  /**
   * Produces an array containing all elements of this iterator.
   */
  public async toArray(): Promise<T[]> {
    const arr = [];
    for await (const x of this) {
      arr.push(x);
    }
    return arr;
  }

  /**
   * Determines whether at least one element of this iterator satisfies the
   * given predicate.
   * @param fn A predicate function
   */
  public async any(fn: (x: T) => MaybePromise<boolean>): Promise<boolean> {
    const res = !!(await this.find(fn));
    return res;
  }

  /**
   * Determines whether every element of this iterator satisfies the given
   * predicate.
   * @param fn A predicate function
   */
  public async all(fn: (x: T) => MaybePromise<boolean>): Promise<boolean> {
    const didAnyFail = await this.any(async (x) => !(await fn(x)));
    return !didAnyFail;
  }

  /**
   * Produces the first element of this iterator that satisfies the given predicate.
   * @param fn A predicate function
   */
  public find(fn: (x: T) => MaybePromise<boolean>): Promise<T | undefined> {
    return this.filter(fn).first();
  }

  public async first(): Promise<T | undefined> {
    for await (const x of this) {
      return x;
    }
  }

  public async count(): Promise<number> {
    let count = 0;
    await this.forEach(() => {
      count += 1;
    });
    return count;
  }

  public drain(): Promise<void> {
    return this.forEach(() => {});
  }

  public zip<U>(b: AsyncIterable<U>): AsyncIterator<[T, U]> {
    return AsyncIterator.iterable(zip(this, b));
  }

  private cleanup(): void {
    this.onComplete?.();
  }
}
