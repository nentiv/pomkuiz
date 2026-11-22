import type { FastifyInstance, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import type { AppConfig } from "../config/app-config.ts";
import { AppError } from "../shared/app-error.ts";

const IPV6_HOST = /^\[([^\]]+)\](?::(\d+))?$/;
const HOST_WITH_PORT = /^([^:]+)(?::(\d+))?$/;

function assertLoopbackHost(host: string, loopbackHosts: readonly string[]): void {
  if (!loopbackHosts.includes(host)) throw new Error(`Refusing to listen on non-loopback host ${host}`);
}

function parseHostHeader(value: string | undefined): { hostname: string; port: number | null } | null {
  if (!value) return null;
  const match = IPV6_HOST.exec(value) ?? HOST_WITH_PORT.exec(value);
  if (!match?.[1]) return null;
  return { hostname: match[1].toLowerCase(), port: match[2] ? Number(match[2]) : null };
}

function isAllowedHost(value: string | undefined, server: AppConfig["server"], port: number): boolean {
  const host = parseHostHeader(value);
  return Boolean(host && server.allowedHostnames.includes(host.hostname) && host.port === port);
}

function isAllowedOrigin(origin: string, server: AppConfig["server"], port: number): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && server.allowedHostnames.includes(url.hostname) && Number(url.port) === port;
  } catch {
    return false;
  }
}

function rejectionReason(request: FastifyRequest, server: AppConfig["server"], port: number): AppError | undefined {
  if (!isAllowedHost(request.headers.host, server, port)) return new AppError("forbidden", "host");
  if (server.safeMethods.includes(request.method)) return undefined;
  if (request.headers[server.csrfHeader.name] !== server.csrfHeader.value) return new AppError("forbidden", "csrf");
  const origin = request.headers.origin;
  return origin !== undefined && !isAllowedOrigin(origin, server, port)
    ? new AppError("forbidden", "origin")
    : undefined;
}

function registerSecurity(app: FastifyInstance, server: AppConfig["server"], port: number): void {
  app.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
    done(rejectionReason(request, server, port));
  });
  app.addHook(
    "onSend",
    (
      _request: FastifyRequest,
      reply: FastifyReply,
      payload: unknown,
      done: (error: Error | null, payload: unknown) => void,
    ) => {
      for (const [name, value] of Object.entries(server.securityHeaders)) reply.header(name, value);
      done(null, payload);
    },
  );
}

export { assertLoopbackHost, registerSecurity };
