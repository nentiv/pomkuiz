type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

const ignoreOutcome = (): void => {};

function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.then(ignoreOutcome, ignoreOutcome);
    return run;
  };
}

function createKeyedSerialQueue(): <T>(key: string, task: () => Promise<T>) => Promise<T> {
  const queues = new Map<string, SerialQueue>();
  return (key, task) => {
    const queue = queues.get(key) ?? createSerialQueue();
    queues.set(key, queue);
    return queue(task);
  };
}

export { createKeyedSerialQueue, createSerialQueue, ignoreOutcome };
