import { tool } from "ai";
import { z } from "zod";

/**
 * AI 工具：代码执行（沙箱）
 *
 * 在隔离的 Node.js vm 沙箱中执行 JavaScript 代码，
 * 支持数学计算、数据处理、逻辑验证等场景。
 *
 * 对标：Coze 的「代码」插件、Dify 的「代码执行」节点
 * 安全：使用 vm 模块创建沙箱，限制可用 API，设置执行超时
 */
export const codeInterpreter = tool({
  description:
    "Execute JavaScript code in a sandboxed environment. Use this for mathematical calculations, data processing, string manipulation, or any logic that requires code execution. The code runs in an isolated Node.js VM sandbox with a 5-second timeout. Available globals: Math, JSON, Date, console (output captured). No file system, no network, no require.",
  inputSchema: z.object({
    code: z.string().describe("JavaScript code to execute. Use console.log() to output results. Available: Math, JSON, Date, console."),
  }),
  execute: async ({ code }) => {
    try {
      const vm = await import("node:vm");

      const logs: string[] = [];
      const sandbox = {
        console: {
          log: (...args: unknown[]) => {
            logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
          },
          error: (...args: unknown[]) => {
            logs.push("[ERROR] " + args.map((a) => String(a)).join(" "));
          },
          warn: (...args: unknown[]) => {
            logs.push("[WARN] " + args.map((a) => String(a)).join(" "));
          },
        },
        Math,
        JSON,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        String,
        Number,
        Boolean,
        Array,
        Object,
      };

      const context = vm.createContext(sandbox);
      const script = new vm.Script(code, { filename: "sandbox.js" });

      let result: unknown;
      try {
        result = script.runInContext(context, { timeout: 5000 });
      } catch (execError) {
        return {
          success: false,
          error: execError instanceof Error ? execError.message : String(execError),
          stdout: logs.join("\n"),
        };
      }

      const resultStr =
        result === undefined
          ? logs.join("\n")
          : typeof result === "object"
            ? JSON.stringify(result, null, 2)
            : String(result);

      return {
        success: true,
        result: resultStr,
        stdout: logs.join("\n"),
      };
    } catch {
      return {
        success: false,
        error: "代码执行环境初始化失败",
        stdout: "",
      };
    }
  },
});
