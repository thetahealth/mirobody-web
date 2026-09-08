# 前端需求：渲染 `vis-chart` 代码块为交互式图表

> 面向前端开发的实现交接文档。后端已改造完成，现在需要前端把助手回复里的 ` ```vis-chart ` 代码块渲染成图表。

---

## 1. 背景：后端改了什么

旧方案：后端用 Node (`@antv/gpt-vis-ssr`) 在**服务端**把图表渲染成 PNG，再以 `image` 消息（`is_chart`）下发，前端用 `<img>` 显示。

新方案：删除了服务端画图工具，改为**模型在回复正文里直接输出 `vis-chart` 围栏代码块**（纯数据 JSON，无样式），由**前端**实时渲染成交互式图表。

助手回复（`reply` 类型，markdown）里会出现这样的块：

````markdown
您最近一周的心率趋势如下：

```vis-chart
{"type":"line","title":"心率趋势","axisXTitle":"日期","axisYTitle":"bpm","data":[{"time":"2025-11-08","value":72},{"time":"2025-11-09","value":68},{"time":"2025-11-10","value":70}]}
```

可以看到整体平稳。
````

前端要做的就是：**识别 `vis-chart` 这个代码块语言，把里面的 JSON 渲染成图表**，而不是当成普通代码块显示。

> ⚠️ 旧的 `image`（PNG）渲染路径**保留不动**——后端仍保留了相关管道，未来可能有"调用外部模型生成精细 PNG"的能力走这条路。本次只新增 `vis-chart` 文本块渲染，**不要动 `IMAGE` 类型的渲染逻辑**。

---

## 2. 数据协议（前后端约定的合同）

模型只输出**纯数据**，不含任何样式（颜色/网格/图例/tooltip 都由前端决定）。字段：

| 字段 | 说明 | 是否必填 |
| :--- | :--- | :--- |
| `type` | 图表类型：`line` / `area` / `column` / `bar` / `pie` / `scatter` / `radar` / `dual-axes` / `funnel` / `histogram` | ✅ |
| `title` | 图表标题 | 可选 |
| `axisXTitle` | X 轴标题 | 可选 |
| `axisYTitle` | Y 轴标题 | 可选 |
| `data` | 数据数组，形状随 `type` 变化（见下） | ✅ |

数据是 **tidy / 长表** 形式：

| type | `data` 形状 | 多系列 |
| :--- | :--- | :--- |
| `line` / `area` / `column` / `bar` | `[{time \| category, value, group?}]` | 用不同 `group` 值区分多条线/多组柱 |
| `pie` | `[{category, value}]` | — |
| `scatter` | `[{x, y, group?}]` | `group` 区分多组散点 |
| `radar` | `[{name, value, group?}]` | `group` 区分多个对象（如"本周"/"上周"） |
| `funnel` | `[{category, value}]` | — |
| `dual-axes` | `[{time \| category, value, group}]`（第一个 group 走主轴柱状，其余走次轴折线） | 用 `group` 区分 |
| `histogram` | `[{value}]`（一组数值） | — |

示例：

```json
// 多系列折线
{"type":"line","title":"血脂趋势","data":[
  {"time":"2024-10","value":3.84,"group":"LDL-C"},
  {"time":"2024-11","value":3.51,"group":"LDL-C"},
  {"time":"2024-10","value":1.32,"group":"HDL-C"},
  {"time":"2024-11","value":1.40,"group":"HDL-C"}]}

// 饼图
{"type":"pie","title":"睡眠构成","data":[
  {"category":"深睡","value":92},{"category":"浅睡","value":210},{"category":"REM","value":85}]}

// 雷达
{"type":"radar","title":"本周 vs 上周","data":[
  {"name":"睡眠","value":80,"group":"本周"},{"name":"活动","value":65,"group":"本周"},
  {"name":"睡眠","value":72,"group":"上周"},{"name":"活动","value":70,"group":"上周"}]}
