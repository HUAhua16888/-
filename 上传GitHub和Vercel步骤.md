# 上传 GitHub 和连接 Vercel 步骤

这份说明按当前项目目录 `E:\幼儿ai项目\tongqu-growth-web` 编写。

## 一、先在 GitHub 网页创建仓库

建议参数：
- 仓库名：`tongqu-growth-web`
- 可见性：建议先选 `Private`
- 不要勾选自动添加 `README`、`.gitignore`、`LICENSE`

创建后，GitHub 会给你一个仓库地址，格式通常像这样：

```bash
https://github.com/你的用户名/tongqu-growth-web.git
```

## 二、在本地把项目提交到 GitHub

当前项目已经是本地 Git 仓库了。

你只需要在项目目录执行：

```bash
git add .
git commit -m "Initial project setup"
git remote add origin https://github.com/你的用户名/tongqu-growth-web.git
git push -u origin main
```

注意：
- `.env.local` 不会被提交，因为已经被 `.gitignore` 忽略。
- 真正上传的是代码，不是你的密钥。

## 三、在 Vercel 里导入 GitHub 仓库

1. 登录 Vercel。
2. 点击 `Add New...`
3. 选择 `Project`
4. 选择你刚上传的 GitHub 仓库
5. Framework 会自动识别为 `Next.js`
6. Root Directory 保持默认
7. Build Command 保持默认
8. Output Directory 保持默认

## 四、在 Vercel 里配置环境变量

把下面这些变量填进去：

```bash
OPENAI_API_KEY=你的DeepSeek密钥
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-reasoner

NEXT_PUBLIC_SITE_URL=https://你的正式域名

VOLCENGINE_ARK_API_KEY=你的火山方舟密钥
VOLCENGINE_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_ARK_IMAGE_MODEL=doubao-seedream-3-0-t2i-250415
```

建议：
- 如果还没有正式域名，`NEXT_PUBLIC_SITE_URL` 先填 Vercel 分配的网址也可以。
- 等你绑定正式域名后，再把这个值改成正式域名。

## 五、第一次部署完成后检查

打开下面几个地址：

- 首页 `/`
- 儿童互动页 `/adventure`
- 老师辅助页 `/teachers`
- 健康检查 `/api/health`

健康检查应该返回类似：

```json
{
  "ok": true
}
```

并且：
- `deepseekConfigured` 应为 `true`
- `volcImageConfigured` 应为 `true`

## 六、绑定域名

1. 在 Vercel 项目里进入 `Settings`
2. 打开 `Domains`
3. 添加你的域名
4. 按提示去域名服务商配置解析

## 七、如果图片生成报错

优先检查：
- 火山方舟 key 是否正确
- 火山方舟图像模型是否真的开通
- `VOLCENGINE_ARK_IMAGE_MODEL` 是否和控制台里的实际模型 ID 一致

当前项目里先写的是：

```bash
doubao-seedream-3-0-t2i-250415
```

如果你后台显示的不是这个名字，到时改环境变量即可，不用改整站结构。
