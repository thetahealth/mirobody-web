# 前端需求：聊天流改用 LangChain 的块命名

> 面向前端开发的实现交接文档。后端已改造完成（mirobody 分支 `refactor/agent-chat-simplify`），
> `/api/chat` 的 SSE 帧和 `/api/history` 的 `content_dict` 都换了词汇表，现在需要前端跟着改。
>
> **这是破坏性改动**：旧前端连上新后端，助手的回答会被当成未知类型丢掉，
> 用户看到的是「这轮没有产生回答」的兜底文案 —— 不报错，只是空白。

---

## 1. 背景：后端改了什么，为什么

以前的帧类型（`reply` / `thinking` / `queryTitle` / `queryArguments` / `queryDetail` /
`costStatistics` / `widget`）是后端自己发明的，每个字段的载荷都塞在同一个 `content` 里。
读的人必须先学一套私有方言，才能看懂其实是很标准的五件事。

`langchain_core.messages.content` 对这五件事本来就有标准命名，而且每个块自带自己的载荷字段名。
现在后端直接用那套：

- `text` 带 `text`，`reasoning` 带 `reasoning`
- `tool_call` 带 `id` / `name` / `args`
- 工具结果就是 ToolMessage 的形状：`tool_call_id` + `content`
- token 用量就是 LangChain 的 `usage_metadata` 形状

另外三件事跟模型无关、是流本身的状态（`start` / `heartbeat` / `end`），
加上 LangGraph 原生的 `interrupt`（暂停待答）和 `notice`（系统对用户说话）。

**历史消息不用你管。** 后端在**读取**旧行时就地改名（`blocks.upgrade`），
所以 `/api/history` 返回的 `content_dict` 永远是新词汇表。前端只需要认一套名字。

---

## 2. 数据协议（前后端约定的合同）

### 2.1 模型产出的块

| `type` | 字段 | 含义 |
| --- | --- | --- |
| `text` | `text: string` | 回答正文，markdown，流式多帧 |
| `reasoning` | `reasoning: string` | 思考过程 / 子 agent 的旁白，流式多帧，可折叠 |
| `tool_call` | `id: string`<br>`name: string`<br>`args: object` | 一次工具调用。**一帧一次调用**，名字和参数一起到 |
| `tool_result` | `tool_call_id: string`<br>`content: string \| object[]`<br>`status?: "ok" \| "partial" \| "error"`<br>`error_kind?: string`<br>`truncated?: true` | 该调用的结果。`content` **逐字透传**，多模态时是块数组。<br>`status` 三件套来自工具的 envelope，不是从文本里猜的 |
| `usage` | `model: string`<br>`input_tokens: number`<br>`output_tokens: number`<br>`total_tokens: number`<br>`input_token_details?: { cache_read: number }`<br>`output_token_details?: { reasoning: number }` | 整轮一帧，在末尾。**数字是 number，不再是字符串**；两个 details 只在非零时出现 |
| `notice` | `message: string` | **新增。** 系统对用户说的话（「你选的模型没配置，改用默认的」），不是模型自己的话。以前混在 `thinking` 里，读的人分不出来 |
| `interrupt` | `interrupt_id: string`<br>`name: "ask_user"`<br>`args: { question: string, options: string[] }` | agent 反问用户，本轮到此暂停。点选项 = 把选项文本当普通消息发出去，后端据此续跑 |
| `error` | `message: string` | 给用户看的错误，agent 停止 |

### 2.2 流本身的状态

| `type` | 字段 | 含义 |
| --- | --- | --- |
| `start` | `id: string` | 开流 ack，`id` 是这条回答将被存库的 message id（形如 `web_<uuid>`） |
| `heartbeat` | 无 | 保活帧，静默超过 ~8s 才发。**直接丢弃** |
| `end` | `finish_reason: "stop" \| "error" \| "unavailable" \| "empty"` | 终帧，在**回答已落库之后**才发 |

`finish_reason` 四个值的含义：

- `stop` —— 模型正常说完
- `error` —— 出错中断（用户已经看到 error 帧）
- `unavailable` —— 压根没跑起来（没有配置 agent）
- `empty` —— 干净地结束但一个字没说（后端已替换成一句兜底文案）

