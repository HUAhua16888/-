# 幼芽成长智伴

一个面向幼儿园班级试用的 AI 成长互动与家园共育支持平台。平台围绕幼儿生活习惯、阅读表达和泉州闽食探索，把儿童互动、教师跟进和家庭延续放在同一条成长记录里。当前版本适合班级小范围试用，后续可扩展为园所统一管理模式。

当前版本已经包含：

- 首页入口
- 儿童互动任务页
- 浏览器语音输入和语音播报
- 火山方舟章节插图生成接口
- 多项轻量互动小游戏
- 本地可保存的成长记录册
- 闽食光盘拍图上传与图文分析卡
- 教师工作台与家长反馈页
- 统一顶栏导航与移动端底部导航
- 老师端本机自动保存草稿

## 当前版本定位与分工

当前为“班级试用模式”：教师端使用本机教师账号保护这台设备上的班级数据，家长端通过幼儿身份查看对应记录。正式园所使用时，可升级为园所管理员统一分配教师账号；家长端可升级为家庭查看码。

- 儿童端负责互动：幼儿通过小名牌进入幼习宝或闽食成长岛，完成阅读、习惯、进餐和闽食探索任务。
- 教师端负责跟进：老师查看互动记录、重点线索和家长反馈，生成课堂活动方案、鼓励语和家园同步建议。
- 家长端负责延续：家长查看孩子记录和老师建议，在家完成一个轻量任务并反馈观察。

## 成效证据链

平台不只记录“玩过什么”，而是形成“儿童互动 → 生成记录 → 教师跟进 → 家庭延续 → 成效沉淀”的闭环。当前主要用奖章升级、互动次数、重点线索、老师同步、家长反馈和居家任务完成情况来呈现阶段成效。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

项目使用以下变量：

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-reasoner

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SHOW_INTERNAL_NOTES=false
NEXT_PUBLIC_ENABLE_IMAGE_GENERATION=true
ENABLE_IMAGE_GENERATION=true
NEXT_PUBLIC_ENABLE_PREMIUM_TTS=true
NEXT_PUBLIC_TTS_VOICE_LABEL=小何 2.0
INTERNAL_HEALTH_TOKEN=

VOLCENGINE_ARK_API_KEY=
VOLCENGINE_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_ARK_IMAGE_MODEL=doubao-seedream-5-0-260128
VOLCENGINE_ARK_VISION_MODEL=doubao-seed-2-0-lite-260215
VOLCENGINE_ARK_IMAGE_SIZE=2K

VOLCENGINE_SPEECH_APP_ID=
VOLCENGINE_SPEECH_API_KEY=
VOLCENGINE_SPEECH_ACCESS_TOKEN=
VOLCENGINE_SPEECH_SECRET_KEY=
VOLCENGINE_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse
VOLCENGINE_TTS_RESOURCE_ID=seed-tts-2.0
VOLCENGINE_TTS_VOICE_TYPE=zh_female_xiaohe_uranus_bigtts
VOLCENGINE_TTS_AUDIO_FORMAT=mp3
VOLCENGINE_TTS_SAMPLE_RATE=24000

VISUAL_REVIEW_API_KEY=
VISUAL_REVIEW_BASE_URL=
VISUAL_REVIEW_MODEL=
VISUAL_REVIEW_API_PATH=/responses
VISUAL_REVIEW_PROVIDER_STYLE=openai-responses
```

## 页面说明

- `/`：项目首页
- `/adventure`：儿童互动任务页
- `/children`：幼儿小名牌选择页
- `/parents`：家长端成长记录与反馈页
- `/teachers`：教师工作台
- `/api/health`：公开健康检查；带 `x-internal-health-token` 才返回内部配置状态
- `/api/meal-photo-review`：拍图上传与闽食光盘分析卡
- `/api/text-to-speech`：高质量语音播报接口

更详细的上线事项见：

- [部署上线清单.md](./部署上线清单.md)

## 部署上线

推荐直接部署到 Vercel：

1. 把项目推到 GitHub。
2. 在 Vercel 导入仓库。
3. 把 `.env.local` 里的环境变量配置到 Vercel Project Settings。
4. 执行部署。
5. 绑定你自己的域名。

如果你要在中国大陆长期稳定访问，建议后续再迁移到国内云服务，并补齐备案、对象存储和数据库。

## 当前香港服务器更新方式

当前线上服务器已经部署在腾讯云香港轻量服务器上，手动更新时优先使用仓库内脚本：

```bash
cd /var/www/tongqu-growth-web
chmod +x deploy/server-update.sh
bash deploy/server-update.sh
```

如果本机已经配置好 SSH 凭据，也可以在 Windows 本地执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\run-remote-deploy.ps1
```
