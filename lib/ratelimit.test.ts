/**
 * lib/ratelimit.ts 单元测试
 *
 * 使用 Node.js 内置的 node:test + node:assert，无需额外依赖。
 * 运行方式：node --test --import tsx lib/ratelimit.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "./ratelimit";

describe("getClientIp", () => {
  it("应从 cf-connecting-ip 提取 IP", () => {
    const request = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    assert.equal(getClientIp(request), "1.2.3.4");
  });

  it("应从 x-forwarded-for 提取第一个 IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    assert.equal(getClientIp(request), "1.2.3.4");
  });

  it("应从 x-real-ip 提取 IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    assert.equal(getClientIp(request), "1.2.3.4");
  });

  it("应优先使用 cf-connecting-ip", () => {
    const request = new Request("https://example.com", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "2.2.2.2",
        "x-real-ip": "3.3.3.3",
      },
    });
    assert.equal(getClientIp(request), "1.1.1.1");
  });

  it("无 IP header 时返回 undefined", () => {
    const request = new Request("https://example.com");
    assert.equal(getClientIp(request), undefined);
  });
});
