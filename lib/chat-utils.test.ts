/**
 * lib/chat-utils.ts 单元测试
 *
 * 使用 Node.js 内置的 node:test + node:assert，无需额外依赖。
 * 运行方式：node --test --import tsx lib/chat-utils.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateCharCount,
  estimateTokenCount,
  formatCount,
  extractMessageText,
} from "./chat-utils";
import type { ChatMessage } from "./types";

describe("estimateCharCount", () => {
  it("应统计中文字符数", () => {
    assert.equal(estimateCharCount("你好世界"), 4);
  });

  it("应去除空白字符后统计", () => {
    assert.equal(estimateCharCount("hello world"), 10);
  });

  it("应处理空字符串", () => {
    assert.equal(estimateCharCount(""), 0);
  });
});

describe("estimateTokenCount", () => {
  it("应估算中文 Token 数", () => {
    const result = estimateTokenCount("你好世界");
    assert.ok(result > 0);
  });

  it("应处理空字符串", () => {
    assert.equal(estimateTokenCount(""), 0);
  });
});

describe("formatCount", () => {
  it("应格式化小数字", () => {
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(999), "999");
  });

  it("应格式化大数字为 k", () => {
    assert.equal(formatCount(1000), "1.0k");
    assert.equal(formatCount(1234), "1.2k");
  });
});

describe("extractMessageText", () => {
  it("应从消息中提取文本", () => {
    const message = {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text: "hello world" }],
    } as unknown as ChatMessage;

    assert.equal(extractMessageText(message), "hello world");
  });

  it("应合并多个文本部分", () => {
    const message = {
      id: "msg-1",
      role: "user",
      parts: [
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    } as unknown as ChatMessage;

    assert.equal(extractMessageText(message), "hello\nworld");
  });

  it("应忽略非文本部分", () => {
    const message = {
      id: "msg-1",
      role: "user",
      parts: [
        { type: "text", text: "hello" },
        { type: "file", url: "http://example.com/file.pdf" },
      ],
    } as unknown as ChatMessage;

    assert.equal(extractMessageText(message), "hello");
  });

  it("应处理空 parts", () => {
    const message = {
      id: "msg-1",
      role: "user",
      parts: [],
    } as unknown as ChatMessage;

    assert.equal(extractMessageText(message), "");
  });

  it("应处理无 parts 的消息", () => {
    const message = {
      id: "msg-1",
      role: "user",
    } as unknown as ChatMessage;

    assert.equal(extractMessageText(message), "");
  });
});