```

---

## 3. 前端现状（审计结论）

- 框架：**React 19.2** + **Vite 7**，Tailwind v4，antd v6，开启了 React Compiler。
- Markdown 渲染：`react-markdown` **v10.1** + `remark-gfm`，组件在
  [`src/pages/Chat/Dialog/Render/Markdown/index.jsx`](../src/pages/Chat/Dialog/Render/Markdown/index.jsx)。
  当前 `components` 里**只重写了 `a`**，**没有 `code`/`pre` 重写** → `vis-chart` 块现在会被当成普通代码块原样显示。
- 图表库：**目前一个都没装**（无 echarts / @antv / recharts）。
- 回复是 **SSE 流式逐字追加**的（`REPLY` 在 `APPENDABLE_MESSAGE_TYPES` 里），意味着 `vis-chart` 块在写完之前 JSON 是**残缺**的 → 渲染组件必须**容错**（解析失败时先不渲染，等流完整再渲染）。
- 旧 PNG 图表走 `CHART_MESSAGE_TYPE.IMAGE`，在
  [`src/pages/Chat/Dialog/Render/index.jsx`](../src/pages/Chat/Dialog/Render/index.jsx) 第 56~79 行用 `<img>` 渲染 → **保留不动**。

**结论：当前无法渲染 `vis-chart`，需要按下面三步改。**

---

## 4. 实现（三步）

### 4.1 安装图表库（echarts，裸用）

```bash
npm install echarts
```

> 选 echarts 而非 `echarts-for-react`：后者的 peer-dep 通常只到 React 18，React 19 下要 `--legacy-peer-deps`，有风险。裸用 echarts + `useRef/useEffect` 更可控、解耦——以后想换底层库只改 VisChart 一个文件，后端提示词与数据协议都不用动。
>
> 体积优化（可选）：如需更小包体，可改用 echarts 的按需 `echarts/core` + 注册 `LineChart/BarChart/...`，本文为简洁用全量 `import * as echarts`。

### 4.2 新建 VisChart 组件

把 tidy 数据适配成 echarts `option`。**所有业务样式（配色、平滑、tooltip 等）都在这里定义**，模型不参与。

新建 `src/pages/Chat/Dialog/Render/VisChart/buildOption.js`：

```js
// 把 vis-chart 协议(tidy 数据) 映射成 ECharts option。
// 无法渲染时返回 null（调用方就什么都不画）。
const COLORS = ["#00b4d8", "#0077b6", "#90be6d", "#f9844a", "#f94144", "#577590", "#9d4edd"];

// 按 group 把长表拆成多个系列；返回 { cats, series:[{name,data}] }
function splitByGroup(rows, xKey) {
  const cats = [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r[xKey])) { seen.add(r[xKey]); cats.push(r[xKey]); }
  }
  const groups = new Map();
  for (const r of rows) {
    const g = r.group ?? "value";
    if (!groups.has(g)) groups.set(g, new Map());
    groups.get(g).set(r[xKey], r.value);
  }
  const series = [...groups.entries()].map(([name, m]) => ({
    name,
    data: cats.map((c) => (m.has(c) ? m.get(c) : null)),
  }));
  return { cats, series };
}

// 折线/面积/柱状的 X 字段可能叫 time 也可能叫 category
function xKeyOf(data) {
  const sample = data && data[0];
  return sample && "time" in sample ? "time" : "category";
}

