# TransitionOS Demo Script（可直接評分版）

本腳本給課堂 demo 使用，目標是在 8-12 分鐘內完成「建立任務 -> 生成 -> 編修 -> 審核 -> 新人 checklist -> 匯出」完整流程。

## 0. Demo 前準備（2 分鐘）

1. 啟動資料庫
   - `docker compose up -d db`
2. 初始化資料
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run prisma:seed`
3. 啟動系統
   - `npm run dev`
4. 打開系統
   - `http://localhost:3000/login`

## 1. 開場說明（30 秒）

可直接講：

> 「TransitionOS 是企業內部知識轉移系統。  
> 我們示範的是：員工交接 + 新人 onboarding 同步完成，並且每段內容都有 citation、主管可審核、最後可匯出。」

## 2. Demo 路徑（建議 9 步）

### Step 1：切換角色（Admin）

1. 進入 `/login`
2. 選 `admin@transitionos.local`
3. 點 `Use This Account`

預期畫面：
- Header 顯示目前使用者與角色（Admin）

評分點對應：
- FR-01（角色識別）

### Step 2：檢查來源設定（Admin Settings）

1. 進入 `/admin/settings`
2. 展示已存在來源（GitHub repo / GitHub issue / Notion）
3. 說明「白名單來源」與「不抓私人對話」

預期畫面：
- Source Connections 列表
- 角色權限摘要

評分點對應：
- NFR-01 Security
- NFR-08 Privacy

### Step 3：切換角色（Employee）並建立任務

1. 回 `/login`，選 `employee@transitionos.local`
2. 進入 `/tasks/new`
3. 建立 `BOTH` 任務（handover + onboarding）
4. 日期範圍選近 30 天，勾選 2-3 個來源
5. 建立後會導到 Draft Review

預期畫面：
- 任務建立成功並進入 `/tasks/{id}/draft`

評分點對應：
- FR-02（建立 transition task）
- FR-03（多來源）

### Step 4：生成交接與 onboarding（Employee）

1. 在 Draft Review 按 `Generate / Refresh`
2. 等待任務完成
3. 展示 Handover Draft 已出現內容
4. 展示 Citations 區塊

預期畫面：
- 有 version 的 handover draft
- citation 列表顯示 section 對應來源

評分點對應：
- FR-04（handover draft）
- FR-05（citation）
- FR-08（onboarding pack 會同步產生）

### Step 5：編修內容（Employee）

1. 在 Draft Review 編輯 markdown
2. 按 `Save New Version`

預期畫面：
- 新版草稿建立（版本遞增）

評分點對應：
- FR-06（可編修）
- FR-14（版本歷史）

### Step 6：檢查 Onboarding Pack（Employee）

1. 進 `/tasks/{id}/onboarding`
2. 展示 onboarding 內容與 citation map
3. 說明 30/60/90 節點是由同一知識庫生成

評分點對應：
- FR-08（onboarding pack）
- NFR-02 Traceability

### Step 7：切換角色（Successor）完成 checklist

1. 回 `/login`，選 `successor@transitionos.local`
2. 進 `/tasks/{id}/checklist`
3. 勾選 1-2 項 `Mark Complete`

預期畫面：
- completion 百分比上升

評分點對應：
- FR-09（checklist 勾選）
- FR-12（onboarding 完成率）

### Step 8：切換角色（Manager）審核

1. 回 `/login`，選 `manager@transitionos.local`
2. 進 `/tasks/{id}/approval`
3. 先示範 `Reject`（可選）
4. 再 `Approve`

預期畫面：
- Approval History 有紀錄
- 狀態變更到 `APPROVED`

評分點對應：
- FR-07（主管審核）
- NFR-07 Auditability

### Step 9：匯出（Manager）

1. 進 `/tasks/{id}/export`
2. 匯出 Markdown（handover / onboarding）
3. 匯出 PDF(HTML) 版本

預期畫面：
- 檔案下載成功
- 任務狀態可進入 EXPORTED

評分點對應：
- FR-13（匯出）

## 3. Demo 講稿（1 分鐘結尾）

可直接講：

> 「我們的 MVP 不是文件生成器，而是 transition workflow。  
> 從 task 建立、來源整合、citation-aware generation、人工編修、主管審核，到 onboarding checklist 與匯出，流程完整閉環。  
> 同時滿足 SA&D 的 as-is -> to-be 分析與 functional / nonfunctional requirement 落地。」

## 4. 當場出狀況備案（很重要）

### 備案 A：外部 API token 沒設

- 系統會使用 sample source items，仍可演示完整流程。
- 話術：`MVP 有 connector abstraction，現在是 demo fallback mode。`

### 備案 B：生成按鈕後沒有內容

1. 再按一次 `Generate / Refresh`
2. 檢查 Admin Settings 是否有 enabled 來源
3. 用 seed 任務重新示範

### 備案 C：匯出失敗

- 先確認任務狀態是 `APPROVED`（匯出前置條件）
- 在 Approval 頁再按一次 approve 後重試

## 5. 評分對照速查（可印出）

- 問題與機會：人員流動造成知識流失 + onboarding 不一致
- Key IT capabilities：來源整合、模板生成、citation、審核、追蹤
- Business benefits：交接效率、新人 ramp-up、管理可視化
- Initial analysis：MVP 範圍清楚、可行性與風險控制
- SA&D 要點：角色、流程、需求、NFR、future-state 系統能力

