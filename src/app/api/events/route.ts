import { getSession } from "@/lib/auth";
import { pool } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const client = await pool.connect();
  await client.query("LISTEN crown_updates");
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let notificationHandler:
    | ((message: { payload?: string }) => void)
    | undefined;

  const close = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (notificationHandler) client.off("notification", notificationHandler);
    try {
      await client.query("UNLISTEN crown_updates");
    } catch {
      // The connection may already be closed when the browser disconnects.
    } finally {
      client.release();
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));
      notificationHandler = (message: { payload?: string }) => {
        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${message.payload ?? "{}"}\n\n`),
          );
        } catch {
          // The request cleanup below releases the database connection.
        }
      };

      client.on("notification", notificationHandler);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => void close(), {
        once: true,
      });
    },
    cancel() {
      void close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
