import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
// dotenv.config();


import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

dotenv.config({

  path: path.resolve(__dirname, "../.env"),

});

const app = express();
const PORT = process.env.PORT || 3001;
const SCENE_CANVAS = { width: 600, height: 400 };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }
});
const aiProvider =
  process.env.AI_PROVIDER ||
  (process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY ? "zhipu" : "openai");

const openaiApiKey = process.env.OPENAI_API_KEY;
const zhipuApiKey = process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY;
const zhipuBaseURL =
  process.env.ZHIPUAI_BASE_URL || process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const openaiBaseURL = process.env.OPENAI_BASE_URL;
const visionModel =
  aiProvider === "zhipu"
    ? process.env.ZHIPUAI_MODEL || process.env.ZHIPU_VISION_MODEL || "glm-4.5v"
    : process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
const visionImageMaxSize = Number(process.env.VISION_IMAGE_MAX_SIZE || 1024);
const visionImageQuality = String(process.env.VISION_IMAGE_QUALITY || 75);

const openaiClient = openaiApiKey
  ? new OpenAI({
      apiKey: openaiApiKey,
      baseURL: openaiBaseURL || undefined,
      timeout: 180000,
      maxRetries: 2
    })
  : null;

const zhipuClient = zhipuApiKey
  ? new OpenAI({
      apiKey: zhipuApiKey,
      baseURL: zhipuBaseURL,
      timeout: 180000,
      maxRetries: 2
    })
  : null;

console.log("AI_PROVIDER:", aiProvider);
console.log("VISION_MODEL:", visionModel);
console.log("VISION_IMAGE_MAX_SIZE:", visionImageMaxSize);
console.log("VISION_API_KEY loaded:", aiProvider === "zhipu" ? !!zhipuApiKey : !!openaiApiKey);


app.use(cors());
app.use(express.json({ limit: "5mb" }));

function getBoxSize(type) {
  if (type === "book") return { width: 22, height: 13 };
  if (type === "pen") return { width: 18, height: 8 };
  return { width: 14, height: 14 };
}

function percentToScenePoint(position = {}) {
  if (typeof position.x === "number" && typeof position.y === "number") {
    return { x: position.x, y: position.y };
  }

  const xPercent = Number(position.xPercent ?? 50);
  const yPercent = Number(position.yPercent ?? 50);
  return {
    x: Math.round((Math.max(0, Math.min(100, xPercent)) / 100) * SCENE_CANVAS.width),
    y: Math.round((Math.max(0, Math.min(100, yPercent)) / 100) * SCENE_CANVAS.height)
  };
}

function addConsistentBbox(object) {
  const size = getBoxSize(object.type);
  const scenePoint = percentToScenePoint(object.position);
  const centerX = (scenePoint.x / SCENE_CANVAS.width) * 100;
  const centerY = (scenePoint.y / SCENE_CANVAS.height) * 100;

  return {
    ...object,
    scenePosition: scenePoint,
    bbox: {
      x: Number(Math.max(1, Math.min(96 - size.width, centerX - size.width / 2)).toFixed(2)),
      y: Number(Math.max(1, Math.min(96 - size.height, centerY - size.height / 2)).toFixed(2)),
      width: size.width,
      height: size.height
    }
  };
}

function getObjectPoint(object) {
  return object?.scenePosition || percentToScenePoint(object?.position);
}

function inferRegion(xPercent, yPercent) {
  const vertical = yPercent < 33 ? "top" : yPercent > 66 ? "bottom" : "center";
  const horizontal = xPercent < 33 ? "left" : xPercent > 66 ? "right" : "center";
  return vertical === "center" && horizontal === "center" ? "center" : `${vertical}_${horizontal}`;
}

function normalizeRegion(region, xPercent, yPercent) {
  const allowedRegions = new Set([
    "top_left",
    "top_center",
    "top_right",
    "center_left",
    "center",
    "center_right",
    "bottom_left",
    "bottom_center",
    "bottom_right"
  ]);

  return allowedRegions.has(region) ? region : inferRegion(xPercent, yPercent);
}

function normalizeType(type = "object") {
  return String(type)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "object";
}

