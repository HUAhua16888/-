# 幼芽成长智伴

案例名称：幼习宝：幼儿一日生活常规与闽食进餐改善教育智能体。

平台定位：AI 成长互动与家园共育平台。当前版本适合班级小范围试用，聚焦幼儿喝水、洗手、如厕、整理、排队、文明进餐等常规反复提醒效果不稳定的问题，通过 AI 正向口令、互动任务和成长记录帮助幼儿自主管理；教师根据 AI 记录及时跟进，并同步家长形成家园一致教育。后续可扩展为园所统一管理模式。

参赛类别：教育智能体。

当前版本已经包含：

- 首页入口
- 儿童互动任务页：一日生活常规提醒、闽食进餐改善和阅读习惯延伸
- 浏览器语音输入和语音播报
- 火山方舟章节插图生成接口
- 本地可保存的成长记录
- 闽食小厨房上传、播报和温和食育观察
- 教师工作台：AI 记录、AI 分析、跟进建议和家园同步
- 家庭延续页：查看老师建议、完成一个小步骤、提交家庭观察
- 统一顶栏导航与移动端底部导航
- 教师工作台本机自动保存草稿

## 当前版本定位与分工

当前为“班级试用模式”：教师工作台使用本机教师账号保护这台设备上的班级数据，家庭延续通过幼儿身份查看对应记录。正式园所使用时，可升级为园所管理员统一分配教师账号；家庭延续可升级为家庭查看码。

教师端如果这台设备曾保存过旧账号，可在登录页点击“忘记口令/重新创建账号”重设本机教师账号。该操作只清除本机登录口令，不删除幼儿记录、家长反馈或生成内容。

- 儿童端负责互动：幼儿通过小名牌进入幼习宝或闽食成长岛，跟着 AI 正向口令完成洗手、喝水、如厕、整理、排队、文明进餐和温和食育任务。
- 教师工作台负责跟进：老师查看 AI 成长记录、重点线索和家庭反馈，生成课堂跟进建议、正向口令、温和食育策略和家园同步话术。
- 家庭延续负责居家延续：家长查看老师今天观察到的内容，回家做一个小步骤，并提交一句家庭观察。

## 成效证据链

平台不只记录“做过什么”，而是形成“AI 正向提醒 → 幼儿互动记录 → 教师分析跟进 → 家庭一致延续 → 成效变化沉淀”的闭环。当前主要用常规任务完成、互动次数、重点线索、老师同步、家长反馈和居家任务完成情况来呈现阶段成效。

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