### 2.3 新旧对照表

| 旧 | 新 |
| --- | --- |
| `{type:"id", content}` | `{type:"start", id}` |
| `{type:"reply", content}` | `{type:"text", text}` |
| `{type:"thinking", content}` | `{type:"reasoning", reasoning}` |
| `{type:"queryTitle", content, tool_id}` | `{type:"tool_call", id, name, args}` |
| `{type:"queryArguments", content, tool_id}` | **删除，不再发送** |
| `{type:"queryDetail", content, tool_id, status, error_kind, truncated}` | `{type:"tool_result", tool_call_id, content, status, error_kind, truncated}` |
| `{type:"costStatistics", content:{…字符串}}` | `{type:"usage", …number}` |
| `{type:"widget", content:{widget_type, question, config:{options}}}` | `{type:"interrupt", interrupt_id, name, args:{question, options}}` |
| `{type:"error", content}` | `{type:"error", message}` |
| `{type:"end", content:"", finish_reason}` | `{type:"end", finish_reason}` |
| `{type:"heartbeat", content:""}` | `{type:"heartbeat"}` |
| —— | `{type:"notice", message}` 新增 |

**`queryArguments` 为什么直接删掉**：它发的是 `tool_call` 已经带着的 `args`，只是又 JSON
编码了一遍；而且 LangGraph 的 `updates` 流从来不给参数的真增量，永远是一整个 JSON。
它从来没有被渲染过。

### 2.4 一次真实的流

```
data: {"type":"start","id":"web_3f2c…"}
data: {"type":"reasoning","reasoning":"先查血脂"}
data: {"type":"tool_call","id":"c1","name":"query_health_indicators","args":{"indicators":["LDL"]}}
data: {"type":"tool_result","tool_call_id":"c1","content":"| LDL | 3.09 |","status":"ok"}
data: {"type":"text","text":"你的 LDL-C 是 "}
data: {"type":"text","text":"3.09 mmol/L。"}
data: {"type":"usage","model":"claude-sonnet","input_tokens":1200,"output_tokens":80,"total_tokens":1280}
data: {"type":"end","finish_reason":"stop"}
```

### 2.5 `/api/history`

- `content_dict` 是这套新词汇表（旧行由后端在读取时改名，前端不用做兼容）
- 存下来的 `end` 块现在**带 `finish_reason`** —— 重开一个被打断的会话，可以照样显示
  「回答未完成」，以前这个信息只在实时流里有
- **`thinking_chunks` 字段已从响应中移除**（前端从来没读过它）

### 2.6 请求体

形状不变。三点变化：

- `prompt_name: null` 明确被接受（现在是 pydantic 模型，null 等同于没传）
- 未知字段 → `code: -4`，msg 里列出所有可接受字段名
- 字段类型错 → `code: -2`，msg 指出是哪个字段、错在哪。以前这两种都报 -4，
  等于让你去删一个真实存在的字段

---

## 3. 前端现状（审计结论）

引用点集中，不散：

- `src/enum/chat.js` —— 常量表，是唯一的真源
- `src/store/Chart/index.js` —— SSE 接收
- `src/store/Chart/data.js` —— 流式帧入 store
- `src/store/Chart/history.js` —— 历史消息入 store
- `src/utils/index.js` —— thinking group 分组
- `src/pages/Chat/Dialog/Render/index.jsx` —— 块分发渲染
- `src/pages/Chat/Dialog/Render/ThinkingGroup/index.jsx` —— tool_call / tool_result 配对
- `src/pages/Chat/Dialog/Render/AskUser/index.jsx` —— 反问卡片
- `src/pages/Chat/Dialog/Assistant/{index,Card}/index.jsx` —— 复制正文、用量图标
- `src/pages/Chat/Dialog/Assistant/CostIcon/index.jsx` —— 用量弹窗
- `src/pages/Chat/Dialog/Assistant/StatusHeader/statusLine.js` —— 状态行
- `src/pages/Share/index.jsx` —— 分享页
- `src/store/Chart/frameCoalescer.test.js`、`statusLine.test.js` —— 测试里有旧类型字面量