function normalizeVisionObject(object, index) {
  const xPercent = Math.round(Math.max(0, Math.min(100, Number(object?.position?.xPercent ?? 50))));
  const yPercent = Math.round(Math.max(0, Math.min(100, Number(object?.position?.yPercent ?? 50))));
  const type = normalizeType(object?.type);
  const normalized = {
    id: object?.id || `object_${index + 1}`,
    name: object?.name || `物体${index + 1}`,
    type,
    icon: type,
    color: object?.color || "#0ea5a3",
    position: {
      region: normalizeRegion(object?.position?.region, xPercent, yPercent),
      xPercent,
      yPercent
    },
    confidence: Math.max(0, Math.min(1, Number(object?.confidence ?? 0.75))),
    operable: Boolean(object?.operable),
    description: object?.description || "视觉模型识别到的物体",
    status: "detected"
  };

  return addConsistentBbox(normalized);
}

function extractJson(text = "") {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型未返回可解析的 JSON");
    return JSON.parse(match[0]);
  }
}

function getUploadExtension(file) {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();
  if (originalExtension) return originalExtension;
  if (file.mimetype === "image/jpeg") return ".jpg";
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/heic") return ".heic";
  if (file.mimetype === "image/heif") return ".heif";
  return "";
}

function isHeicLike(file) {
  const extension = getUploadExtension(file);
  return ["image/heic", "image/heif"].includes(file.mimetype) || [".heic", ".heif"].includes(extension);
}

async function convertImageWithSips(inputBuffer, inputExtension = ".jpg") {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "embodied-ai-"));
  const inputPath = path.join(tempDir, `input${inputExtension || ".jpg"}`);
  const outputPath = path.join(tempDir, `${randomUUID()}.jpg`);

  try {
    await fs.writeFile(inputPath, inputBuffer);
    await execFileAsync(
      "/usr/bin/sips",
      [
        "-Z",
        String(visionImageMaxSize),
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        visionImageQuality,
        inputPath,
        "--out",
        outputPath
      ],
      { timeout: 45000 }
    );
    const buffer = await fs.readFile(outputPath);
    return { buffer, mimetype: "image/jpeg" };
  } catch (error) {
    const friendly = new Error("图片预处理失败。请将照片导出为较小的 JPEG/PNG 后再上传。");
    friendly.statusCode = 400;
    throw friendly;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function normalizeUploadedImage(file) {
  if (isHeicLike(file)) return convertImageWithSips(file.buffer, getUploadExtension(file) || ".heic");

  const supportedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  if (!supportedTypes.has(file.mimetype)) {
    const error = new Error("当前仅支持 JPG、PNG、WEBP、HEIC/HEIF 图片。iPhone 原图建议转换为 JPEG 后上传。");
    error.statusCode = 400;
    throw error;
  }

  return convertImageWithSips(file.buffer, getUploadExtension(file) || ".jpg");
}

async function analyzeImageWithOpenAI(file, prompt, imageUrl) {
  const response = await openaiClient.responses.create({
    model: visionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl }
        ]
      }
    ]
  });

  return response.output_text || "";
}

function ensureZhipuVisionModel() {
  if (!visionModel.toLowerCase().includes("v")) {
    const error = new Error(
      `当前智谱模型 ${visionModel} 不支持图片输入，请在 .env 中将 ZHIPUAI_MODEL 改为视觉模型，例如 glm-4.5v 或 glm-4v-flash。`
    );
    error.statusCode = 400;
    throw error;
  }
}

async function analyzeImageWithZhipu(file, prompt, base64Image) {
  ensureZhipuVisionModel();

  const response = await zhipuClient.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: base64Image } },
          { type: "text", text: prompt }
        ]
      }
    ],
    temperature: 0.2
  });

  return response.choices?.[0]?.message?.content || "";
}

