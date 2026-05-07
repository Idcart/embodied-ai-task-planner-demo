# Embodied AI Task Planner Demo

一个具身智能入门 Demo，用网页端模拟“感知 -> 空间映射 -> 任务理解 -> 动作规划 -> 执行模拟 -> 结果反馈”的闭环。

当前版本支持图片/摄像头感知、3D 虚拟桌面空间、`worldState` 状态管理、机器人路径动画、执行适配层，以及未来接入实体设备的 mock 接口。

## 技术栈

- 前端：React + Vite + Tailwind CSS
- 3D：Three.js + React Three Fiber + Drei
- 后端：Node.js + Express + Multer
- AI 接入：OpenAI / 智谱 GLM / 小米 MiMo 兼容的视觉模型接口
- 图标：lucide-react

## 当前已实现功能

- 多模态图片识别：上传桌面图片后调用视觉模型识别物体；未上传时使用内置 mock 场景。
- 摄像头感知测试：手动截取摄像头当前画面并调用 `/api/perception/live-frame`。
- 场景锁定：手动感知成功后锁定当前场景，避免后续摄像头预览覆盖 `worldState`。
- 3D 虚拟空间：将 `xPercent / yPercent` 映射到 3D 桌面坐标。
- 物体 3D 表示：杯子、书、手机、苹果、瓶子等使用不同简单几何体。
- 机器人模拟：机器人在 3D 场景中移动、抓取、放置，并显示路径线。
- `worldState` 管理：保存机器人当前位置、持有物体、物体当前位置、放置状态和最近任务结果。
- 重复任务验证：如果目标物体已经在目标区域，直接返回已完成，不重复移动。
- 执行模式：
  - `simulation`：当前 3D 仿真执行。
  - `dryRun`：只输出拟发送给实体设备的硬件指令。
  - `hardware`：预留真实硬件调用，目前默认阻止真实执行。
- 硬件 mock API：
  - `GET /api/hardware/status`
  - `POST /api/hardware/execute-step`
  - `POST /api/hardware/execute-plan`
- 坐标转换与安全校验：包含虚拟坐标到机器人坐标的转换、桌面范围校验、抓取安全校验等。
- 底部信息区：AI 规划步骤、识别物体列表、执行日志使用 Tab 展示。

## 项目结构

```text
.
├── server/
│   └── index.js                    # Express API：感知、规划、执行、硬件 mock
├── src/
│   ├── components/
│   │   ├── CameraPerceptionPanel.jsx
│   │   ├── ControlPanel.jsx
│   │   ├── EmbodiedWorld3D.jsx
│   │   ├── BottomInspector.jsx
│   │   └── ...
│   ├── executors/
│   │   ├── BaseExecutor.js
│   │   ├── SimulationExecutor.js
│   │   ├── DryRunExecutor.js
│   │   └── HardwareExecutor.js
│   ├── lib/
│   │   ├── api.js
│   │   ├── constants.js
│   │   └── worldState.js
│   ├── utils/
│   │   └── coordinateTransform.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── package.json
├── vite.config.js
└── README.md
```

## 启动方式

安装依赖：

```bash
npm install
```

创建环境变量文件：

```bash
cp .env.example .env
```

启动前后端开发服务：

```bash
npm run dev
```

访问地址：

```text
http://localhost:5173
```

后端默认地址：

```text
http://localhost:3001
```

健康检查：

```bash
curl http://127.0.0.1:3001/api/health
```

## 环境变量

`.env.example` 已提供 OpenAI、智谱、小米 MiMo 三类配置。选择一种供应商即可。

智谱示例：

```bash
AI_PROVIDER=zhipu
ZHIPUAI_API_KEY=你的智谱 key
ZHIPUAI_MODEL=glm-4.6v
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
PORT=3001
```

小米 MiMo 示例：

```bash
AI_PROVIDER=mimo
XIAOMI_API_KEY=你的小米 MiMo token
XIAOMI_MIMO_MODEL=mimo-v2-omni
XIAOMI_MIMO_BASE_URL=https://api.xiaomimimo.com/v1
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
PORT=3001
```