---

## 4. 实现要点

### 4.1 store 里直接存块原样

以前 `appendFrameToAssistant` 把帧拆成 `{type, content, tool_id, status, …}` 再重组，
每加一个后端字段就要在这里列一次。现在整块存下来即可：

```js
const appendFrameToAssistant = (assistantItem, block) => {
  const { type } = block;
  const last = assistantItem.messages[assistantItem.messages.length - 1];
  if (last && last.type === type && APPENDABLE_MESSAGE_TYPES.includes(type)) {
    const field = type === CHART_MESSAGE_TYPE.TEXT ? "text" : "reasoning";
    last[field] = (last[field] ?? "") + (block[field] ?? "");
    return;
  }
  // tool_call 的 id 就是调用 id，配对要用，不能被 uuid 覆盖
  assistantItem.messages.push({ ...block, id: block.id || uuidv4() });
};
```

只有 `text` 和 `reasoning` 续接（`APPENDABLE_MESSAGE_TYPES`），其余各自独立成块。

**注意 `id` 不能无脑覆盖**：`tool_call` 用 `id` 承载调用 id，
`ThinkingGroup` 靠它和 `tool_result.tool_call_id` 配对。

### 4.2 取正文用一张表，不要每处 if

每个块的载荷字段名不同，建议在 `enum/chat.js` 里放一张表：

```js
const BLOCK_TEXT_FIELD = {
  text: "text",
  reasoning: "reasoning",
  tool_call: "name",
  tool_result: "content",
  error: "message",
  notice: "message",
};

export const blockText = (block) => {
  if (!block) return "";
  const field = BLOCK_TEXT_FIELD[block.type];
  return (field ? block[field] : block.content) ?? "";
};
```

渲染器一行拿到载荷，不用 switch。（`content` 兜底是给前端自己的分组类型用的，
比如 `__thinking_group__`。）

### 4.3 工具调用配对改用 id

```js
// tool_call.id  ←→  tool_result.tool_call_id
const resultByCallId = new Map();
datasource.forEach((item) => {
  if (item.type === CHART_MESSAGE_TYPE.TOOL_RESULT && item.tool_call_id) {
    resultByCallId.set(item.tool_call_id, item.content);
  }
});
```

以前两边都叫 `tool_id`，现在是 LangChain 对同一件事的两个名字。

### 4.4 顺手能修好的一个死条件

`ThinkingGroup` 里工具运行中的转圈，条件写的是 `item.status === "streaming"` ——
**任何一帧都没带过这个字段**，所以那个 spinner 从来没出现过。建议改成
「这次调用是最后发生的事且还没有结果」：

```js
const isQueryDetailStreaming =
  !detail && !isHistoricalData && index === datasource.length - 1;
```

用「是不是最后一条」兜底，一旦后面来了任何块就停转，不会在轮次异常结束时转到天荒地老。

### 4.5 用量弹窗

`CostIcon` 里那个「Python dict 格式字符串」解析器可以整个删掉 ——
`usage` 块本身就是对象，数字是 number。字段位置变了：

```js
const thought_tokens     = data.output_token_details?.reasoning;
const cache_read_tokens  = data.input_token_details?.cache_read;
```

### 4.6 反问卡片

```js
const args = datasource?.args || {};
const question = args.question || "";
const options = args.options || [];
```

不再有 `widget_type`：有 `options` 就渲染成一排按钮，没有就只显示问题。
行为不变 —— 点一下把选项文本当普通消息发出去，后端的 checkpointer 知道这个线程在等回答。

### 4.7 `notice` 需要一个新渲染

系统提示，不是模型的话。建议和 `error` 类似但更轻（比如一条灰色提示条），
至少不能和 `reasoning` 长一样 —— 区分这两者正是它存在的理由。

**这是唯一一个需要新建渲染的块类型**，其余都是改名。

### 4.8 `start` / `heartbeat` 静默消费

```js
if (type === "start" || type === "heartbeat") return;
```

`start` 的 `id` 如果你要用来做消息关联，就存下来；否则丢掉。