async function analyzeImageWithVisionModel(file) {
  const client = aiProvider === "zhipu" ? zhipuClient : openaiClient;
  if (!client) {
    const requiredKey = aiProvider === "zhipu" ? "ZHIPUAI_API_KEY" : "OPENAI_API_KEY";
    const error = new Error(`缺少 ${requiredKey}，请先在 .env 中配置后再识别真实图片。`);
    error.statusCode = 503;
    throw error;
  }

  const normalizedImage = await normalizeUploadedImage(file);
  const base64 = normalizedImage.buffer.toString("base64");
  const imageUrl = `data:${normalizedImage.mimetype};base64,${base64}`;
  const prompt = `
你是具身智能机器人的视觉感知模块。请识别图片中可见的具体物品，不要只给出笼统场景描述。

只返回严格 JSON，不要 Markdown，不要解释。JSON 格式：
{
  "sceneDescription": "中文场景描述",
  "objects": [
    {
      "id": "object_1",
      "name": "中文物体名称",
      "type": "english_lowercase_type",
      "position": {
        "region": "top_left|top_center|top_right|center_left|center|center_right|bottom_left|bottom_center|bottom_right",
        "xPercent": 0,
        "yPercent": 0
      },
      "confidence": 0.0,
      "operable": true,
      "description": "中文简短描述"
    }
  ]
}

要求：
1. 尽量识别具体物品，如杯子、书、手机、笔、键盘、鼠标、瓶子、苹果、盒子、纸张等。
2. name 使用中文。
3. type 使用英文小写，例如 cup、book、phone、pen、keyboard、mouse、bottle、apple、box、paper。
4. region 只能使用给定九宫格枚举。
5. xPercent、yPercent 是物体中心点在图片中的大致百分比坐标，范围 0 到 100。
6. confidence 范围 0 到 1。
7. operable 表示是否适合被机器人移动或操作。
8. 最多返回 8 个主要物体，优先选择最清晰、最适合机器人操作或定位的物品，忽略背景墙面、桌面本身这类不可操作大背景。
9. 图片内容很多时，不要穷举全部细节，只输出对任务规划最有用的主要物体。
`;

  const modelText =
    aiProvider === "zhipu"
      ? await analyzeImageWithZhipu(file, prompt, base64)
      : await analyzeImageWithOpenAI(file, prompt, imageUrl);
  const parsed = extractJson(modelText);
  const objects = Array.isArray(parsed.objects) ? parsed.objects.map(normalizeVisionObject) : [];

  if (!objects.length) {
    const error = new Error("视觉模型没有识别到具体可用物体，请换一张更清晰的图片。");
    error.statusCode = 422;
    throw error;
  }

  return {
    sceneDescription: parsed.sceneDescription || "视觉模型已完成场景识别。",
    objects
  };
}

const sceneObjects = [
  {
    id: "cup_1",
    name: "杯子",
    type: "cup",
    icon: "cup",
    color: "#14b8a6",
    position: { x: 130, y: 190 },
    bbox: { x: 18, y: 40, width: 18, height: 20 },
    confidence: 0.94,
    status: "detected"
  },
  {
    id: "book_1",
    name: "书",
    type: "book",
    icon: "book",
    color: "#7c3aed",
    position: { x: 330, y: 120 },
    bbox: { x: 52, y: 25, width: 22, height: 16 },
    confidence: 0.91,
    status: "detected"
  },
  {
    id: "apple_1",
    name: "苹果",
    type: "apple",
    icon: "apple",
    color: "#ef4444",
    position: { x: 220, y: 285 },
    bbox: { x: 34, y: 67, width: 14, height: 15 },
    confidence: 0.88,
    status: "detected"
  },
  {
    id: "basket_1",
    name: "篮子",
    type: "basket",
    icon: "basket",
    color: "#f59e0b",
    position: { x: 455, y: 275 },
    bbox: { x: 72, y: 64, width: 19, height: 18 },
    confidence: 0.9,
    status: "detected"
  },
  {
    id: "paper_1",
    name: "纸团",
    type: "trash",
    icon: "trash",
    color: "#64748b",
    position: { x: 505, y: 155 },
    bbox: { x: 80, y: 34, width: 12, height: 12 },
    confidence: 0.82,
    status: "detected"
  },
  {
    id: "pen_1",
    name: "笔",
    type: "pen",
    icon: "pen",
    color: "#2563eb",
    position: { x: 88, y: 320 },
    bbox: { x: 11, y: 76, width: 18, height: 7 },
    confidence: 0.86,
    status: "detected"
  }
].map(addConsistentBbox);