OpenAI 示例：

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=你的 OpenAI key
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
PORT=3001
```

生产环境建议补充：

```bash
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=https://your-domain.com
VITE_API_BASE_URL=https://your-domain.com/api
UPLOAD_MAX_FILE_SIZE_MB=10
```

本地开发默认：

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_TARGET=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## 演示流程

### 图片识别流程

1. 打开页面 `http://localhost:5173`。
2. 上传桌面场景图片；如果不上传，系统使用内置 mock 桌面场景。
3. 点击“识别场景”。
4. 系统识别物体，并映射到 3D 桌面空间。
5. 输入任务，例如：

```text
把杯子移动到桌子右上角
```

6. 点击“生成计划”。
7. 查看底部“AI 规划步骤”。
8. 选择执行模式：
   - 3D 仿真执行
   - 实体指令预览 Dry Run
   - 实体设备执行 Hardware
9. 点击“开始执行”。
10. 观察 3D 机器人移动、抓取、放置和底部执行日志。

### 摄像头感知流程

1. 在左侧控制面板点击“开启摄像头”。
2. 页面只显示实时预览，不会自动识别。
3. 点击“感知当前场景”。
4. 系统截取当前视频帧并调用 `/api/perception/live-frame`。
5. 识别成功后更新 `worldState` 和 3D 空间，并锁定当前场景。
6. 场景锁定后再输入任务、生成计划、开始执行。
7. 如需重新识别，点击“重新感知场景”，确认后覆盖当前 3D 场景状态。

摄像头功能需要运行在 `localhost` 或 HTTPS 环境下，并且必须由用户点击按钮后授权。

## API 说明

### GET `/api/health`

后端健康检查。

### POST `/api/perception`

场景感知接口。

- 上传图片：`multipart/form-data`，字段名 `image`
- 不上传图片：返回内置 mock 桌面场景

返回包含：

- `sceneDescription`
- `objects`
- `annotations`
- `summary`

物体结构示例：

```json
{
  "id": "object_1",
  "name": "杯子",
  "type": "cup",
  "position": {
    "region": "center_left",
    "xPercent": 35,
    "yPercent": 56
  },
  "confidence": 0.91,
  "operable": true,
  "affordance": ["pickable", "movable", "placeable"],
  "risk": "可能倾倒或含液体，抓取前需要保持低速。",
  "description": "一个杯子，位于画面左侧中间区域"
}
```

### POST `/api/perception/live-frame`

摄像头单帧识别接口。

- 请求格式：`multipart/form-data`
- 字段名：`image`
- 返回结构与 `/api/perception` 保持一致，并额外包含：
  - `source: "camera"`
  - `timestamp`
  - `processingTimeMs`

### POST `/api/plan`

根据用户任务和当前物体列表生成动作计划。

请求示例：

```json
{
  "task": "把杯子移动到桌子右上角",
  "objects": []
}
```

返回包含：

- `intent`
- `understanding`
- `executable`
- `failure`
- `plan`
- `summary`

### POST `/api/execute`

执行模拟接口。当前用于返回后端执行总结，前端动画由 `SimulationExecutor` 驱动。

### GET `/api/hardware/status`

硬件连接状态。当前 mock 返回：

```json
{
  "connected": false,
  "deviceType": null,
  "message": "当前未连接实体设备"
}
```

### POST `/api/hardware/execute-step`

预留真实硬件单步执行接口。当前未连接硬件时返回阻止执行。

### POST `/api/hardware/execute-plan`

预留真实硬件整段计划执行接口。当前未连接硬件时返回阻止执行。

## 坐标映射

图片识别坐标：

```text
xPercent: 0 到 100
yPercent: 0 到 100
```

映射到虚拟 3D 桌面：

```text
x = (xPercent - 50) / 10
z = (yPercent - 50) / 10
```

硬件坐标转换位于：

```text
src/utils/coordinateTransform.js
```

当前使用模拟标定参数：

```js
{
  tableWidthMeter: 0.6,
  tableDepthMeter: 0.4,
  robotOrigin: { x: 0, y: 0, z: 0 },
  zPickHeight: 0.05,
  zSafeHeight: 0.15
}
```

## 执行适配层

执行适配层位于：

```text
src/executors/
```

