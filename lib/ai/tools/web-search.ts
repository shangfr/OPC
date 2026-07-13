import { tool } from "ai";
import { z } from "zod";

/**
 * AI 工具：网页搜索
 *
 * 使用 DuckDuckGo Instant Answer API 进行免费网页搜索，
 * 无需 API Key，适合 SaaS 平台默认集成。
 *
 * 对标：Coze 的「搜索」插件、Dify 的「Web 搜索」工具
 */
export const webSearch = tool({
  description:
    "Search the web for real-time information. Use this when the user asks about current events, latest news, real-time data, or anything that requires up-to-date information beyond your training data. Returns a summary of search results with titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query, in the user's language"),
    maxResults: z.number().int().min(1).max(5).default(3).describe("Maximum number of results to return"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      // 使用 DuckDuckGo Instant Answer API（免费、无需 Key）
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "OPCBot/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return { results: [], error: "搜索服务暂时不可用" };
      }

      const data = await response.json();
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // 主结果
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }

      // 相关主题
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= maxResults) break;
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
          // 嵌套主题组
          if (topic.Topics && Array.isArray(topic.Topics)) {
            for (const subTopic of topic.Topics) {
              if (results.length >= maxResults) break;
              if (subTopic.Text && subTopic.FirstURL) {
                results.push({
                  title: subTopic.Text.split(" - ")[0] || subTopic.Text.slice(0, 50),
                  url: subTopic.FirstURL,
                  snippet: subTopic.Text,
                });
              }
            }
          }
        }
      }

      return { results, query };
    } catch {
      return { results: [], error: "搜索请求失败，请稍后重试" };
    }
  },
});