const taskPresets = [
  {
    keywords: ["杯", "cup"],
    targetType: "cup",
    targetName: "杯子",
    actionType: "move",
    destination: "桌子右上角",
    destinationPosition: { x: 500, y: 70 }
  },
  {
    keywords: ["书", "book"],
    targetType: "book",
    targetName: "书",
    actionType: "find",
    destination: "当前位置",
    destinationPosition: null
  },
  {
    keywords: ["苹果", "apple"],
    targetType: "apple",
    targetName: "苹果",
    actionType: "put_in",
    destination: "篮子",
    destinationType: "basket",
    destinationPosition: null
  },
  {
    keywords: ["清理", "杂物", "桌面", "trash", "clean"],
    targetType: "trash",
    targetName: "杂物",
    actionType: "clean",
    destination: "收纳区",
    destinationPosition: { x: 540, y: 320 }
  },
  {
    keywords: ["手机", "phone"],
    targetType: "phone",
    targetName: "手机",
    actionType: "move",
    destination: "桌子右上角",
    destinationPosition: { x: 500, y: 70 }
  }
];

function inferTask(task = "") {
  const normalized = task.trim().toLowerCase();
  const preset = taskPresets.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  if (preset) return preset;

  const targetName = normalized.match(/把(.+?)(移动|放|拿|找到|清理)/)?.[1]?.trim();

  return {
    targetType: "unknown",
    targetName: targetName || "未知目标",
    actionType: normalized.includes("找") ? "find" : "move",
    destination: normalized.includes("右上角") ? "桌子右上角" : "未知位置",
    destinationPosition: normalized.includes("右上角") ? { x: 500, y: 70 } : null
  };
}

function inferActionType(task = "") {
  const normalized = task.trim().toLowerCase();
  if (/(找|找到|寻找|观察|看看|定位|在哪里|where|find|locate|observe)/.test(normalized)) return "find";
  if (/(清理|收拾|整理|clean)/.test(normalized)) return "clean";
  if (/(放进|放入|放到|put|place)/.test(normalized)) return "put_in";
  if (/(移动|搬|移到|拿到|move)/.test(normalized)) return "move";
  return "find";
}

function inferDestination(task = "", objects = [], targetObject = null) {
  const normalized = task.trim().toLowerCase();
  if (normalized.includes("右上角")) return { destination: "桌子右上角", destinationPosition: { x: 500, y: 70 } };
  if (normalized.includes("左上角")) return { destination: "桌子左上角", destinationPosition: { x: 80, y: 70 } };
  if (normalized.includes("右下角")) return { destination: "桌子右下角", destinationPosition: { x: 520, y: 320 } };
  if (normalized.includes("左下角")) return { destination: "桌子左下角", destinationPosition: { x: 80, y: 320 } };

  const destinationPhrase =
    normalized.match(/(?:到|至|进|入|放到|放入|移动到)(.+)$/)?.[1]?.trim() || normalized;
  const destinationObject = objects.find((object) => {
    const name = String(object.name || "").toLowerCase();
    const type = String(object.type || "").toLowerCase();
    if (targetObject?.id && object.id === targetObject.id) return false;
    return (name && destinationPhrase.includes(name)) || (type && destinationPhrase.includes(type));
  });

  if (destinationObject) {
    return {
      destination: destinationObject.name,
      destinationType: destinationObject.type,
      destinationPosition: getObjectPoint(destinationObject)
    };
  }

  return { destination: "当前位置", destinationPosition: null };
}

function matchTaskObject(task = "", objects = []) {
  const normalized = task.trim().toLowerCase();
  const objectCandidates = objects.filter((object) => !["table", "desk", "surface", "floor", "wall"].includes(String(object.type || "").toLowerCase()));
  return (
    objectCandidates.find((object) => {
      const name = String(object.name || "").toLowerCase();
      const type = String(object.type || "").toLowerCase();
      return (name && normalized.includes(name)) || (type && normalized.includes(type));
    }) ||
    objectCandidates.find((object) => {
      const description = String(object.description || "").toLowerCase();
      return description && normalized.includes(description);
    }) ||
    null
  );
}

