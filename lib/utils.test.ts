/**
 * lib/utils.ts 单元测试
 *
 * 使用 Node.js 内置的 node:test + node:assert，无需额外依赖。
 * 运行方式：node --test --import tsx lib/utils.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateUUID,
  sanitizeText,
  fetchWithTimeout,
} from "./utils";

describe("generateUUID", () => {
  it("应生成符合 UUID v4 格式的字符串", () => {
    const uuid = generateUUID();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("应生成唯一的 UUID", () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID());
    }
    assert.equal(uuids.size, 1000);
  });
});

describe("sanitizeText", () => {
  it("应移除 <has_function_call> 标记", () => {
    assert.equal(sanitizeText("hello<has_function_call>world"), "helloworld");
  });

  it("应保留正常文本", () => {
    assert.equal(sanitizeText("hello world"), "hello world");
  });

  it("应处理空字符串", () => {
    assert.equal(sanitizeText(""), "");
  });
});

describe("fetchWithTimeout", () => {
  it("应在超时后抛出错误", async () => {
    await assert.rejects(
      async () => fetchWithTimeout("http://localhost:1", {}, 100),
      (err: unknown) => err instanceof Error,
    );
  });

  it("调用方传入 signal 时应直接使用", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      async () => fetchWithTimeout("http://localhost:1", { signal: controller.signal }, 5000),
      (err: unknown) => err instanceof Error,
    );
  });
});
