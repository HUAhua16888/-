# 幼芽成长智伴

案例名称：幼习宝一日生活习惯养成 + 闽食成长岛食育改善协同教育智能体。

副标题：幼习宝一日生活习惯养成 + 闽食成长岛食育改善协同教育智能体。

平台定位：AI 成长互动与家园共育平台。一个教育智能体平台，两条主线协同：幼习宝关注洗手、喝水、如厕、整理、排队、文明进餐等一日生活习惯；闽食成长岛结合每日食谱播报、泉州食材认识、食物观察和家园延续，帮助教师形成可跟进的成长记录。当前版本适合班级小范围试用，后续可扩展为园所统一管理模式。

参赛类别：教育智能体。

当前版本已经包含：

- 首页入口
- 儿童互动任务页：一日生活常规提醒、闽食进餐改善和习惯故事小剧场
- 浏览器语音输入和语音播报
- 火山方舟章节插图生成接口
- 本地可保存的成长记录
- 闽食小厨房上传、播报和温和食育观察
- 教师工作台：AI 记录、AI 分析、跟进建议和家园同步
- 家庭延续页：查看老师建议、完成一个小步骤、提交家庭观察
- 统一顶栏导航与移动端底部导航
- 教师工作台本机自动保存草稿

## 当前版本定位与分工

当前为“班级试用模式”：教师工作台使用本机班级试用账号保护这台设备上的班级数据；儿童端不做账号登录，只通过小名牌/号数识别进入互动；家庭延续需要幼儿姓名或号数 + 家庭绑定码 + 家长同意后，才能查看对应孩子的老师同步建议。

教师端如果这台设备曾保存过旧账号，可在登录页点击“重置本机教师账号”重设本机班级试用账号。该操作只清除本机登录口令，不删除幼儿记录、家长反馈或生成内容。

隐私与正式上线提醒：当前版本为班级小范围试用/参赛演示版本，数据主要保存在这台设备上。正式上线需要补齐后端账号系统、HTTPS、密码加密存储、角色权限、日志审计、数据备份、数据删除与家长授权管理机制。

- 儿童端不设账号，只用小名牌/号数互动。
- 家长端通过幼儿姓名或号数 + 家庭绑定码查看自己孩子。
- 语音只保存识别后的文字，不保存原始语音。
- 照片/视频默认本机预览，不上传云端。
- 当前为班级试用/参赛演示版本，正式上线需后端账号、加密、权限、审计、备份和删除机制。

- 儿童端负责互动：幼儿通过小名牌进入幼习宝或闽食成长岛，跟着 AI 正向口令完成洗手、喝水、如厕、整理、排队、文明进餐和温和食育任务。
- 教师工作台负责跟进：老师查看 AI 成长记录、重点线索和家庭反馈，生成课堂跟进建议、正向口令、温和食育策略和家园同步话术。
- 家庭延续负责居家延续：家长查看老师今天观察到的内容，回家做一个小步骤，并提交一句家庭观察。

## 成效证据链

平台不只记录“做过什么”，而是形成“AI 正向提醒 → 幼儿互动记录 → 教师分析跟进 → 家庭一致延续 → 成效变化沉淀”的闭环。当前主要用常规任务完成、互动次数、重点线索、老师同步、家长反馈和居家任务完成情况来呈现阶段成效。

## 可复现说明

本项目是基于教育智能体提示词、班级本地数据和轻量网页交互的可复现平台。

- 提示词工程：围绕 3-6 岁幼儿特点约束语言风格、活动结构、教师引导语、儿歌口令和家园任务。
- 知识库构建：内置一日生活习惯知识库和泉州闽食食材知识库，支持洗手、喝水、如厕、整理、排队、文明进餐、每日食谱和食物观察。
- 儿童端互动流程：小名牌识别后进入幼习宝或闽食成长岛，通过听规则、点选/上传、完成反馈写入成长记录。
- 教师端跟进流程：看记录、看 AI 分析、带入关键词或记录生成跟进建议，确认后同步家长。
- 家长端延续流程：家长用家庭绑定码查看自己孩子的老师建议，回家做一个小步骤并提交观察。
- 成效记录方式：从提醒次数、主动完成次数、食物接受变化、家园反馈次数形成轻量证据。

## 高效解决问题机制

- 双模块协同：幼习宝解决一日生活常规反复提醒，闽食成长岛解决真实食谱下的温和食育和进餐改善。
- 正向激励：用儿歌、口令、短故事、图卡和小游戏帮助幼儿愿意听、愿意选、愿意做一小步。
- 教师减负：根据儿童端互动记录自动生成观察线索、跟进建议、课堂活动和家园同步话术。
- 家园闭环：在园 AI 引导、教师确认同步、居家实践、家长反馈回流到教师端。
- 泉州本土化：结合海蛎、紫菜、芥菜、蛏子、炸枣、芥菜饭、海蛎煎、面线糊等闽南饮食文化和每日食谱。

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
- `/adventure`：幼习宝与闽食成长岛互动任务页
- `/children`：幼儿小名牌选择页
- `/parents`：家庭延续与观察反馈页
- `/teachers`：教师工作台
- `/api/health`：公开健康检查；带 `x-internal-health-token` 才返回内部配置状态
- `/api/meal-photo-review`：闽食进餐观察拍图接口
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