export function buildEChartsOption(config) {
  if (!config || typeof config !== "object" || !config.type) return null;
  const { type, title, axisXTitle, axisYTitle, data = [] } = config;
  const titleOpt = title ? { text: title, left: "center", textStyle: { fontSize: 14, color: "#333" } } : undefined;
  const topPad = titleOpt ? 56 : 24;

  switch (type) {
    case "line":
    case "area": {
      const { cats, series } = splitByGroup(data, xKeyOf(data));
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "axis" },
        legend: series.length > 1 ? { top: titleOpt ? 28 : 0 } : undefined,
        grid: { left: 48, right: 24, top: topPad, bottom: 40, containLabel: true },
        xAxis: { type: "category", data: cats, name: axisXTitle, boundaryGap: type !== "area" },
        yAxis: { type: "value", name: axisYTitle },
        series: series.map((s) => ({ ...s, type: "line", smooth: true, areaStyle: type === "area" ? {} : undefined })),
      };
    }
    case "column":
    case "bar": {
      const { cats, series } = splitByGroup(data, xKeyOf(data));
      const catAxis = { type: "category", data: cats };
      const valAxis = { type: "value" };
      const horizontal = type === "bar";
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: series.length > 1 ? { top: titleOpt ? 28 : 0 } : undefined,
        grid: { left: 48, right: 24, top: topPad, bottom: 40, containLabel: true },
        xAxis: horizontal ? { ...valAxis, name: axisXTitle } : { ...catAxis, name: axisXTitle },
        yAxis: horizontal ? { ...catAxis, name: axisYTitle } : { ...valAxis, name: axisYTitle },
        series: series.map((s) => ({ ...s, type: "bar" })),
      };
    }
    case "pie": {
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "item" }, legend: { bottom: 0 },
        series: [{ type: "pie", radius: "62%", center: ["50%", titleOpt ? "54%" : "48%"],
          data: data.map((r) => ({ name: r.category, value: r.value })) }],
      };
    }
    case "scatter": {
      const groups = new Map();
      for (const r of data) {
        const g = r.group ?? "points";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push([r.x, r.y]);
      }
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "item" },
        legend: groups.size > 1 ? { top: titleOpt ? 28 : 0 } : undefined,
        grid: { left: 48, right: 24, top: topPad, bottom: 40, containLabel: true },
        xAxis: { type: "value", name: axisXTitle },
        yAxis: { type: "value", name: axisYTitle },
        series: [...groups.entries()].map(([name, pts]) => ({ name, type: "scatter", data: pts })),
      };
    }
    case "radar": {
      const names = [];
      const seen = new Set();
      for (const r of data) if (!seen.has(r.name)) { seen.add(r.name); names.push(r.name); }
      const max = Math.max(...data.map((r) => r.value || 0), 1);
      const groups = new Map();
      for (const r of data) {
        const g = r.group ?? "value";
        if (!groups.has(g)) groups.set(g, new Map());
        groups.get(g).set(r.name, r.value);
      }
      return {
        color: COLORS, title: titleOpt,
        tooltip: {}, legend: groups.size > 1 ? { bottom: 0 } : undefined,
        radar: { indicator: names.map((n) => ({ name: n, max })), center: ["50%", "54%"], radius: "60%" },
        series: [{ type: "radar", data: [...groups.entries()].map(([name, m]) => ({ name, value: names.map((n) => m.get(n) ?? 0) })) }],
      };
    }
    case "funnel": {
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "item" }, legend: { bottom: 0 },
        series: [{ type: "funnel", data: data.map((r) => ({ name: r.category, value: r.value })) }],
      };
    }
    case "dual-axes": {
      const { cats, series } = splitByGroup(data, xKeyOf(data));
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "axis" }, legend: { top: titleOpt ? 28 : 0 },
        grid: { left: 48, right: 48, top: topPad, bottom: 40, containLabel: true },
        xAxis: { type: "category", data: cats, name: axisXTitle },
        yAxis: [{ type: "value" }, { type: "value" }],
        series: series.map((s, i) => (i === 0
          ? { ...s, type: "bar", yAxisIndex: 0 }
          : { ...s, type: "line", yAxisIndex: 1, smooth: true })),
      };
    }
    case "histogram": {
      const vals = data.map((r) => r.value);
      return {
        color: COLORS, title: titleOpt,
        tooltip: { trigger: "axis" },
        grid: { left: 48, right: 24, top: topPad, bottom: 40, containLabel: true },
        xAxis: { type: "category", data: vals.map((_, i) => i + 1), name: axisXTitle },
        yAxis: { type: "value", name: axisYTitle },
        series: [{ type: "bar", data: vals, barCategoryGap: "0%" }],
      };
    }
    default:
      return null; // 未知类型，不渲染
  }
}
```

新建 `src/pages/Chat/Dialog/Render/VisChart/index.jsx`：

```jsx
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { buildEChartsOption } from "./buildOption";

// 渲染一个 ```vis-chart 块。source 是块内的原始 JSON 文本。
// 流式期间 JSON 可能残缺 → 解析失败就先不画，等下次（流完整）再画。
export default function VisChart({ source }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let config;
    try {
      config = JSON.parse(String(source).trim());
    } catch {
      return; // 仍在流式输出，JSON 不完整
    }
    const option = buildEChartsOption(config);
    if (!option || !elRef.current) return;

    if (!chartRef.current) chartRef.current = echarts.init(elRef.current);
    chartRef.current.setOption(option, true);

    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [source]);

  // 卸载时销毁实例，避免内存泄漏
  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null; }, []);

  return <div ref={elRef} style={{ width: "100%", height: 320, margin: "12px 0" }} />;
}
```

> **安全**：只用 `JSON.parse` 解析数据，绝不 `eval`/`new Function`，模型输出被当作纯数据，无脚本注入面。

### 4.3 在 Markdown 渲染器里拦截 `vis-chart`

改 [`src/pages/Chat/Dialog/Render/Markdown/index.jsx`](../src/pages/Chat/Dialog/Render/Markdown/index.jsx)，给 `components` 加 `code` 和 `pre` 两个重写（保留原有 `a`）：

```jsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./index.module.scss";
import MarkdownLinkSVG from "../../../../../assets/md-link.svg?react";
import VisChart from "../VisChart";

