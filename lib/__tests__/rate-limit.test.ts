/**
 * @jest-environment node
 */
import { rateLimit } from "../rate-limit";

function makeReq(ip: string): Request {
  return new Request("http://test.local/api/x", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    const rl = rateLimit({ windowMs: 1000, max: 3, bucket: "test-allow" });
    const req = makeReq("1.1.1.1");
    expect(await rl.check(req)).toBeNull();
    expect(await rl.check(req)).toBeNull();
    expect(await rl.check(req)).toBeNull();
  });

  it("returns 429 when exceeded", async () => {
    const rl = rateLimit({ windowMs: 1000, max: 2, bucket: "test-block" });
    const req = makeReq("2.2.2.2");
    await rl.check(req);
    await rl.check(req);
    const res = await rl.check(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBeTruthy();
  });

  it("isolates buckets per IP", async () => {
    const rl = rateLimit({ windowMs: 1000, max: 1, bucket: "test-isolate" });
    expect(await rl.check(makeReq("3.3.3.3"))).toBeNull();
    // different IP gets its own bucket
    expect(await rl.check(makeReq("4.4.4.4"))).toBeNull();
  });

  it("resets a key on demand", async () => {
    const rl = rateLimit({ windowMs: 60_000, max: 1, bucket: "test-reset" });
    const req = makeReq("5.5.5.5");
    expect(await rl.check(req)).toBeNull();
    expect((await rl.check(req))?.status).toBe(429);
    rl.reset(req);
    expect(await rl.check(req)).toBeNull();
  });
});