function inferTaskWithObjects(task = "", objects = []) {
  const matchedObject = matchTaskObject(task, objects);
  if (matchedObject) {
    const actionType = inferActionType(task);
    const destination = inferDestination(task, objects, matchedObject);
    return {
      targetType: matchedObject.type,
      targetName: matchedObject.name,
      actionType,
      destination: actionType === "find" ? "当前位置" : destination.destination,
      destinationType: destination.destinationType,
      destinationPosition: actionType === "find" ? null : destination.destinationPosition
    };
  }

  return inferTask(task);
}

function findObject(objects, type, targetName = "") {
  return (
    objects.find((object) => object.type === type) ||
    objects.find((object) => targetName && object.name === targetName) ||
    null
  );
}

function buildUnderstanding(task, intent, objects, targetObject = null) {
  const needsDestination = ["move", "put_in", "clean"].includes(intent.actionType);
  const destinationObject = intent.destinationType ? findObject(objects, intent.destinationType, intent.destination) : null;
  const hasDestination = Boolean(destinationObject || intent.destinationPosition || intent.actionType === "find");
  const lowConfidenceObjects = objects.filter((object) => object.confidence < 0.86);

  return {
    rawTask: task,
    targetObject: intent.targetName,
    targetType: intent.targetType,
    targetFound: intent.actionType === "clean" ? objects.some((object) => ["trash", "pen"].includes(object.type)) : Boolean(targetObject),
    targetPosition: targetObject ? getObjectPoint(targetObject) : null,
    targetLocation: intent.destination,
    targetLocationFound: hasDestination,
    actionType: intent.actionType,
    preconditions: [
      "场景感知结果已生成",
      `目标对象${targetObject ? "已定位" : "需要重新感知确认"}`,
      targetObject?.operable === false && needsDestination ? "目标对象不适合移动或抓取" : "目标操作性已评估",
      needsDestination ? `目标位置${hasDestination ? "已解析" : "需要用户补充"}` : "该任务不需要移动目标位置"
    ],
    risks: [
      ...(!targetObject && intent.actionType !== "clean" ? ["未找到目标物体，无法直接执行抓取或移动"] : []),
      ...(targetObject?.operable === false && needsDestination ? [`${targetObject.name}不适合被机器人移动或抓取，建议改为观察/定位任务`] : []),
      ...(needsDestination && !hasDestination ? ["目标位置不明确，可能导致放置失败"] : []),
      ...(lowConfidenceObjects.length ? [`${lowConfidenceObjects.map((item) => item.name).join("、")}置信度偏低，建议执行前复核`] : []),
      "当前 Demo 未接真实机械臂碰撞检测，避障为规则模拟"
    ]
  };
}

function makeFailure(reason, suggestion, intent, understanding) {
  return {
    intent,
    understanding,
    executable: false,
    failure: {
      reason,
      suggestion
    },
    plan: [
      {
        step: 1,
        action: "observe",
        target: "场景",
        description: "重新观察场景并确认任务条件",
        status: "waiting"
      },
      {
        step: 2,
        action: "retry",
        target: "用户输入",
        description: suggestion,
        status: "waiting"
      }
    ]
  };
}

