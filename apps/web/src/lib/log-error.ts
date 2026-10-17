// Next.js 15.2+ dev overlay pops a developer "Console Error" stack-trace popup
// for every console.error call — even when the error is already caught and the
// user already sees a friendly toast. Expected/handled API failures (4xx like
// "This slug is already taken") must therefore never use console.error:
// logHandledError keeps the details in devtools (console.warn, dev only)
// without interrupting non-developer users.
export function logHandledError(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
}
