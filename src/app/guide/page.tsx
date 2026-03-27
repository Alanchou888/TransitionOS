import Link from "next/link";
import { Role } from "@prisma/client";
import { requirePageRoles } from "@/lib/page-auth";

const ALL_ROLES: Role[] = [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR];

export default async function GuidePage() {
  await requirePageRoles(ALL_ROLES);

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <h1 className="page-title">TransitionOS 操作導覽</h1>
        <p className="page-subtitle">
          這一頁是完整使用手冊。你可以照著流程跑完「建立任務 → 生成 → 編修 → 核准 → 匯出」的完整 demo。
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className="btn-secondary">
            1. 切換帳號
          </Link>
          <Link href="/admin/settings" className="btn-secondary">
            2. 設定來源
          </Link>
          <Link href="/tasks/new" className="btn-secondary">
            3. 建立任務
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            4. 回 Dashboard
          </Link>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">快速開始（10 分鐘）</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            到 <Link href="/login">Switch User</Link>，先使用 Admin。
          </li>
          <li>
            到 <Link href="/admin/settings">Admin Settings</Link>，建立來源連線並按 <code>Test</code> 確認可以抓資料。
          </li>
          <li>
            到 <Link href="/tasks/new">Create Task</Link>，勾選來源（可用 <code>Select All / Enabled Only</code>）。
          </li>
          <li>進入 Draft Review 按 <code>Generate / Refresh</code>。</li>
          <li>檢查 citation、必要時用 <code>Regenerate Section</code> 重生單一段落。</li>
          <li>進 Onboarding Pack / Checklist 完成必要項目。</li>
          <li>
            以 Manager 身分進 <code>Approval</code>，看 Readiness 是否全綠，然後核准。
          </li>
          <li>最後到 Export 匯出 Markdown / PDF。</li>
        </ol>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">頁面功能地圖</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Dashboard</p>
            <p className="text-sm text-slate-600">看任務狀態、進度、快速進入各流程頁。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Create Task</p>
            <p className="text-sm text-slate-600">建立任務、選來源、設定範圍與 filters。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Draft Review</p>
            <p className="text-sm text-slate-600">執行生成、編修交接文件、看 citation、版本 diff。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Onboarding Pack</p>
            <p className="text-sm text-slate-600">編修 onboarding 內容、單段重生、看 citation。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Checklist</p>
            <p className="text-sm text-slate-600">新人成長項目勾選與 mentor 註記。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Approval</p>
            <p className="text-sm text-slate-600">看 readiness，核准或退回。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Export</p>
            <p className="text-sm text-slate-600">核准後匯出 markdown/pdf。</p>
          </div>
          <div className="kpi-card space-y-1">
            <p className="font-semibold text-slate-900">Admin Settings</p>
            <p className="text-sm text-slate-600">來源連線、token 維護、連線測試。</p>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">角色權限（摘要）</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li><strong>Admin</strong>: 全功能（來源管理、任務、核准、匯出）。</li>
          <li><strong>Employee</strong>: 建任務、編修內容、觸發生成，不可核准。</li>
          <li><strong>Manager</strong>: 可審核核准/退回，追蹤 readiness。</li>
          <li><strong>Successor</strong>: 重點在 checklist/閱讀，不可核准。</li>
          <li><strong>Mentor</strong>: 可協助內容與 checklist 註記。</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">常見問題排除</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>
            <strong>GitHub 404</strong>: 檢查 owner/repo 是否純名稱（非 URL）、token 是否有 repo 權限。
          </li>
          <li>
            <strong>Sources: none</strong>: 來源抓不到資料或 filters 太嚴；先在 Admin Settings 按 Test。
          </li>
          <li>
            <strong>Approval 被擋</strong>: 到 Approval Readiness 看具體 section（missing citation / needs_human_fill）。
          </li>
          <li>
            <strong>無法匯出</strong>: 先完成 Manager approval，狀態需到 <code>APPROVED</code>。
          </li>
          <li>
            <strong>資料庫連不到</strong>: 確認 PostgreSQL / docker db 正常啟動。
          </li>
        </ul>
      </section>
    </div>
  );
}