function buildPlan(task, objects) {
  const intent = inferTaskWithObjects(task, objects);
  const targetObject = findObject(objects, intent.targetType, intent.targetName);
  const destinationObject = intent.destinationType ? findObject(objects, intent.destinationType, intent.destination) : null;
  const understanding = buildUnderstanding(task, intent, objects, targetObject);
  const destinationPosition =
    (destinationObject ? getObjectPoint(destinationObject) : null) || intent.destinationPosition || null;

  if (intent.actionType !== "clean" && !targetObject) {
    const detectedNames = objects.length ? objects.map((item) => item.name).join("、") : "暂无识别结果";
    return makeFailure(
      "未找到目标物体",
      `请重新上传/识别图片，或把任务中的目标对象改为当前已识别物体：${detectedNames}`,
      intent,
      understanding
    );
  }

  if (targetObject?.operable === false && ["move", "put_in"].includes(intent.actionType)) {
    return makeFailure(
      "目标物体不适合操作",
      `${targetObject.name}被识别为不适合移动或抓取。建议改成“找到${targetObject.name}”或“观察${targetObject.name}”。`,
      intent,
      understanding
    );
  }

  if (["move", "put_in", "clean"].includes(intent.actionType) && !destinationPosition) {
    return makeFailure(
      "目标位置不明确",
      "请在任务中补充明确位置，例如“桌子右上角”“篮子”或“收纳区”。",
      intent,
      understanding
    );
  }

  if (intent.actionType === "find") {
    return {
      intent,
      understanding,
      executable: true,
      failure: null,
      plan: [
        {
          step: 1,
          action: "observe",
          target: "桌面",
          description: "扫描桌面区域并定位候选物体",
          status: "waiting"
        },
        {
          step: 2,
          action: "move_to",
          target: intent.targetName,
          objectId: targetObject?.id,
          position: targetObject ? getObjectPoint(targetObject) : null,
          description: `移动到${intent.targetName}附近并复核位置`,
          status: "waiting"
        },
        {
          step: 3,
          action: "done",
          target: intent.targetName,
          objectId: targetObject?.id,
          position: targetObject ? getObjectPoint(targetObject) : null,
          description: `报告${intent.targetName}的位置并完成任务`,
          status: "waiting"
        }
      ]
    };
  }

  if (intent.actionType === "clean") {
    const trashObjects = objects.filter((object) => ["trash", "pen"].includes(object.type));
    if (!trashObjects.length) {
      return makeFailure("未找到目标物体", "当前桌面没有识别到可清理杂物，请重新感知或调整任务。", intent, understanding);
    }

    const steps = [
      {
        step: 1,
        action: "observe",
        target: "桌面",
        description: "识别桌面上的可清理杂物",
        status: "waiting"
      },
      {
        step: 2,
        action: "avoid",
        target: "易碰撞区域",
        position: { x: 285, y: 205 },
        description: "规划路径并避开杯子、书本等非目标物体",
        status: "waiting"
      }
    ];

    const addStep = (step) => {
      steps.push({ step: steps.length + 1, ...step });
    };

    trashObjects.forEach((object) => {
      addStep({
          action: "move_to",
          target: object.name,
          objectId: object.id,
          position: getObjectPoint(object),
          description: `移动机器人到${object.name}附近`,
          status: "waiting"
        });
      addStep({
          action: "pick",
          target: object.name,
          objectId: object.id,
          position: getObjectPoint(object),
          description: `抓取${object.name}`,
          status: "waiting"
        });
      addStep({
          action: "place",
          target: intent.destination,
          objectId: object.id,
          position: intent.destinationPosition,
          description: `将${object.name}放到${intent.destination}`,
          status: "waiting"
        });
    });

    steps.push({
      step: steps.length + 1,
      action: "done",
      target: "任务完成",
      description: "确认桌面杂物已清理完成",
      status: "waiting"
    });

    return { intent, understanding, executable: true, failure: null, plan: steps };
  }

  return {
    intent,
    understanding,
    executable: true,
    failure: null,
    plan: [
      {
        step: 1,
        action: "observe",
        target: intent.targetName,
        objectId: targetObject?.id,
        position: targetObject ? getObjectPoint(targetObject) : null,
        description: `识别桌面上的${intent.targetName}`,
        status: "waiting"
      },
      {
        step: 2,
        action: "avoid",
        target: "障碍物",
        position: { x: 260, y: 185 },
        description: "检查移动路径并避开桌面障碍物",
        status: "waiting"
      },
      {
        step: 3,
        action: "move_to",
        target: intent.targetName,
        objectId: targetObject?.id,
        position: targetObject ? getObjectPoint(targetObject) : null,
        description: `移动机器人到${intent.targetName}附近`,
        status: "waiting"
      },
      {
        step: 4,
        action: "pick",
        target: intent.targetName,
        objectId: targetObject?.id,
        position: targetObject ? getObjectPoint(targetObject) : null,
        description: `抓取${intent.targetName}`,
        status: "waiting"
      },
      {
        step: 5,
        action: "place",
        target: intent.destination,
        objectId: targetObject?.id,
        position: destinationPosition,
        description: `将${intent.targetName}放到${intent.destination}`,
        status: "waiting"
      },
      {
        step: 6,
        action: "done",
        target: "任务完成",
        description: "确认目标状态并结束执行",
        status: "waiting"
      }
    ]
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Embodied AI Task Planner Demo API" });
});

