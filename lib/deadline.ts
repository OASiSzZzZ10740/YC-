export async function beforeDeadline<T>(work: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('deadline_exceeded')), Math.max(0, deadline - Date.now()));
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
