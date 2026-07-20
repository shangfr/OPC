/**
 * lib/ai/sms-service.ts 单元测试
 *
 * 使用 Node.js 内置的 node:test + node:assert，无需额外依赖。
 * 运行方式：node --test --import tsx lib/ai/sms-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateVerificationCode,
  isValidChinaPhone,
  normalizePhone,
} from "./sms-service";

describe("generateVerificationCode", () => {
  it("应生成 6 位数字验证码", () => {
    const code = generateVerificationCode();
    assert.match(code, /^\d{6}$/);
  });

  it("应生成不同的验证码（概率性）", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateVerificationCode());
    }
    assert.ok(codes.size > 90);
  });
});

describe("isValidChinaPhone", () => {
  it("应接受有效的中国大陆手机号", () => {
    assert.equal(isValidChinaPhone("13800138000"), true);
    assert.equal(isValidChinaPhone("15912345678"), true);
    assert.equal(isValidChinaPhone("18600000000"), true);
  });

  it("应拒绝无效的手机号格式", () => {
    assert.equal(isValidChinaPhone("12345678901"), false);
    assert.equal(isValidChinaPhone("1380013800"), false);
    assert.equal(isValidChinaPhone("138001380001"), false);
    assert.equal(isValidChinaPhone("abc12345678"), false);
    assert.equal(isValidChinaPhone(""), false);
  });

  it("应处理带空格和横线的手机号", () => {
    assert.equal(isValidChinaPhone("138-0013-8000"), true);
    assert.equal(isValidChinaPhone("138 0013 8000"), true);
  });
});

describe("normalizePhone", () => {
  it("应去除空格和横线", () => {
    assert.equal(normalizePhone("138-0013-8000"), "13800138000");
    assert.equal(normalizePhone("138 0013 8000"), "13800138000");
  });

  it("应去除 +86 前缀", () => {
    assert.equal(normalizePhone("+8613800138000"), "13800138000");
  });

  it("应保留无前缀的手机号", () => {
    assert.equal(normalizePhone("13800138000"), "13800138000");
  });
});
