// queue.ts — FIFO串行，三端共用。不重试、不丢弃。
type Task<T> = () => Promise<T>;
export class FifoQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private depth = 0;
  enqueue<T>(task: Task<T>): Promise<T> {
    this.depth += 1;
    const run: Promise<T> = this.tail.then(task, task);
    this.tail = run.catch(() => {});
    return (run.finally(() => { this.depth = Math.max(0, this.depth - 1); }) as Promise<T>);
  }
  pending(): number { return this.depth; }
}
export const generateQueue = new FifoQueue();
