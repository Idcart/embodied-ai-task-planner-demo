# Embodied AI Task Planner Demo

一个用于学习和展示的“具身智能 Embodied AI 入门 Demo”。项目通过网页和仿真完成“感知 → 理解 → 规划 → 执行 → 反馈”的闭环；上传图片后可调用视觉模型做真实场景感知，未上传图片时保留内置 mock 场景。

## 技术栈

- 前端：React + Vite + Tailwind CSS + lucide-react
- 后端：Node.js + Express
- AI 能力：当前使用 mock 感知与规则规划，代码结构预留真实模型接入位置

## 项目结构

```text
.
├── server/
│   └── index.js              # Express API：感知、规划、执行
├── src/
│   ├── components/           # 页面组件
│   ├── lib/                  # API 与常量
│   ├── App.jsx               # 主交互状态机
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── README.md
```

## 启动方式

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 支持 OpenAI、智谱或小米 MiMo 三选一。智谱示例：

```bash
AI_PROVIDER=zhipu
ZHIPUAI_API_KEY=你的智谱 key
ZHIPUAI_MODEL=glm-4.6v
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
```

小米 MiMo 示例：

```bash
AI_PROVIDER=mimo
XIAOMI_API_KEY=你的小米 MiMo token
XIAOMI_MIMO_MODEL=mimo-v2-omni
XIAOMI_MIMO_BASE_URL=https://api.xiaomimimo.com/v1
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
```

启动后访问：

```text
http://localhost:5173
```

后端 API 默认运行在：

```text
http://localhost:3001
```

## 页面流程

1. 输入任务，例如“把杯子移动到桌子右上角”
2. 点击“识别场景”
3. 页面展示 mock 识别到的桌面物体、坐标、置信度和图片标注框
4. 点击“生成计划”
5. 页面展示任务理解结果、前置条件、风险提示和机器人动作步骤
6. 点击“开始执行”
7. 机器人在 2D 仿真桌面上移动、避障、抓取、放置，并逐步高亮计划
8. 日志区显示执行状态、失败重试建议和最终总结

页面中间包含具身智能流程图：

```text
感知 → 理解 → 规划 → 执行 → 反馈
```

当前阶段会随操作自动高亮。

## API 说明

### POST `/api/perception`

上传图片时会调用视觉模型识别真实物体；未上传图片时返回内置 mock 场景。上传请求格式：

```text
multipart/form-data
字段名：image
```

返回示例：

```json
{
  "success": true,
  "sceneDescription": "这是一张桌面照片，桌面上有一个杯子和一本书。",
  "objects": [
    {
      "id": "object_1",
      "name": "杯子",
      "type": "cup",
      "position": {
        "region": "center_left",
        "xPercent": 32,
        "yPercent": 55
      },
      "bbox": { "x": 18, "y": 40, "width": 18, "height": 20 },
      "confidence": 0.94,
      "operable": true,
      "description": "一个杯子，位于图片左侧中间区域",
      "status": "detected"
    }
  ],
  "annotations": [],
  "summary": "已识别到 6 个桌面物体，包含坐标、置信度和模拟识别框"
}
```

### POST `/api/plan`

根据任务和物体列表生成执行计划：

```json
{
  "task": "把杯子移动到桌子右上角",
  "objects": []
}
```

返回内容包含：

- `understanding`：目标对象、目标位置、动作类型、前置条件、风险提示
- `executable`：任务是否可执行
- `failure`：不可执行时的失败原因和建议
- `plan`：动作列表，支持 `move_to`、`pick`、`place`、`observe`、`avoid`、`retry`、`done`

### POST `/api/execute`

模拟执行计划并返回最终结果：

```json
{
  "task": "把杯子移动到桌子右上角",
  "plan": []
}
```

## 如何接入真实视觉模型

当前 `server/index.js` 的 `/api/perception` 已支持：

1. 前端通过 `multipart/form-data` 上传图片。
2. 后端使用 `multer` 接收图片并转成 base64 data URL。
3. 后端调用 OpenAI、智谱或小米 MiMo 视觉模型。
4. 后端解析模型返回 JSON，并转换为统一物体结构。

```json
{
  "id": "object_1",
  "name": "杯子",
  "type": "cup",
  "position": {
    "region": "center_left",
    "xPercent": 32,
    "yPercent": 55
  },
  "bbox": { "x": 18, "y": 40, "width": 18, "height": 20 },
  "confidence": 0.94,
  "operable": true,
  "description": "一个杯子，位于图片左侧中间区域",
  "status": "detected"
}
```

前端只依赖这个统一结构，所以不用大改页面。

## 如何接入真实大模型 API

当前 `buildPlan()` 使用规则解析任务。后续可以把 `/api/plan` 改成调用大模型：

1. 输入：用户任务、识别物体列表、可用动作集合。
2. 要求模型输出严格 JSON。
3. 使用后端校验 JSON schema。
4. 转换为前端已支持的 `plan` 数组。

推荐提示词方向：

```text
你是机器人任务规划器。请根据用户任务和物体列表，输出 JSON 数组。
每一步必须包含 step、action、target、description、position。
可用 action 包括 scan、detect、move_to、pick、place、report、complete。
```

## 可扩展方向

- 加入真实图片上传与 bounding box 绘制
- 接入真实 LLM 生成更灵活的规划步骤
- 增加失败恢复策略，例如目标不可见、抓取失败、路径被阻挡
- 使用 Three.js 或物理引擎做 3D 桌面仿真
- 将 `/api/execute` 扩展为真实机器人控制层适配器