- `BaseExecutor.js`：统一接口和硬件指令转换。
- `SimulationExecutor.js`：3D 仿真执行。
- `DryRunExecutor.js`：输出硬件指令预览，不控制设备。
- `HardwareExecutor.js`：预留真实硬件调用，当前会先检查硬件连接状态。

统一硬件指令格式示例：

```json
{
  "command": "move_to",
  "target": "cup",
  "position": {
    "x": 0.21,
    "y": 0.1,
    "z": 0.05,
    "unit": "meter"
  },
  "speed": "slow",
  "safetyCheck": true
}
```

## 公网部署

推荐使用 Ubuntu 22.04 + Nginx + PM2。部署前确认：

- `.env` 已加入 `.gitignore`，不要提交 API Key。
- 后端端口默认 `3001`，通过 `PORT` 环境变量调整。
- 前端生产构建使用 `VITE_API_BASE_URL` 指向公网 API。
- 摄像头功能在公网通常要求 HTTPS，IP + HTTP 下可能无法打开摄像头。

### 方案 A：前后端分离部署，推荐

架构：

```text
Browser -> Nginx
  /      -> /var/www/embodied-ai-demo/dist
  /api   -> http://127.0.0.1:3001
```

部署步骤：

```bash
# 1. 安装基础环境
sudo apt update
sudo apt install -y nginx git curl

# 2. 安装 Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

# 3. 安装 PM2
sudo npm install -g pm2

# 4. 克隆项目
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/Idcart/embodied-ai-task-planner-demo.git embodied-ai-demo
sudo chown -R $USER:$USER /var/www/embodied-ai-demo
cd /var/www/embodied-ai-demo

# 5. 安装依赖
npm install

# 6. 配置环境变量
cp .env.example .env
nano .env
```

生产 `.env` 示例：

```bash
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=https://your-domain.com
VITE_API_BASE_URL=https://your-domain.com/api
UPLOAD_MAX_FILE_SIZE_MB=10

AI_PROVIDER=zhipu
ZHIPUAI_API_KEY=你的 key
ZHIPUAI_MODEL=glm-4.6v
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
VISION_IMAGE_MAX_SIZE=1024
VISION_IMAGE_QUALITY=75
```

如果暂时使用你的公网 IP `8.136.17.44` 通过 HTTP 访问，可先这样配置：

```bash
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=http://8.136.17.44
VITE_API_BASE_URL=http://8.136.17.44/api
UPLOAD_MAX_FILE_SIZE_MB=10
```

注意：IP + HTTP 适合先验证页面、3D、图片上传和 API；摄像头 `getUserMedia` 通常需要 HTTPS 或 localhost，正式演示建议后续绑定域名并配置 HTTPS。

