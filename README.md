# 童趣成长乐园

一个面向幼儿园儿童、老师和家长的 AI 互动故事网站。当前版本已经包含：

- 首页品牌展示
- 儿童互动故事页
- 浏览器语音输入和语音播报
- 火山方舟章节插图生成接口
- 3 个轻量小游戏
- 老师 / 家长辅助内容生成页

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

VOLCENGINE_ARK_API_KEY=
VOLCENGINE_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_ARK_IMAGE_MODEL=doubao-seedream-3-0-t2i-250415
```

## 页面说明

- `/`：项目首页
- `/adventure`：儿童互动故事页
- `/teachers`：老师和家长辅助页
- `/api/health`：部署后可用于检查环境变量是否配置到位

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