app.post("/api/perception", upload.single("image"), async (req, res) => {
  const mode = req.file ? "uploaded-image" : req.body?.mode || "built-in";

  try {
    if (!req.file) {
      res.json({
        success: true,
        sceneId: "desktop_scene_mock_001",
        mode,
        model: "mock-detector-v2",
        sceneDescription: "内置桌面仿真场景，桌面上有杯子、书、苹果、篮子、纸团和笔。",
        objects: sceneObjects,
        annotations: sceneObjects.map((object) => ({
          id: object.id,
          label: object.name,
          bbox: object.bbox,
          confidence: object.confidence
        })),
        summary: `已识别到 ${sceneObjects.length} 个桌面物体，包含坐标、置信度和模拟识别框`
      });
      return;
    }

    const extension = getUploadExtension(req.file);
    const looksLikeImage = req.file.mimetype.startsWith("image/") || [".heic", ".heif"].includes(extension);
    if (!looksLikeImage) {
      res.status(400).json({
        success: false,
        error: "请上传图片文件，例如 JPG、PNG、WEBP 或 iPhone HEIC/HEIF。"
      });
      return;
    }

    const result = await analyzeImageWithVisionModel(req.file);
    res.json({
      success: true,
      sceneId: `uploaded_${Date.now()}`,
      mode,
      model: visionModel,
      sceneDescription: result.sceneDescription,
      objects: result.objects,
      annotations: result.objects.map((object) => ({
        id: object.id,
        label: object.name,
        bbox: object.bbox,
        confidence: object.confidence
      })),
      summary: `真实视觉模型已识别到 ${result.objects.length} 个具体物体`
    });
  } catch (error) {
    console.error("Perception error:", {
      name: error.name,
      status: error.status,
      code: error.code,
      message: error.message
    });

    const isTimeout =
      error.name === "TimeoutError" ||
      error.code === "ETIMEDOUT" ||
      /timed out|timeout/i.test(error.message || "");

    res.status(error.statusCode || 500).json({
      success: false,
      error: isTimeout
        ? "视觉模型请求超时。已建议压缩图片；请重试，或换一张更小/更清晰的 JPG 图片。"
        : error.message || "图片识别失败，请稍后重试。",
      sceneDescription: "",
      objects: []
    });
  }
});

app.post("/api/plan", (req, res) => {
  const { task, objects = sceneObjects } = req.body || {};
  const result = buildPlan(task, objects);

  res.json({
    task,
    intent: result.intent,
    understanding: result.understanding,
    executable: result.executable,
    failure: result.failure,
    plan: result.plan,
    summary: result.executable ? `已生成 ${result.plan.length} 个执行步骤` : `任务无法执行：${result.failure.reason}`
  });
});

app.post("/api/execute", (req, res) => {
  const { task, plan = [], executable = true, failure = null } = req.body || {};
  if (!executable) {
    res.status(422).json({
      task,
      success: false,
      result: `任务无法执行：${failure?.reason || "条件不足"}`,
      failure,
      logs: [`失败原因：${failure?.reason || "条件不足"}`, `建议：${failure?.suggestion || "请重新规划任务"}`]
    });
    return;
  }

  const executedSteps = plan.map((step) => ({
    ...step,
    status: "completed",
    finishedAt: new Date().toISOString()
  }));

  res.json({
    task,
    success: true,
    executedSteps,
    result: `机器人已完成${task || "当前任务"}`,
    logs: executedSteps.map((step) => `Step ${step.step}: ${step.description} - 已完成`)
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      error: error.code === "LIMIT_FILE_SIZE" ? "图片文件过大，请上传 8MB 以内的图片。" : "图片上传失败，请重试。"
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: error.message || "服务器处理失败，请稍后重试。"
  });
});

// app.listen(PORT, () => {
//   console.log(`Embodied AI mock API is running on http://localhost:${PORT}`);
// });
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`Embodied AI mock API is running on http://localhost:${PORT}`);
// });

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Embodied AI mock API is running on http://localhost:${PORT}`);
});

server.on("close", () => {
  console.log("Express server closed");
});

server.on("error", (error) => {
  console.error("Express server error:", error);
});

process.on("beforeExit", (code) => {
  console.log("Node beforeExit:", code);
});

process.on("exit", (code) => {
  console.log("Node exit:", code);
});