function Markdown({ content }) {
  const handleLinkClick = (href) => window.open(href, "_blank");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => {
          const { href } = props;
          return (
            <span className={styles.link} onClick={() => handleLinkClick(href)}>
              <MarkdownLinkSVG style={{ verticalAlign: "middle", display: "inline-block" }} />
            </span>
          );
        },
        // 围栏代码块：language-vis-chart → 渲染图表；其余照常
        code(props) {
          const { className = "", children, ...rest } = props;
          if (className.includes("language-vis-chart")) {
            return <VisChart source={String(children)} />;
          }
          return <code className={className} {...rest}>{children}</code>;
        },
        // 去掉 vis-chart 外层 <pre> 的代码块底色/内边距，让图表不被"装进代码框"
        pre(props) {
          const cls = props.node?.children?.[0]?.properties?.className;
          if (Array.isArray(cls) && cls.includes("language-vis-chart")) {
            return <>{props.children}</>;
          }
          return <pre {...props} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default Markdown;
```

> react-markdown v10 里，围栏块会渲染成 `<pre><code className="language-xxx">`，行内代码没有 `language-` 类名 → 用 `className.includes("language-vis-chart")` 判定即可。`pre` 重写用 hast 节点 `node.children[0].properties.className` 判定，稳定可靠。

---

## 5. 流式渲染注意点

- 回复逐字追加，`vis-chart` 块在闭合 ` ``` ` 到达前 JSON 不完整。VisChart 已对解析失败**静默返回**（不报错、不刷日志），等内容写完再渲染——这是预期行为，不要改成抛错。
- 通常在闭合围栏到达前，react-markdown 还不会把它识别成代码块（会当普通段落文本）；闭合后才进入 `code` 分支。两种情况 VisChart 都能正确处理。
- 若担心"图表在流式中途短暂闪烁/重挂载"，可接受——`echarts.init` 幂等，组件卸载会 `dispose`。

---

## 6. 构建并同步到后端

`mirobody` 后端把仓库里的 `frontend/` 目录当静态站点直接对外提供(逐请求读盘,
同步完新产物即生效,不需要重启)。改完后:

```bash
# 1) 装依赖
npm install

# 2) 出包
npm run build

# 3) 同步进后端仓库的 frontend/
#    先清 assets/ —— rsync --delete 不会删掉哈希名已不存在的旧 chunk
rm -rf ../mirobody/frontend/assets
rsync -a --delete dist/ ../mirobody/frontend/
```

> 产物是带哈希的文件名(`assets/index-xxxx.js` + `index.html`),重建后哈希会变,
> 所以要整体替换 `assets/` 和 `index.html`。

## 7. 验收用例

把下面的块原样发给助手（或造一条 `reply` 消息）验证渲染：

````markdown
```vis-chart
{"type":"line","title":"单系列折线","axisXTitle":"日期","axisYTitle":"bpm","data":[{"time":"11-08","value":72},{"time":"11-09","value":68},{"time":"11-10","value":75}]}
```

```vis-chart
{"type":"line","title":"多系列折线(group)","data":[{"time":"10月","value":3.8,"group":"LDL"},{"time":"11月","value":3.5,"group":"LDL"},{"time":"10月","value":1.3,"group":"HDL"},{"time":"11月","value":1.4,"group":"HDL"}]}
```

```vis-chart
{"type":"column","title":"柱状对比","data":[{"category":"周一","value":8200},{"category":"周二","value":9100},{"category":"周三","value":7600}]}
```

```vis-chart
{"type":"pie","title":"占比","data":[{"category":"深睡","value":92},{"category":"浅睡","value":210},{"category":"REM","value":85}]}
```

```vis-chart
{"type":"radar","title":"雷达","data":[{"name":"睡眠","value":80,"group":"本周"},{"name":"活动","value":65,"group":"本周"},{"name":"压力","value":40,"group":"本周"}]}
```

```vis-chart
{"type":"scatter","title":"散点","data":[{"x":10,"y":15},{"x":12,"y":9},{"x":7,"y":20}]}
```
````

**验收标准：**
- [ ] 以上每个块都渲染成对应类型的图表，不再显示成 JSON 代码框。
- [ ] 多系列（`group`）正确分成多条线/多组，且有图例。
- [ ] 标题、X/Y 轴标题正确显示。
- [ ] 流式输出过程中不报错、不闪红；块写完后稳定渲染。
- [ ] 普通代码块（如 ```js）和行内代码不受影响，照常显示。
- [ ] 旧的 PNG 图表（`IMAGE` 类型，`<img>`）渲染**完全不受影响**。
- [ ] 图表随窗口缩放自适应；切换会话/卸载消息时无报错、无内存泄漏。

---

## 8. 改动文件清单

| 文件 | 改动 |
| :--- | :--- |
| `package.json` | 新增依赖 `echarts` |
| `src/pages/Chat/Dialog/Render/VisChart/buildOption.js` | **新建**：tidy 数据 → echarts option |
| `src/pages/Chat/Dialog/Render/VisChart/index.jsx` | **新建**：VisChart 组件（容错、自适应、卸载销毁） |
| `src/pages/Chat/Dialog/Render/Markdown/index.jsx` | 给 `components` 增加 `code` / `pre` 重写，拦截 `language-vis-chart` |

不需要动：`Render/index.jsx` 的 `IMAGE` 分支、`enum/chat.js`、后端任何东西。
