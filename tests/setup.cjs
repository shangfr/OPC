"use strict";
/**
 * 测试环境初始化（CommonJS 格式，避免 tsx 转换问题）
 *
 * mock 掉 server-only 包，使其在 node:test 环境下不报错。
 */

const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
