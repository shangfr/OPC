'use client';
import { useState } from 'react';
// 定义数据类型
interface SupplyDemandData {
  demand_type: string;
  content: string;
  category: string | null;
  goods_name: string | null;
  material: string | null;
  spec: string | null;
  quantity: number | string | null;
  month_quantity: number | string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  province: string | null;
  city: string | null;
  delivery_days: number | string | null;
  pay_type: number | string | null;
  min_order: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}
// 付款方式字典
const PAY_TYPE_OPTIONS = [
  { value: '0', label: '现款现货' },
  { value: '1', label: '预付20%' },
  { value: '2', label: '预付30%' },
  { value: '3', label: '货到付款' },
  { value: '4', label: '半月结' },
  { value: '5', label: '月结30天' },
  { value: '6', label: '全款装车' },
];
// 🔥 指定供需处理专家的 Agent ID 和默认模型 (请替换为你的真实配置)
const SUPPLY_DEMAND_AGENT_ID = "9707de0b-e7cd-5e6f-8d94-2bc13126edcf"; 
const DEFAULT_CHAT_MODEL = "deepseek-v4-flash"; 
export default function SupplyDemandEditor() {
  // --- 状态声明 ---
  const [rawText, setRawText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SupplyDemandData | null>(null);
  // 1. 调用统一的 /api/chat 接口，通过指定 agentId 让 Agent 解析
  const handleParse = async () => {
    if (!rawText.trim()) return alert('请输入供需描述');
    setIsLoading(true);
    setFormData(null);
    try {
      const chatId = crypto.randomUUID();
      const messageId = crypto.randomUUID();
      const requestBody = {
        id: chatId,
        message: {
          id: messageId,
          role: "user",
          parts: [{ type: "text", text: rawText }],
          attachments: [], // 🔥 必须补上此字段，否则 schema 校验报 400
        },
        selectedChatModel: DEFAULT_CHAT_MODEL,
        selectedVisibilityType: "private",
        isNewChat: true,
        agentId: SUPPLY_DEMAND_AGENT_ID,
        thinkingEnabled: false
      };
      console.log("🚀 [1] 发起请求，请求体:", requestBody);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      console.log("🚀 [2] 收到响应，HTTP 状态码:", res.status);
      if (!res.ok || !res.body) {
        const errText = await res.text();
        console.error("❌ [2-Err] HTTP 请求失败，错误信息:", errText);
        throw new Error(`网络请求失败: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawStreamData = '';
      console.log("🚀 [3] 开始读取流式数据...");
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("🚀 [3] 流读取完毕。");
          break;
        }
        rawStreamData += decoder.decode(value, { stream: true });
      }
      console.log("🚀 [4] 完整的原始流数据:\n", rawStreamData);
      // 🔥 新的健壮提取逻辑：逐行解析 SSE 数据
      const lines = rawStreamData.split('\n');
      let resultText = '';
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.slice(6); // 去掉 "data: " 前缀
          try {
            const parsed = JSON.parse(jsonStr);
            // 兼容不同版本的 Vercel AI SDK 流格式
            if (parsed.type === 'text-delta') {
              resultText += parsed.textDelta || parsed.delta || '';
            }
          } catch (e) {
            // 如果 JSON.parse 失败，可能是底层协议格式如 `0:"文本片段"`
            if (jsonStr.startsWith('0:')) {
              try {
                const text = JSON.parse(jsonStr.slice(2));
                resultText += text;
              } catch (err) {
                // 忽略无法解析的片段
              }
            }
          }
        }
      }
      console.log("🚀 [5] 解析提取并拼接后的纯文本:\n", resultText);
      // 如果没有提取到任何文本，说明大模型可能报错了或返回了其他格式
      if (!resultText) {
        console.error("❌ [5-Err] 未提取到任何文本，请检查上方 [4] 的原始流数据格式。");
        throw new Error('AI 未返回有效数据，请查看控制台日志');
      }
      // 清理大模型可能违规输出的 Markdown 标记，并提取纯 JSON
      const cleanText = resultText.replace(/```json|```/g, '').trim();
      console.log("🚀 [6] 清理 Markdown 后的文本:\n", cleanText);
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ [6-Err] 未找到 JSON 结构，请检查上方 [5] 的文本内容。");
        throw new Error('AI 返回的内容不是合法的 JSON 格式');
      }
      console.log("🚀 [7] 提取到的 JSON 字符串:\n", jsonMatch[0]);
      const data = JSON.parse(jsonMatch[0]);
      console.log("🚀 [8] JSON 解析成功，对象数据:", data);
      // 显式处理每个字段，将 null 转换为空字符串，避免 React input 报错
      const sanitizedData: SupplyDemandData = {
        demand_type: data.demand_type || 'supply',
        content: data.content || '',
        category: data.category || '',
        goods_name: data.goods_name || '',
        material: data.material || '',
        spec: data.spec || '',
        quantity: data.quantity ?? '',
        month_quantity: data.month_quantity ?? '',
        price_min: data.price_min ?? '',
        price_max: data.price_max ?? '',
        province: data.province || '',
        city: data.city || '',
        delivery_days: data.delivery_days ?? '',
        pay_type: data.pay_type ?? '',
        min_order: data.min_order || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
      };
      console.log("🚀 [9] 最终处理后的表单数据:", sanitizedData);
      setFormData(sanitizedData);
    } catch (error) {
      console.error("❌ [全局错误] 解析失败:", error);
      alert(error instanceof Error ? error.message : 'AI解析失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };
  // 2. 表单输入变更处理
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };
  // 3. 确认提交写入数据库
  const handleSubmitToDB = async () => {
    if (!formData) return;
    try {
      const res = await fetch('/api/save-supply-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert('发布成功！');
        setFormData(null);
        setRawText(''); // 清空输入框
      } else {
        alert('入库失败，请检查接口');
      }
    } catch (error) {
      alert('入库失败，请检查网络');
    }
  };
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 区域 1：原始文本输入 */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-bold mb-4 text-gray-800">发布供需信息</h2>
        <textarea
          className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          rows={4}
          placeholder="例如：卖 山东热轧板 5个厚 一吨起 现款 4500一吨 联系人张三 13812345678"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <button
          onClick={handleParse}
          disabled={isLoading}
          className="mt-3 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'AI 解析中...' : 'AI 智能解析与润色'}
        </button>
      </div>
      {/* 区域 2：可编辑的确认表单 */}
      {formData && (
        <div className="bg-white p-6 rounded-lg shadow border space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">核对并确认信息</h2>
            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              {formData.demand_type === 'supply' ? '供应信息' : '求购信息'}
            </span>
          </div>
          {/* 润色后的文本展示与编辑 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">润色后的发布文案</label>
            <textarea
              name="content"
              className="w-full p-3 border rounded bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              value={formData.content || ''}
              onChange={handleChange}
            />
          </div>
          {/* 交易核心参数 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="品名" name="goods_name" value={formData.goods_name} onChange={handleChange} />
            <FormField label="类目" name="category" value={formData.category} onChange={handleChange} />
            <FormField label="材质" name="material" value={formData.material} onChange={handleChange} />
            <FormField label="规格" name="spec" value={formData.spec} onChange={handleChange} />
            <FormField label="单次数量" name="quantity" type="number" value={formData.quantity} onChange={handleChange} />
            <FormField label="月供量" name="month_quantity" type="number" value={formData.month_quantity} onChange={handleChange} />
            <FormField label="最低价" name="price_min" type="number" value={formData.price_min} onChange={handleChange} />
            <FormField label="最高价" name="price_max" type="number" value={formData.price_max} onChange={handleChange} />
          </div>
          {/* 物流与付款参数 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="省份" name="province" value={formData.province} onChange={handleChange} />
            <FormField label="城市" name="city" value={formData.city} onChange={handleChange} />
            <FormField label="交货天数" name="delivery_days" type="number" value={formData.delivery_days} onChange={handleChange} />
            <FormField label="最小起订量" name="min_order" value={formData.min_order} onChange={handleChange} />
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">付款方式</label>
              <select
                name="pay_type"
                className="p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.pay_type ?? ''}
                onChange={handleChange}
              >
                <option value="">请选择</option>
                {PAY_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* 联系人信息 */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="联系人" name="contact_name" value={formData.contact_name} onChange={handleChange} />
            <FormField label="联系电话" name="contact_phone" value={formData.contact_phone} onChange={handleChange} />
          </div>
          {/* 操作按钮 */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              onClick={() => setFormData(null)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              重新输入
            </button>
            <button
              onClick={handleSubmitToDB}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              确认无误，提交入库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// 抽取的通用输入框组件
function FormField({ label, name, value, onChange, type = 'text' }: { 
  label: string; 
  name: string; 
  value: string | number | null | undefined; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  type?: string 
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        className="p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
        value={value ?? ''}
        onChange={onChange}
      />
    </div>
  );
}