---

## 5. 流式渲染注意点

- **帧是真的逐个到达的**。后端侧已用真 uvicorn 量过：三层中间件 + GZip
  不会缓冲 SSE（`text/event-stream` 在 starlette 的 gzip 排除表里）。所以
  60ms 的 `frameCoalescer` 仍然有意义，别去掉。
- **`end` 一定在回答落库之后才发**。前端看到 `end` 去刷新历史列表是安全的。
- **控制类帧不能被内容帧挡住**：`error` / `end` / close 路径要先 `flush()`
  再处理，这条现状已经是对的，保持。

---

## 6. 构建并同步到后端

```bash
# 1) 出包
npm run build:opensource

# 2) 同步进后端仓库的 frontend/
#    先清 assets/ —— rsync --delete 不会删掉哈希名已不存在的旧 chunk
rm -rf ../mirobody/frontend/assets
rsync -a --delete dist/ ../mirobody/frontend/
```

后端不用重启：`app.frontend()` 是每次请求从磁盘读的。

---

## 7. 验收用例

1. **普通问答**：`text` 多帧合成一段，markdown 正常，`vis-chart` 仍然渲染成图。
2. **带工具的问答**：思考区出现可展开的工具步骤，标题是工具名，展开看到结果；
   工具跑的时候转圈，出结果后变箭头。
3. **工具被拒**：`tool_result.status === "error"` 时状态行显示「Tool refused」+ `error_kind`。
4. **用量**：右上角柱状图图标点开，model / input / output / total 正确；
   有缓存命中时多一行 cache read。
5. **反问**：agent 问「这张化验单是哪天做的」，出现问题 + 选项按钮；
   点一个 → 作为普通消息发出 → 本轮继续，结果里说明已归档到哪天。
6. **模型回退**：配一个不存在的 provider，应看到 `notice` 提示条（不是思考区里的一行）。
7. **历史回读**：刷新页面重开同一个会话，上面 1–6 的内容和实时流渲染一致。
8. **旧历史回读**：打开一个改造**之前**产生的会话，内容照常显示（后端已在读取时改名）。
9. **被打断的回答**：中途断网，重开会话应看到截断的正文 + 「未完成」的状态
   （靠存档里的 `end.finish_reason`）。
10. **错误**：把后端 provider key 改错，应看到 error 卡片 + 状态行报错，而不是空气泡。

---

## 8. 参考实现

我已经按这份契约在 worktree 里做过一版可运行的实现，**可以直接 diff 或 cherry-pick**：

```
路径：/Users/admin/Desktop/development/Mirobody/mirobody-web-blocks
分支：refactor/langchain-block-names
提交：b8182ae  chat: read the blocks by their langchain names
```

改了 14 个文件，121 个单测通过，lint 干净，`npm run build:opensource` 通过。
它没有实现 §4.7 的 `notice` 渲染（那个块是后来加的），其余都在里面。

当时的实现思路是「store 里存 LangChain 原生块，渲染器用 `blockText` 取载荷」，
也就是这份文档 §4.1–4.2 的写法。如果你要换思路（比如在 SSE 入口归一化成
`{type, content}` 再喂给现有 store），后端契约不变，只是 §4 那几段不适用。

---

## 9. 后端对应改动

| 文件 | 作用 |
| --- | --- |
| `mirobody/agent/wire/blocks.py` | 词汇表本身 + 旧存档的读取时改名（`upgrade`） |
| `mirobody/agent/wire/stream.py` | LangGraph 流 → 块 |
| `mirobody/agent/chat/turn.py` | 一轮对话：`run()` 出块，`stream()` 成 SSE 帧 |
| `mirobody/agent/chat/message.py` | `/api/history` 的读取路径 |
| `mirobody/agent/chat/model.py` | 请求体（pydantic，null 等同未传） |
| `mirobody/agent/README.md` | 块类型表 + 外部接入的口子清单 |

块类型表以 `mirobody/agent/README.md` 的 §Response blocks 为准，
字段名以 `mirobody/agent/wire/blocks.py` 为准。两处不一致时以代码为准。
