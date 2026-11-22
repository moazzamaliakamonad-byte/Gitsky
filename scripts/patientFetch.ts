/**
 * On a slow or flaky connection a request can drop mid-way. These are read-only GETs,
 * so retrying is safe: up to five tries, waiting a little longer each time.
 */
export async function patientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(input, init);
      // Read the body now, so a connection that drops mid-download is retried too.
      const body = await res.arrayBuffer();
      return new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch (e) {
      if (attempt >= 5) throw e;
      console.log(`  connection dropped, retrying (${attempt}/4)`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}