构建并启动：

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 logs embodied-ai-demo-api
pm2 save
pm2 startup
```

Nginx HTTPS 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 配好证书后建议将 HTTP 跳转 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /var/www/embodied-ai-demo/dist;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

暂时没有域名时，可以先用 IP + HTTP。你的服务器 IP 是 `8.136.17.44`，Nginx 可先这样配置：

```nginx
server {
    listen 80;
    server_name 8.136.17.44;

    root /var/www/embodied-ai-demo/dist;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用 Nginx：

```bash
sudo nano /etc/nginx/sites-available/embodied-ai-demo
sudo ln -s /etc/nginx/sites-available/embodied-ai-demo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

开放防火墙：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

验证：

```bash
curl http://127.0.0.1:3001/api/health
curl http://8.136.17.44/api/health
curl https://your-domain.com/api/health
```

浏览器访问：

```text
http://8.136.17.44/
https://your-domain.com/
```

### 方案 B：Express 托管前端 dist

当前后端已支持在 `NODE_ENV=production` 且存在 `dist/` 时托管前端静态资源。

使用方式：

```bash
npm install
cp .env.example .env
npm run build
NODE_ENV=production npm start
```

如果用 PM2：

```bash
pm2 start ecosystem.config.cjs
pm2 logs embodied-ai-demo-api
```

此方案可以让用户直接访问：

```text
http://服务器IP:3001/
```

但正式公网演示仍建议使用 Nginx + HTTPS，尤其是摄像头功能。

## PM2 管理命令

```bash
pm2 start ecosystem.config.cjs
pm2 restart embodied-ai-demo-api
pm2 logs embodied-ai-demo-api
pm2 status
pm2 save
```

## 摄像头公网注意事项

- 浏览器 `navigator.mediaDevices.getUserMedia` 通常只允许在 `localhost` 或 HTTPS 环境使用。
- 如果使用公网 IP + HTTP，摄像头按钮可能无法打开权限弹窗。
- 正式演示建议配置域名和 HTTPS。
- 如果只是测试后端接口，可以先使用 IP + HTTP。

## 生产安全注意事项

- `.env` 必须保留在服务器，不提交 GitHub。
- API Key 只能从环境变量读取，不能写死在代码里。
- `CLIENT_ORIGIN` 应设置为实际域名，不要在公网随意放开所有来源。
- `UPLOAD_MAX_FILE_SIZE_MB` 建议保持 10MB 或更低。
- Hardware 模式当前默认未连接实体设备，会阻止真实执行。
- 未来接入真实设备前，应增加硬件确认、急停、鉴权、速率限制和操作审计。

## 当前版本验证结果

本次整理已验证：

```bash
npm run build
```

结果：通过。

当前 `npm run dev` 已可正常启动：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`
- `/api/health`：正常返回
- `/api/hardware/status`：正常返回 mock 状态

构建时 Vite 会提示 Three.js 相关 bundle 超过 500KB，这是当前 3D 依赖导致的体积提示，不影响运行。

## 已知问题

- 当前任务规划主要是规则解析，不是完整 LLM 规划器。
- 真实视觉识别依赖 `.env` 中的模型 API key；未配置或模型不可用时，真实图片/摄像头识别会失败或使用 mock。
- 摄像头只能在 `localhost` 或 HTTPS 下正常授权。
- Hardware 模式目前只保留接口结构，默认未连接实体设备，不会真实控制机械臂或小车。
- 当前没有真实碰撞检测、机械臂逆解、夹爪反馈或设备状态闭环。
- 3D 模拟主要用于演示 Agent 流程，不等价于真实机器人控制系统。
- 前端 bundle 较大，后续如需上线可考虑对 Three.js 相关模块做代码拆分。

## 常见问题

### 前端打开空白

先检查构建产物和 Nginx root 是否正确：

```bash
npm run build
ls dist
sudo nginx -t
```

如果使用 React 前端路由，Nginx 必须配置：

```nginx
try_files $uri $uri/ /index.html;
```

### API 请求失败

检查 `VITE_API_BASE_URL` 是否正确。前后端分离部署一般为：

```bash
VITE_API_BASE_URL=https://your-domain.com/api
```

同时检查：

```bash
curl https://your-domain.com/api/health
pm2 logs embodied-ai-demo-api
```

### CORS 报错

检查后端 `.env`：

```bash
CLIENT_ORIGIN=https://your-domain.com
```

如果本地开发：

```bash
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

### 摄像头打不开

公网环境需要 HTTPS。IP + HTTP 通常无法使用摄像头权限。

### 上传图片失败

检查 Nginx 和后端上传大小：

```nginx
client_max_body_size 10m;
```

```bash
UPLOAD_MAX_FILE_SIZE_MB=10
```

### OpenAI / 智谱 / MiMo API Key 未配置

真实图片或摄像头识别需要模型 key。检查 `.env` 中的 `AI_PROVIDER` 和对应 key。

### 服务器端口未开放

如果使用 Nginx，只需要开放 80/443。后端 3001 可以只监听本机代理，不建议直接暴露公网。

## 后续计划

- 将 `/api/plan` 接入真实 LLM，让规划步骤更灵活。
- 增加硬件标定面板，用于配置桌面尺寸、相机外参、机器人原点。
- 增加真实设备连接状态和指令回执。
- 增加硬件执行确认弹窗，避免误触真实设备。
- 增加更严格的安全区域、速度限制和急停逻辑。
- 为摄像头感知增加更稳定的物体跟踪和 ID 关联。
- 为核心逻辑补充自动化测试。

## 开发约束

当前页面主布局已稳定，后续新增功能应优先放入现有控制面板、底部 Tab、折叠面板或弹窗中，不要大改顶部、左侧控制面板、右侧 3D 场景和底部信息区的位置。
