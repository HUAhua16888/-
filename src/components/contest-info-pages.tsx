import Link from "next/link";
import type { ReactNode } from "react";

const projectTitle = "闽食小当家——幼习宝·闽食成长岛教育智能体";
const projectSubtitle = "幼习宝·闽食成长岛教育智能体";

const pageLinks = [
  { href: "/compliance", label: "政策合规说明", icon: "📘" },
  { href: "/privacy", label: "隐私与安全说明", icon: "🛡️" },
];

type InfoSectionProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: string;
};

function InfoSection({ eyebrow, title, children, tone = "bg-white/88" }: InfoSectionProps) {
  return (
    <section className={`rounded-[2rem] p-6 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold text-teal-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 text-sm leading-8 text-slate-700">{children}</div>
    </section>
  );
}

function ContestPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <section className="rounded-[2.4rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7d8_52%,#e4fbf8_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.14)] md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-teal-700">{eyebrow}</p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold text-slate-900 md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-700">{description}</p>
            <p className="mt-3 inline-flex rounded-full bg-white/86 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm">
              案例类别：教育智能体
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            🏠 回首页
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pageLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.3rem] bg-white/82 px-4 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5"
            >
              <span className="mr-2" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-7 grid gap-5">{children}</div>
      </section>
    </main>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-[1rem] bg-white/72 px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ComplianceInfoPage() {
  return (
    <ContestPageShell
      eyebrow="政策合规说明"
      title="政策合规说明"
      description={`${projectTitle} 面向3-6岁幼儿园生活场景，围绕食育、生活习惯、地方文化和家园共育设计，避免小学化、排名化和替代教师判断。`}
    >
      <InfoSection eyebrow="A" title="对齐《3-6岁儿童学习与发展指南》">
        <BulletList
          items={[
            "本项目围绕健康、语言、社会、科学、艺术五大领域设计功能。",
            "健康领域：洗手、喝水、如厕、排队、整理、文明进餐、餐盘观察。",
            "语言领域：说一说今天认识的闽食、听故事、讲食材、表达感受。",
            "社会领域：小名牌、贴纸成长记录、家园任务、集体分享。",
            "科学领域：观察食材颜色、形状、气味、来源和变化。",
            "艺术领域：闽食绘本、儿歌、非遗小剧场、作品展示。",
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="B" title="对齐《幼儿园教育指导纲要（试行）》">
        <p className="rounded-[1rem] bg-white/72 px-4 py-3">
          本项目坚持保教结合，不以知识灌输为目标，而是通过一日生活、游戏互动、食育观察、故事表达和家园共育，引导幼儿形成良好生活习惯和积极情感体验。
        </p>
      </InfoSection>

      <InfoSection eyebrow="C" title="对齐《中华人民共和国学前教育法》">
        <BulletList
          items={[
            "本项目不进行小学化教学，不设置考试、排名和分数竞争。",
            "儿童端内容以游戏化、生活化、短时互动为主。",
            "涉及幼儿信息时，仅用于教师管理和成长记录。",
            "上传照片时提醒不拍摄儿童正脸，不上传敏感个人信息。",
            "AI生成内容需由教师审核后使用。",
            "建议教师控制幼儿单次使用时长，并结合线下活动开展。",
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="屏幕使用" title="防止小学化和过度使用电子屏" tone="bg-amber-50">
        <BulletList
          items={[
            "建议单次使用时间控制在5-10分钟内，并结合线下观察、品尝、绘画、儿歌、家园任务开展。",
            "不设置考试、分数排名、答题PK、连续刷题或错题本。",
            "激励语坚持温和支持：你愿意观察，已经很棒啦；今天靠近一点点，也是一种进步。",
          ]}
        />
      </InfoSection>
    </ContestPageShell>
  );
}

export function PrivacySafetyPage() {
  return (
    <ContestPageShell
      eyebrow="隐私与安全说明"
      title="隐私与安全说明"
      description={`${projectSubtitle} 仅作为幼儿园教师辅助开展食育和家园共育的教育工具，正式使用前应由园方和家长授权。`}
    >
      <InfoSection eyebrow="儿童权益" title="隐私保护原则">
        <BulletList
          items={[
            "本项目面向幼儿园教师辅助使用。",
            "儿童个人信息应由园方和家长授权后使用。",
            "上传图片不应出现儿童正脸和敏感隐私。",
            "AI生成内容仅作辅助建议，需教师审核。",
            "当前演示版本如未接入后端，不应录入真实敏感数据。",
            "正式部署应使用 HTTPS、账号权限、加密存储、日志审计和数据删除机制。",
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="上传提醒" title="照片、视频和小名牌使用提醒" tone="bg-rose-50">
        <BulletList
          items={[
            "请勿上传幼儿正脸照片。",
            "请勿上传身份证号、家庭住址、联系电话等敏感信息。",
            "餐盘观察仅建议上传餐盘、食物、作品照片。",
            "幼儿小名牌可使用昵称或编号，不强制使用真实姓名。",
            "数据仅用于教师开展食育活动和成长记录。",
          ]}
        />
      </InfoSection>
    </ContestPageShell>
  );
}

export function ContestMaterialsPage() {
  return (
    <ContestPageShell
      eyebrow="参赛材料"
      title="参赛材料"
      description="这里集中整理案例信息、教师流程、报告结构、8分钟演示脚本和配套资源清单，便于参赛前补齐材料。"
    >
      <InfoSection eyebrow="A" title="案例信息表摘要">
        <BulletList
          items={[
            `案例名称：${projectTitle}`,
            "案例类别：教育智能体",
            "申报学段：幼儿园",
            "解决的教学问题：针对幼儿挑食、进餐习惯培养难、泉州/南安本土食育资源互动化不足、家园共育反馈低效等问题，开发教育智能体，支持教师开展生活化、游戏化、地方化食育活动。",
            "特色与创新：以闽南饮食文化为载体，将AI对话、食育知识库、好习惯闯关、餐盘观察、家园任务和教师审核机制融合，形成适合3-6岁幼儿的低门槛教育智能体。",
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="教师流程" title="教师使用流程">
        <BulletList
          items={[
            "第一步：教师登录或进入教师端。",
            "第二步：添加班级幼儿小名牌，可使用昵称或编号。",
            "第三步：选择今日主题，例如“洗手”“文明进餐”“认识紫菜”“餐盘观察”。",
            "第四步：配置儿童端任务。",
            "第五步：幼儿在教师组织下进行短时互动。",
            "第六步：教师查看贴纸记录、餐盘观察和表达记录。",
            "第七步：教师选择是否生成家园共育任务。",
            "第八步：家长在家进行延伸活动，反馈照片或文字。",
            "第九步：教师整理成成长记录和活动反思。",
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="B" title="开发与应用报告结构">
        <BulletList items={["一、开发背景", "二、设计与开发", "三、应用过程与效果", "四、创新与反思"]} />
      </InfoSection>

      <InfoSection eyebrow="C" title="8分钟演示视频脚本结构">
        <BulletList items={["0-2分钟：案例概述", "2-7分钟：功能演示", "7-8分钟：应用成效和影响力"]} />
      </InfoSection>

      <InfoSection eyebrow="D" title="配套资源清单">
        <BulletList
          items={[
            "使用手册、开发流程、页面截图、提示词记录、知识库说明。",
            "隐私保护说明、教师审核说明、演示视频、网站链接。",
            "如有代码，则提供完整代码；如无法提供代码，则提供完整开发流程、截图和提示词。",
          ]}
        />
      </InfoSection>
    </ContestPageShell>
  );
}

export function ApplicationEvidencePage() {
  return (
    <ContestPageShell
      eyebrow="应用证据"
      title="应用证据记录区"
      description="以下为应用证据记录区，正式参赛前由教师根据真实实践补充。没有真实数据时不伪造。"
    >
      <InfoSection eyebrow="证据占位" title="正式参赛前补充">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            "使用班级",
            "使用时间",
            "活动主题",
            "参与幼儿人数",
            "教师反馈",
            "家长反馈",
            "幼儿作品",
            "餐盘观察记录",
            "活动照片，提醒不出现儿童正脸",
            "使用前问题",
            "使用后变化",
            "后续改进",
          ].map((item) => (
            <div key={item} className="rounded-[1.1rem] bg-white/76 px-4 py-3 text-sm font-semibold text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </InfoSection>
    </ContestPageShell>
  );
}
