"use client";

import { useEffect, useState } from "react";

type Language = "en" | "zh";

const STORAGE_KEY = "frameflow:language";
const LANGUAGE_EVENT = "frameflow:language";

export const UI_TRANSLATIONS: Record<string, string> = {
  "PRODUCTION WORKSPACE": "制作工作台",
  Overview: "总览",
  Projects: "项目",
  "My Tasks": "我的任务",
  Approvals: "审批",
  Workload: "工作量",
  Assets: "素材库",
  "Project Calendar": "项目日历",
  Members: "成员",
  "Search projects, Batches, files": "搜索项目、批次和文件",
  "Search project, Batch or task file…": "搜索项目、批次或任务文件…",
  "Search FrameFlow": "搜索 FrameFlow",
  "Close search": "关闭搜索",
  "Loading your permitted workspace…": "正在加载你有权限访问的工作区…",
  "Loading member": "正在加载成员",
  "Projects could not load": "无法加载项目",
  "Project list could not be loaded.": "无法加载项目列表。",
  "Retry Project List": "重试项目列表",
  English: "English",
  Chinese: "中文",
  Language: "语言",
  "Interface language": "界面语言",
  "Switch interface language": "切换界面语言",
  "Active Projects": "进行中的项目",
  "Action Required": "需要处理",
  "Action required": "需要处理",
  "Waiting Approval": "等待审批",
  "New Phase Ready": "新阶段已就绪",
  "AVERAGE PROJECT PROGRESS": "项目平均进度",
  "Live Production Control": "实时制作控制台",
  "See what needs attention now.": "查看现在需要处理的事项。",
  "View all": "查看全部",
  "View all tasks": "查看全部任务",
  "Recent Projects": "最近项目",
  "Priority Tasks": "优先任务",
  "Production Pipeline": "制作流程",
  "System healthy": "系统运行正常",
  "All systems operational": "所有系统运行正常",
  "New Project": "新建项目",
  "Create project": "创建项目",
  "Create Project": "创建项目",
  Cancel: "取消",
  Save: "保存",
  Edit: "编辑",
  Delete: "删除",
  Close: "关闭",
  Retry: "重试",
  Continue: "继续",
  Back: "返回",
  "Back to projects": "返回项目列表",
  Open: "打开",
  "Open Project": "打开项目",
  "Open Batch work": "打开批次工作",
  "Project Settings": "项目设置",
  "Delete Project": "删除项目",
  "Project / Client name": "项目 / 客户名称",
  "Project type": "项目类型",
  "Project Type": "项目类型",
  "Project mode": "项目模式",
  Mode: "模式",
  Purpose: "用途",
  "Project start date": "项目开始日期",
  "Project end date": "项目结束日期",
  "Monthly content quota": "每月内容配额",
  "Content rhythm": "内容节奏",
  Continuous: "持续运营",
  "Internal Social Account": "内部社交账号",
  "Client Social Account": "客户社交账号",
  Reels: "短视频",
  Carousel: "轮播图",
  Carousels: "轮播图",
  Images: "图片",
  "Text Only": "纯文字",
  "Client Brief": "客户简报",
  "Market Research": "市场研究",
  "Trend Research": "趋势研究",
  "Creative Direction": "创意方向",
  "Creative Production": "创意制作",
  "Content Ideas": "内容创意",
  "Content Production": "内容制作",
  "Content Production Batches": "内容制作批次",
  "Final Publishing Approval": "最终发布审批",
  Publishing: "发布",
  Performance: "表现",
  Payment: "付款",
  Completion: "完成",
  "Change Request": "修改请求",
  "Foundation Direction": "基础方向",
  Strategy: "策略",
  Script: "脚本",
  Storyboard: "分镜",
  "Visual Script": "视觉脚本",
  "Image Generation": "图片生成",
  "Video Generation": "视频生成",
  "Post Production": "后期制作",
  Review: "审核",
  "Internal Review": "内部审核",
  "Management Review": "管理层审核",
  "Client Review": "客户审核",
  "Client Reviewing": "客户审核中",
  "CURRENT WORK": "当前工作",
  "CURRENT BATCH": "当前批次",
  "CURRENT WORKING VERSION": "当前工作版本",
  "Current Working Version": "当前工作版本",
  "Last Approved Version": "最近批准版本",
  "Revision Comments": "修改意见",
  "Foundation Edit Notifications": "基础内容修改通知",
  "Foundation decision": "基础内容审批决定",
  Approve: "批准",
  Approved: "已批准",
  APPROVED: "已批准",
  Accept: "接受",
  Accepted: "已接受",
  Reject: "拒绝",
  Retake: "重做",
  "Needs Retake": "需要重做",
  "Send selected Retakes": "发送已选重做项",
  "Approve generated Reels": "批准已生成短视频",
  "Submit for Review": "提交审核",
  "Submit for review": "提交审核",
  "Send for Review": "发送审核",
  "Waiting for Management Review": "等待管理层审核",
  "Waiting for Client Review": "等待客户审核",
  "Awaiting Approval": "等待批准",
  Reviewing: "审核中",
  Submitted: "已提交",
  Draft: "草稿",
  Active: "进行中",
  Inactive: "未启用",
  "In Progress": "处理中",
  Ready: "就绪",
  Pending: "待处理",
  Locked: "已锁定",
  Completed: "已完成",
  Paused: "已暂停",
  Failed: "失败",
  "Not started": "未开始",
  "Not Started": "未开始",
  "Not available": "不可用",
  Available: "可用",
  "Available for new work": "可接新任务",
  "Approved work ready to continue": "已批准，可继续下一阶段",
  "Management approval is waiting": "等待管理层批准",
  "Current approved version only": "仅限当前已批准版本",
  "Editable / not approved": "可编辑 / 尚未批准",
  "APPROVED / READY": "已批准 / 已就绪",
  "APPROVED CONTENT": "已批准内容",
  "APPROVED IDEA": "已批准创意",
  "APPROVED ASSET DELIVERY": "已批准素材交付",
  "APPROVED TASK FILES": "已批准任务文件",
  BATCH: "批次",
  PROJECT: "项目",
  FILE: "文件",
  "Task Files": "任务文件",
  "View Task Files": "查看任务文件",
  "AVAILABLE FILES": "可用文件",
  "FINAL TASK OUTPUT": "最终任务输出",
  "File pending": "文件待处理",
  "Download file ↓": "下载文件 ↓",
  "Download .txt": "下载 .txt",
  Copy: "复制",
  Copied: "已复制",
  "Copy prompt": "复制提示词",
  "Copy context": "复制上下文",
  "Copy caption": "复制文案",
  "Copy everything for AI, or download one UTF-8 text file.": "复制全部内容给 AI，或下载一个 UTF-8 文本文件。",
  "Full screen": "全屏",
  "Click to view full size": "点击查看完整尺寸",
  Dismiss: "关闭",
  "Dismiss notification": "关闭通知",
  "Dismiss items after review": "审核后关闭项目",
  "Generated image set": "已生成图片组",
  "Generated Reel ready": "已生成短视频，可审核",
  "Agent prompt not generated yet": "Agent 提示词尚未生成",
  "Agent owns image generation and Review submission.": "Agent 负责图片生成并提交审核。",
  "Agent Work": "Agent 工作",
  "Agent Learning": "Agent 学习",
  "Agent Relay": "Agent 中继",
  "Agent-selected Shot Count": "Agent 选择的镜头数量",
  "AGENT PREPARATION": "AGENT 准备",
  "Connected Agents": "已连接的 Agents",
  Connect: "连接",
  Connected: "已连接",
  Disconnect: "断开连接",
  "Checking secure connection…": "正在检查安全连接…",
  "Google Drive": "Google Drive",
  DRIVE: "DRIVE",
  "API connected": "API 已连接",
  "Authorization expired · reconnect required": "授权已过期 · 需要重新连接",
  "Auto sync paused until reconnection": "重新连接前自动同步已暂停",
  "Assigned people": "已分配人员",
  "Assign responsible people": "分配负责人",
  "Assigned project access": "已分配项目访问权限",
  "Assigned Projects only · Read-only extraction": "仅限已分配项目 · 只读提取",
  "Add Human Member": "添加团队成员",
  "Add member →": "添加成员 →",
  Name: "姓名",
  Email: "邮箱",
  Role: "角色",
  Status: "状态",
  Owner: "负责人",
  Handler: "负责人",
  Management: "管理层",
  "Project Manager": "项目经理",
  Contributor: "执行成员",
  Reviewer: "审核者",
  "AI Agent": "AI Agent",
  All: "全部",
  Today: "今天",
  Date: "日期",
  DUE: "截止",
  Frequency: "频率",
  "Current cycle": "当前周期",
  "Current phase": "当前阶段",
  "Batch status": "批次状态",
  "Batch objective": "批次目标",
  "Batch gate notes": "批次关卡备注",
  "Batch Performance & Learning": "批次表现与学习",
  "Cumulative Performance & Learning": "累计表现与学习",
  "Data Maturity": "数据成熟度",
  "Batch Trend": "批次趋势",
  "Content order": "内容顺序",
  "Content title": "内容标题",
  "Content style": "内容风格",
  "Caption direction": "文案方向",
  "Caption:": "文案：",
  "Final caption": "最终文案",
  "CAPTION & HASHTAGS": "文案与标签",
  CTA: "行动号召",
  Characters: "角色",
  Environments: "环境",
  "Character presence": "角色出现情况",
  "Dialogue Mode": "对白模式",
  "Detailed Timeline": "详细时间线",
  "Duration · Agent selected": "时长 · Agent 选择",
  "Difference from recent content": "与近期内容的差异",
  "Complete story flow": "完整故事流程",
  "Complete readable script": "完整可读脚本",
  "Approved asset plan": "已批准素材计划",
  "Approved shots → visual execution plan": "已批准镜头 → 视觉执行计划",
  "Approve the shot list before opening 07 Visual Script.": "请先批准镜头列表，再进入 07 视觉脚本。",
  "Action:": "操作：",
  "Choose one decision": "请选择一个决定",
  "Choose this video’s Purpose": "选择此视频的用途",
  "Address only the red items": "只处理红色项目",
  "Authoritative revision instructions": "正式修改指示",
  "Amending an approved direction": "修改已批准方向",
  Bilingual: "双语",
  Blank: "空白",
  "English only": "仅英文",
  "Chinese only": "仅中文",
  "English + Chinese": "英文 + 中文",
  "Completion notification": "完成通知",
  "Completion notice active": "完成通知已启用",
  "Create the first Batch to start production.": "创建第一个批次以开始制作。",
  "Each item becomes a versioned task file after production.": "每个项目在制作后都会成为带版本的任务文件。",
  "Every film appears as a separate item during management review. Partial approval is allowed.": "管理层审核时，每支影片会作为独立项目显示，并可部分批准。",
  "Each notification opens the exact Project and Phase.": "每条通知都会打开对应的项目和阶段。",
  "FrameFlow keeps current approved output files here, separated by Batch.": "FrameFlow 会按批次保存当前已批准的输出文件。",
  "FrameFlow owns workflow, permissions and approvals. Providers and Agents execute only the jobs granted by the System Orchestrator.": "FrameFlow 管理工作流、权限和审批。供应商与 Agents 只执行系统编排器授权的任务。",
  "Complete phase context for an AI or assigned handler.": "为 AI 或指定负责人提供完整阶段上下文。",
  "Confirm only after you have published this post yourself.": "仅在你亲自发布此帖后确认。",
  "Choose a connected Destination Profile before publishing.": "发布前请选择已连接的目标账号。",
  "Client Review Link": "客户审核链接",
  "Client Review Link ready": "客户审核链接已就绪",
  "Client review link ready": "客户审核链接已就绪",
  "Active for 3 days": "有效期 3 天",
  "Active for 3 days. Send this link to the client.": "有效期 3 天。请将此链接发送给客户。",
  "Approved First Frame": "已批准首帧",
  "Approved Hook": "已批准开场钩子",
  "APPROVED SCRIPT · READ ONLY": "已批准脚本 · 只读",
  "APPROVED STORYBOARD · READ ONLY": "已批准分镜 · 只读",
  "BATCH HISTORY · READ ONLY": "批次历史 · 只读",
  "DURABLE RECORDS · CONTENT ORDER": "长期记录 · 内容顺序",
  "Completed Outputs Library": "已完成输出库",
};

Object.assign(UI_TRANSLATIONS, {
  "Creative Production": "创意制作",
  Approvals: "审批",
  Workload: "工作量",
  "My Assigned Tasks": "我负责的任务",
  "Terms of Service": "服务条款",
  "Privacy Policy": "隐私政策",
  "Collapse navigation": "收起导航栏",
  "Expand navigation": "展开导航栏",
  "Sync needs attention": "同步需要处理",
  "Sync in progress": "正在同步",
  "Drive connected": "Drive 已连接",
  "Open FrameFlow folder ↗": "打开 FrameFlow 文件夹 ↗",
  "Sync records & uploads": "同步记录与上传文件",
  "Syncing Drive…": "正在同步 Drive…",
  "Drive sync incomplete": "Drive 同步未完成",
  "Ready for owner authorization": "等待负责人授权",
  "OAuth configuration required": "需要配置 OAuth",
  "Reconnect Google Drive →": "重新连接 Google Drive →",
  "Connect Google Drive →": "连接 Google Drive →",
  "View status and progress": "查看状态与进度",
  "Only human intervention required": "仅显示需要人工处理的事项",
  "Submitted and waiting for management": "已提交，等待管理层审核",
  "See which project can continue": "查看哪些项目可以继续",
  "Only Projects that need a human decision or correction": "仅显示需要人工决定或修改的项目",
  "No newly unlocked phase.": "暂无新解锁的阶段。",
  "Live project progress": "实时项目进度",
  "Current stage, completion bar and next action for every visible project": "显示每个可见项目的当前阶段、完成度与下一步",
  "Needs Attention": "需要处理",
  "Brief": "简报",
  "Research": "研究",
  "References": "参考素材",
  "Project References": "项目参考素材",
  "Batch Ideas": "批次创意",
  "2-Week Batch": "两周批次",
  "2-Week Batch Ideas": "两周批次创意",
  "Production": "制作",
  "Reel Video": "短视频",
  "Reel Video Production": "短视频制作",
  "Files": "文件",
  "Complete": "已完成",
  "Assigned": "已分配",
  "Submitted Assignments": "已提交任务",
  "Every completed phase waits here before the project can advance": "每个已完成阶段都会在此等待审核，审核后项目才能继续",
  "Nothing waiting": "暂无待审核事项",
  "Submitted work will appear here.": "已提交的工作会显示在这里。",
  "No edits recorded.": "暂无修改记录。",
  "MANAGEMENT WATCHLIST": "管理层关注列表",
  "Human Workload": "团队工作量",
  "See who is idle, what each person owns, and tasks ongoing for 3 days without submission.": "查看谁目前空闲、每个人负责的工作，以及持续 3 天仍未提交的任务。",
  "Human Members & Active Assignments": "团队成员与当前任务",
  "TIER 4 AGENT WORK": "第 4 层级 AGENT 工作",
  "The single control center for Agent connection, Project automation, and provider execution.": "统一管理 Agent 连接、项目自动化和供应商执行状态。",
  "No Agent task is ready. Assign a Tier 4 Agent to an eligible Social Project and open the next text phase.": "暂无可执行的 Agent 任务。请为符合条件的社交项目分配第 4 层级 Agent，并开启下一个文字阶段。",
  "Agent connection": "Agent 连接",
  "Agent connection ·": "Agent 连接 ·",
  Offline: "离线",
  Online: "在线",
  "no recent heartbeat": "近期没有心跳记录",
  "FrameFlow and provider jobs can continue independently when the Agent is offline.": "即使 Agent 离线，FrameFlow 和供应商任务仍可独立继续。",
  "Project phase:": "项目阶段：",
  "FrameFlow execution:": "FrameFlow 执行状态：",
  "Project automation:": "项目自动化：",
  Enabled: "已启用",
  "Pause Project Automation": "暂停项目自动化",
  "Start Project Automation": "启动项目自动化",
  "TRUSTED PRODUCTION MEMORY": "可信制作记忆",
  "Loading · Approved authority only": "加载中 · 仅采用已批准内容",
  "Last update": "最后更新",
  "Waiting for first record": "等待第一条记录",
  "Memory Export ↓": "导出记忆 ↓",
  "Activity History ↓": "活动记录 ↓",
  "Project Files": "项目文件",
  "Open list⌄": "展开列表⌄",
  RECORDS: "记录",
  "Updating…": "正在更新…",
  "DATE": "日期",
  "PROJECT TYPE": "项目类型",
  "OUTPUT TITLE": "输出标题",
  "VERSION": "版本",
  "TASK FILE": "任务文件",
  "Updating task files…": "正在更新任务文件…",
  "Drafts, work in progress and historical publishing records are intentionally hidden.": "草稿、进行中的工作和历史发布记录已隐藏。",
  "Only current approved production files are shown here; draft and historical delivery records stay out of this view.": "这里只显示当前已批准的制作文件；草稿和历史交付记录不会显示在此视图。",
  "Project dates, assigned work and recurring Batch lifecycle in one view. Members see only Projects assigned to them.": "在一个页面查看项目日期、已分配工作和循环批次进度。成员只会看到分配给自己的项目。",
  "TASK ASSIGNED": "已分配任务",
  "Not set": "未设置",
  "DATES": "日期",
  "NEXT BATCH START": "下一批次开始时间",
  "Not scheduled": "尚未排期",
  "No future Batch record exists yet.": "目前还没有未来批次记录。",
  "Waiting for next Batch": "等待下一批次",
  "Next Batch not scheduled": "下一批次尚未排期",
  "MANAGEMENT CONTROL": "管理控制",
  "People & AI Agents": "成员与 AI Agents",
  "Human members use Tier 1–3. Tier 4 Agent profiles stay here; provider keys and system connections are hidden from normal navigation.": "团队成员使用第 1–3 层级。第 4 层级 Agent 档案保留在此；供应商密钥和系统连接不会出现在普通导航中。",
  "Email remains the member record. Telegram can be linked for login identity only.": "邮箱仍是成员主记录。Telegram 只可用于关联登录身份。",
  "Full name": "姓名",
  "Member email": "成员邮箱",
  "Telegram username": "Telegram 用户名",
  "Permission tier": "权限层级",
  "Tier 1 · Project Manager": "第 1 层级 · 项目经理",
  "Tier 2 · Contributor": "第 2 层级 · 执行成员",
  "Tier 3 · Reviewer": "第 3 层级 · 审核者",
  "Tier 4 · Add AI Agent": "第 4 层级 · 添加 AI Agent",
  "Create multiple Agent profiles here. Each Agent connects its own Bot credential in the hidden settings.": "可在此创建多个 Agent 档案。每个 Agent 在隐藏设置中连接自己的 Bot 凭证。",
  "Agent name": "Agent 名称",
  "Telegram bot username": "Telegram Bot 用户名",
  "Allowed Telegram Chat ID": "允许的 Telegram Chat ID",
  "Agent language": "Agent 语言",
  "Current workflow ceiling": "当前工作范围上限",
  "Continue through Social image production": "继续完成社交图片制作",
  "Save Agent profile →": "保存 Agent 档案 →",
  "Members & Agents": "成员与 Agents",
  "Telegram Login pending": "等待 Telegram 登录",
  "← Back to projects": "← 返回项目列表",
  "Delete Project": "删除项目",
  "Open linked Drive folder ↗": "打开已连接的 Drive 文件夹 ↗",
  "BATCH CONTROL CENTER": "批次控制中心",
  "SELECTED BATCH": "已选择批次",
  Overdue: "已逾期",
  "Open Batch work": "打开批次工作",
  "Batch records stay isolated from every other Batch.": "此批次记录与其他所有批次完全隔离。",
  "One operational status": "统一运行状态",
  "Review overdue Batch": "审核逾期批次",
  "Drive retry needed": "Drive 需要重试",
  "Strategy & Creative Direction": "策略与创意方向",
  "Batch history": "批次历史",
  "⚙ Project Settings · Assign People": "⚙ 项目设置 · 分配人员",
  "Choose an available phase directly from the roadmap.": "可直接从路线图进入已开放阶段。",
  "INTERNAL REVIEW": "内部审核",
  "Phase status and history are recorded independently.": "阶段状态和历史记录会独立保存。",
  "Phase Context Export": "导出阶段上下文",
  "Brief, research source and this phase in one AI-ready text file.": "将简报、研究来源和本阶段内容整理为一个可供 AI 使用的文本文件。",
  "BATCH CONTROL": "批次控制",
  "AGENT (IM) · PROJECT STATUS": "AGENT (IM) · 项目状态",
  "Manage in Workload → Agent Work.": "请前往工作量 → Agent 工作管理。",
  "LAST APPROVED VERSION": "最近批准版本",
  "for reference only": "仅供参考",
  "It remains in history and cannot override this revision.": "该版本会保留在历史记录中，但不能覆盖当前修改。",
  "REVISION COMMENTS": "修改意见",
  "The fields below are the active working version.": "以下字段属于当前工作版本。",
  "Approved-context Autofill": "依据已批准内容自动填充",
  "Uses only the latest Approved upstream context. It remains editable and is labelled rule-based until an LLM provider is securely connected.": "仅使用最新批准的上游内容。在安全连接 LLM 供应商前，内容仍可编辑并标记为规则生成。",
  "SOCIAL PROJECT REFERENCE LIBRARY · TIER 0–1 CONTROL": "社交项目参考素材库 · 第 0–1 层级控制",
  "Switch on only what must stay consistent.": "只启用必须保持一致的参考类别。",
  ENABLED: "已启用",
  Required: "必需",
  Free: "自由生成",
  "current HD images": "当前高清图片",
  "Agent must preserve and attach this reference when a Content Item selects it.": "当内容项目选择此参考类别时，Agent 必须保留并附加对应素材。",
  "Agent may create this element freely when needed.": "需要时 Agent 可以自由设计此元素。",
  "Reference guidance": "参考素材说明",
  "＋ Add reference images": "＋ 添加参考图片",
  "PNG, JPG or WEBP · maximum 4 current images": "PNG、JPG 或 WEBP · 最多保留 4 张当前图片",
  "Upload at least one image before submitting this enabled category.": "提交已启用类别前，请至少上传一张图片。",
  "Company Logo": "公司 Logo",
  "Color Palette": "色彩方案",
  "Props": "道具",
  "Environment": "环境",
  "How Agent uses this library": "Agent 如何使用此素材库",
  "Save Approved Reference Library": "保存已批准参考素材库",
  "Strategic objective": "策略目标",
  "Performance learning": "表现学习",
  "Content pillars": "内容支柱",
  "Format mix": "内容形式组合",
  "Visual direction": "视觉方向",
  "Tone of voice": "品牌语气",
  "Current direction decision": "当前方向决定",
  "Management rationale": "管理层理由",
  "Next batch testing priorities": "下一批次测试重点",
  "Must preserve": "必须保留",
  "Must avoid": "必须避免",
  "AI influencer identity / persona": "AI 网红身份 / 人设",
  "Character continuity requirements": "角色连续性要求",
  "Request Change": "请求修改",
  "2-WEEK CONTENT PLAN": "两周内容计划",
  "The Agent decides what to create and which content style fits.": "Agent 决定要制作什么以及适合的内容风格。",
  "Choose Image, Reel, Carousel or Text Only. Platform selection and this production workflow does not ask for a destination or publishing schedule.": "选择图片、短视频、轮播图或纯文字。此制作流程不会要求选择发布平台、目标账号或发布时间。",
  "PLANNED CONTENTS": "计划内容",
  IDEA: "创意",
  HOOK: "开场钩子",
  "keyframe": "关键帧",
  "visuals": "视觉素材",
  "Agent automation is managed in Workload → Agent Work.": "Agent 自动化请前往工作量 → Agent 工作管理。",
  "IMAGE_TO_VIDEO": "图片生成视频",
  "Image to Video": "图片生成视频",
  "Reel Style · Tier 0–1 decision": "短视频风格 · 第 0–1 层级决定",
  "Select before Agent prompt": "请在 Agent 编写提示词前选择",
  "Cinematic Multi-shot": "电影感多镜头",
  "Reference Motion": "参考动作",
  "Talking Reel": "口播短视频",
  "Kinetic Graphic": "动态图形",
  "workflow not registered": "尚未注册工作流",
  "Locked workflow": "已锁定工作流",
  "Inherited Aspect Ratio · read-only": "继承的画面比例 · 只读",
  "Music Direction": "音乐方向",
  "Selected Project Reference · ref_image_0": "已选择项目参考素材 · ref_image_0",
  "Select Project Reference for ref_image_0": "为 ref_image_0 选择项目参考素材",
  Character: "角色",
  current: "当前版本",
  "previous upload": "之前上传",
  Shot: "镜头",
  "AGENT OUTPUT · PROVIDER-READY MOTION DIRECTION": "AGENT 输出 · 可直接发送供应商的动作方向",
  "Save Reel Setup": "保存短视频设置",
  "Continue Approved Reel Generation": "继续生成已批准短视频",
  "Continue Reel Prompt Revision": "继续修改短视频提示词",
  "Continue Prompt Correction": "继续修正提示词",
  "Return to Reel Prompt Review": "返回短视频提示词审核",
  "Save Reel Setup & Request Prompts": "保存短视频设置并请求提示词",
  "Prompt Review": "提示词审核",
  "Generated Reel accepted · locked": "已接受生成短视频 · 已锁定",
  "Review each generated Reel. Accept it or choose Retake to write an exact correction comment.": "逐一审核每支已生成短视频。接受可直接保留；选择重做时必须填写明确修改意见。",
  "Review each Reel prompt, approved first_frame and selected ref_image_0. Accept it or choose Retake to write an exact correction comment.": "逐一审核每支短视频的提示词、已批准 first_frame 和已选择 ref_image_0。接受可直接保留；选择重做时必须填写明确修改意见。",
  "✓ Approve prompts & generate Reels": "✓ 批准提示词并生成短视频",
  "✓ Approve generated Reels": "✓ 批准已生成短视频",
  "✓ Approve all reviewed items": "✓ 批准所有已审核项目",
  "This Review decision was already submitted.": "此审核决定已经提交。",
  "Select at least one generated Reel as Retake before sending corrections.": "发送修改意见前，请至少将一支已生成短视频标记为重做。",
  "Content frozen during": "内容已冻结：",
  "Review comment": "审核意见",
  "Required for Retake": "重做时必填",
  "Review Sessions used": "已使用审核次数",
  "Uploaded by": "上传者",
  "Drive phase folder lookup failed": "无法找到 Drive 阶段文件夹",
  "Drive retry needed:": "Drive 需要重试：",
  "Download file ↓": "下载文件 ↓",
  "Full screen": "全屏",
  "Copy prompt": "复制提示词",
  "FrameFlow Review": "FrameFlow 审核",
  "Accept this Reel": "接受此短视频",
  "Retake this Reel": "重做此短视频",
  "Write the exact change needed for this item…": "请填写此项目需要修改的具体内容…",
  "Saved successfully": "保存成功",
  "Permission denied": "权限不足",
  "FRAMEFLOW CLIENT REVIEW": "FRAMEFLOW 客户审核",
  "Review unavailable": "无法进行审核",
  "Loading review…": "正在加载审核…",
  "REVIEW SUBMITTED": "审核已提交",
  "Thank you — all approved.": "谢谢，全部内容已批准。",
  "Feedback received.": "已收到反馈。",
  "The production team may now begin the next phase.": "制作团队现在可以开始下一阶段。",
  "The production team will revise only the returned items.": "制作团队只会修改被退回的项目。",
  expires: "到期日",
  "CLIENT APPROVAL": "客户审批",
  "passed internal approval. Previously approved topics stay locked; review only the returned topics below.": "已通过内部审核。之前批准的项目会继续锁定；请只审核下方退回的项目。",
  Topics: "个主题",
  "Locked ✓": "已锁定 ✓",
  "Need Review": "待审核",
  "Ready to submit": "可以提交",
  "Locked approvals are carried forward automatically.": "已锁定的批准结果会自动沿用。",
  "Submit Review": "提交审核",
  "No review image was uploaded.": "尚未上传审核图片。",
  "Previous review comment": "上次审核意见",
  "✓ Approved in an earlier review": "✓ 已在之前的审核中批准",
  "This topic is locked. It remains visible but does not need approval again.": "此主题已锁定。内容仍会显示，但无需再次批准。",
  "Your decision": "你的决定",
  "× Request change": "× 请求修改",
  "Required comment": "必须填写意见",
  "Tell the team exactly what should change…": "请准确告诉团队需要修改什么…",
  "FRAMEFLOW MEMBER IDENTITY": "FRAMEFLOW 成员身份",
  "Telegram login verified": "Telegram 登录已验证",
  "Telegram login unavailable": "Telegram 登录不可用",
  "The Telegram identity could not be verified or this member is not ready to link.": "无法验证 Telegram 身份，或该成员尚未准备好进行关联。",
  "Return to FrameFlow": "返回 FrameFlow",
  "Roadmap and workspace use one confirmed phase source.": "路线图与工作区使用同一个已确认的阶段来源。",
  "Tap the project name to open it. Package projects can expand to show every Video Slot.": "点击项目名称即可打开。组合项目可展开查看所有视频项目。",
  "Assign only the people and Agent responsible for producing and reviewing task files.": "只分配负责制作与审核任务文件的成员和 Agent。",
  "Only management can change assignments.": "只有管理层可以更改分配。",
  "PROJECT CONFIGURATION": "项目配置",
  "PROJECT SETTINGS · PUBLISHING": "项目设置 · 发布",
  "PROJECT SOURCE OF TRUTH": "项目唯一可信来源",
  "PROJECT SOCIAL OPERATIONS": "项目社交运营",
  "Social Connections": "社交账号连接",
  "Connection mode": "连接方式",
  "Connection managed by Tier 0–1. Tokens and credentials are never shown.": "连接由第 0–1 层级管理。系统不会显示 Token 或凭证。",
  "Connector visible for planning; system setup is not available yet.": "连接器可用于规划；系统设置目前尚未开放。",
  "No Project Profile connected.": "尚未连接项目账号。",
  "Reconnect": "重新连接",
  "Make default": "设为默认",
  "Remove": "移除",
  "PROJECT PERFORMANCE · ALL BATCHES": "项目表现 · 所有批次",
  "View project totals across all Batches": "查看所有批次的项目汇总",
  "Choose Batch": "选择批次",
  "Return to Current Batch": "返回当前批次",
  "View Batch": "查看批次",
  "Upcoming Batch": "即将开始的批次",
  "Current Batch": "当前批次",
  "Current production phases belong to Batch": "当前制作阶段属于批次",
  "RECURRING PROJECT · BATCH HISTORY": "循环项目 · 批次历史",
  "Recurring AI Reels": "循环 AI 短视频",
  "Production Cycle": "制作周期",
  "Production rhythm": "制作节奏",
  "Monthly Cycle & Batch Status": "月度周期与批次状态",
  "Monthly commitment": "每月承诺数量",
  "Each Batch opens automatically on its start date. All Idea / Hook / Story items must pass the Batch Gate before production.": "每个批次会在开始日期自动开放。所有创意 / 开场钩子 / 故事项目都必须通过批次关卡后才能进入制作。",
  "Complete and submit its current work before the deadline. Overdue reminders remain visible daily.": "请在截止日期前完成并提交当前工作。逾期提醒会每天持续显示。",
  "Close empty Batch": "关闭空批次",
  "Extend 7 days": "延长 7 天",
  "No Batch is available": "暂无可用批次",
  "Create the Project's Two-week Batch before measuring Performance.": "请先创建项目的两周批次，再开始衡量表现。",
  "Choose a Batch to inspect its own publishing evidence and approved Learning. Project cumulative results stay separate below.": "选择一个批次查看其发布证据和已批准学习结果。项目累计结果会在下方独立显示。",
  "Accumulated from this Project’s published records across all Batches. Only APPROVED / READY Learning is combined; other Projects are excluded.": "汇总此项目所有批次的已发布记录。只合并已批准 / 已就绪的学习结果，不包含其他项目。",
  "Rule-based Autofill": "规则自动填充",
  "Uses the latest Approved upstream context; remains editable.": "使用最新批准的上游内容；仍可编辑。",
  "Save assignment & open next phase →": "保存分配并开启下一阶段 →",
  "Complete Brief & assign people →": "完成简报并分配人员 →",
  "INDIVIDUAL ASSIGNMENT": "个人任务分配",
  "Review feedback": "审核反馈",
  "Approve reopening": "批准重新开启",
  "Open / share review link ↗": "打开 / 分享审核链接 ↗",
  "View uploaded images": "查看已上传图片",
  "Minimum Sufficient Keyshots": "最少必要关键镜头",
  "Extracts decisive visual states only, not a storyboard grid.": "只提取决定性的视觉状态，不生成分镜网格。",
  "Phase unavailable": "阶段不可用",
  "Phase files": "阶段文件",
  "Images, video, audio and documents are versioned in this phase.": "本阶段中的图片、视频、音频和文档都会保留版本记录。",
  "Loading task files…": "正在加载任务文件…",
  "Task files could not load": "无法加载任务文件",
  "No completed task files yet. Finish Content Production or Reel Video Production first.": "尚无已完成的任务文件。请先完成内容制作或短视频制作。",
  "No Content Items planned yet.": "尚未规划内容项目。",
  "Use Autofill for a rule-based starting plan, or add the first Content Item manually.": "可使用自动填充生成规则化初始计划，或手动添加第一个内容项目。",
  "＋ Add content": "＋ 添加内容",
  "Remove this Content Item": "移除此内容项目",
  "Working title": "工作标题",
  "What should this 2-Week Batch achieve?": "这个两周批次需要达成什么目标？",
  "Post title": "帖子标题",
  "Optional tags / keywords": "可选标签 / 关键词",
  "Strategic reason": "策略原因",
  "Visual requirement": "视觉要求",
  "References Agent must use for this Content": "Agent 制作此内容时必须使用的参考素材",
  "Leave all unchecked when this Content should be generated freely.": "如需让 Agent 自由生成此内容，请全部保持未选。",
  "No fixed Project References are enabled. Agent may design every visual element freely.": "未启用固定项目参考素材。Agent 可以自由设计所有视觉元素。",
  "Hook, Title and Caption remain separate.": "开场钩子、标题和文案保持独立。",
  "Reference switches and their role instructions apply only to the next generation or Retake.": "参考素材开关及角色说明只适用于下一次生成或重做。",
  "Prompts are Agent production instructions and are not separate Review items.": "提示词属于 Agent 制作指令，不是独立审核项目。",
  "RunningHub Qwen Image 2.1": "RunningHub Qwen 图片 2.1",
  "Generation references": "生成参考素材",
  "Use approved Content Anchor Image 01 as the primary continuity reference": "使用已批准内容锚点图片 01 作为主要连续性参考",
  "Image generation prompt": "图片生成提示词",
  "Professional image prompt": "专业图片提示词",
  "RETAKE REVIEW · CONTENT COPY": "重做审核 · 内容文案",
  "RETAKE REVIEW · THIS IMAGE": "重做审核 · 此图片",
  "RETAKE REVIEW · THIS REEL": "重做审核 · 此短视频",
  "RETAKE REVIEW FOR CONTENT": "内容重做审核",
  "RETAKE REVIEW FOR THIS FIELD": "此字段重做审核",
  "✓ Copy accepted in the Content Anchor Review · locked": "✓ 文案已在内容锚点审核中接受 · 已锁定",
  "✓ Image accepted in the previous Review · locked": "✓ 图片已在上次审核中接受 · 已锁定",
  "✓ Accepted in the previous review · locked": "✓ 已在上次审核中接受 · 已锁定",
  "✓ Accept": "✓ 接受",
  "× Retake": "× 重做",
  "Generation output is missing. Resume the Agent task; do not submit manually.": "缺少生成结果。请恢复 Agent 任务，不要手动提交。",
  "Tier 0–1 selects the Reel Style before the Agent writes a prompt.": "第 0–1 层级需在 Agent 编写提示词前选择短视频风格。",
  "IMAGE_TO_VIDEO uses the approved Content Anchor as first_frame. Management selects ref_image_0 during Prompt Review.": "图片生成视频会使用已批准的内容锚点作为 first_frame。管理层会在提示词审核时选择 ref_image_0。",
  "Select the Reel Style first. The Agent output will appear here for Tier 0–1 approval.": "请先选择短视频风格。Agent 输出会显示在此处，等待第 0–1 层级批准。",
  "Normal path: existing Orchestrator → RunningHub MiniMax H3 → versioned FrameFlow Reel": "标准路径：现有编排器 → RunningHub MiniMax H3 → 带版本记录的 FrameFlow 短视频",
  "Photo, Carousel and Threads items do not enter IMAGE_TO_VIDEO production.": "图片、轮播图和 Threads 内容不会进入图片生成视频流程。",
  "No Reel items in this approved Batch": "此已批准批次中没有短视频项目",
  "PUBLISHING CONTROL": "发布控制",
  "Publishing queue": "发布队列",
  "Publishing notes": "发布备注",
  "Destination Profile": "目标账号",
  "Select profile": "选择账号",
  "Profile URL": "账号链接",
  "Publish on": "发布时间",
  "Schedule": "排期",
  "Scheduled": "已排期",
  "Published": "已发布",
  "Live post URL": "线上帖子链接",
  "Post ID": "帖子 ID",
  "Media ID": "媒体 ID",
  "Open Live Post ↗": "打开线上帖子 ↗",
  "Open / edit on platform ↗": "在平台打开 / 编辑 ↗",
  "Required after publishing": "发布后必填",
  "Manual publishing fallback": "手动发布备用方案",
  "Records are created automatically from the approved Two-week Batch schedule after Production approval.": "制作批准后，系统会根据已批准的两周批次排期自动创建记录。",
  "Only one Batch is shown at a time. Choose an older Batch here to review its status and live posts.": "每次只显示一个批次。可在此选择较早批次，查看其状态和线上帖子。",
  "No Publishing Records for": "没有发布记录：",
  "Retry Publishing": "重试发布",
  "Performance": "表现",
  "Previous Batch Comparison": "上一批次对比",
  "Top Content": "最佳内容",
  "Next Batch Learning Input": "下一批次学习输入",
  "APPROVED LEARNED MEMORY · SAME PROJECT": "已批准学习记忆 · 同一项目",
  "BATCH PERFORMANCE · PROJECT-SCOPED": "批次表现 · 仅限本项目",
  "Pending or unreviewed evidence is excluded. Approve this Batch's Learning before it can influence the next Batch.": "待处理或尚未审核的证据不会纳入。请先批准本批次学习结果，才能用于下一批次。",
  "No Learning Candidate exists for this Batch yet.": "本批次尚无学习候选内容。",
  "This is the first measurable Batch for this Project.": "这是此项目第一个可衡量的批次。",
  "Verified rankings appear after this Batch's first Performance Sync.": "本批次首次表现同步后，会显示已验证排名。",
  "Trend uses the latest provider snapshot per post and never adds duplicate snapshots.": "趋势分析只使用每篇帖子的最新供应商快照，不会重复添加快照。",
  "Schedule → Auto publish → Measure → Learn": "排期 → 自动发布 → 衡量 → 学习",
  "Scope boundary": "范围边界",
  "Official API / OAuth": "官方 API / OAuth",
  "Temporary Publishing Storage · automatic": "临时发布存储 · 自动",
  "At the scheduled time, FrameFlow creates a short-lived public copy for Meta / Threads. Original Project assets remain private.": "到达排期时间时，FrameFlow 会为 Meta / Threads 创建短期公开副本。项目原始素材仍保持私密。",
  "Sent when Agent work finishes": "Agent 工作完成时发送",
  "When Agent work finishes, FrameFlow keeps sending the existing Telegram completion notification. The file itself stays in this Project.": "Agent 工作完成后，FrameFlow 会继续发送现有 Telegram 完成通知；文件本身仍保留在此项目中。",
  "TELEGRAM NOTICE": "TELEGRAM 通知",
  "Final files manually delivered": "最终文件已手动交付",
  "Project Completion": "项目完成",
  "Payment fully cleared": "付款已全部结清",
  "PAYMENT GATE": "付款关卡",
  "Production opens at 25% or 50%. Final Delivery requires 100%.": "付款达到 25% 或 50% 时开放制作；最终交付需要 100%。",
  "Save generation settings": "保存生成设置",
  "Save draft": "保存草稿",
  "Download": "下载",
  "Open file": "打开文件",
  "Connected ·": "已连接 ·",
  "Sync needs attention ·": "同步需要处理 ·",
  "folders linked": "个文件夹已连接",
  "active project": "个进行中的项目",
  "active projects": "个进行中的项目",
  "· every alert below opens the exact project that needs attention.": "· 下方每条提醒都会打开需要处理的准确项目。",
  "% complete": "% 已完成",
  "assignable people": "位可分配成员",
  "activity events": "条活动记录",
  "planned item": "项计划内容",
  "planned items": "项计划内容",
  "item": "项",
  "items": "项",
  "· compact Drive access": "· 精简 Drive 访问",
  "· Approved authority only": "· 仅采用已批准内容",
  "· Drive:": "· Drive：",
  "· Manage in Workload → Agent Work.": "· 请前往工作量 → Agent 工作管理。",
  "· Full Agent Prompt": "· 完整 Agent 提示词",
  "· expires": "· 到期日",
  "/4 current HD images": "/4 张当前高清图片",
  "files⌄": "个文件⌄",
  "linked Project folder": "个已连接项目文件夹",
  "current file": "个当前文件",
  "planned contents": "项计划内容",
  "profiles connected": "个账号已连接",
  "published": "已发布",
  "connected": "已连接",
  "synced": "已同步",
  "available": "可用",
  "edited": "已编辑",
  "enabled": "已启用",
  "approved": "已批准",
  "records": "条记录",
  "posts": "篇帖子",
  "profile": "个账号",
  "views / reach": "观看次数 / 覆盖人数",
  "views": "观看次数",
  "engagement": "互动",
});

Object.assign(UI_TRANSLATIONS, {
  English: "英文",
  "Drive sync incomplete": "Drive 同步未完成",
  "Open required action": "打开待处理事项",
  "Open required action →": "打开待处理事项 →",
  "Open exact review →": "打开对应审核 →",
  "Phases in Review": "审核中的阶段",
  "Market:": "市场：",
  "Trend:": "趋势：",
  Assigned: "已分配",
  "Policy active": "政策已启用",
  "Last update": "最近更新",
  "Waiting for first record": "等待第一条记录",
  Refresh: "刷新",
  "Final Approved": "最终已批准",
  "Open all": "打开全部",
  "Open file ↗": "打开文件 ↗",
  "to End TBC": "至结束日期待定",
  DATES: "日期",
  "Only records you can access are shown.": "仅显示你有权访问的记录。",
  browse: "浏览",
  close: "关闭",
  "Telegram Login": "Telegram 登录",
  configured: "已配置",
  pending: "待处理",
  "Not linked": "未关联",
  "identity only": "仅用于身份验证",
  "Agent profile connected": "Agent 档案已连接",
  "Agent connection": "Agent 连接",
  "Outbound connected": "出站连接正常",
  Offline: "离线",
  Online: "在线",
  Me: "我",
  "Temporary campaign facts stay in this Project. Stable brand facts belong in Client Profile.": "临时活动资料保留在本项目中；稳定的品牌资料应存入客户档案。",
  "Client Brief · AI Context": "客户简报 · AI 上下文",
  "Prepared by / Project Manager": "准备人 / 项目经理",
  "Client / Brand": "客户 / 品牌",
  "Brand / product background": "品牌 / 产品背景",
  "Project goal": "项目目标",
  "Target audience": "目标受众",
  Deliverables: "交付内容",
  "Key message / offer": "核心信息 / 优惠",
  "Tone / visual direction": "语气 / 视觉方向",
  "Must include / avoid": "必须包含 / 避免",
  "Market situation": "市场情况",
  "Audience insight": "受众洞察",
  "Competitor patterns": "竞品模式",
  "Current opportunities": "当前机会",
  "Verified references / URLs": "已验证参考资料 / 链接",
  "Switch on only what must stay consistent.": "只启用必须保持一致的参考类别。",
  "Enabled references are continuity-locked and available to Agent. Tier 0–1 may replace the current image set at any time; older versions remain in history and are never sent to new Agent jobs.": "已启用的参考素材会锁定连续性并提供给 Agent。第 0–1 层级可随时替换当前图片组；旧版本仅保留在历史记录中，不会发送到新的 Agent 任务。",
  ENABLED: "已启用",
  Character: "角色",
  Required: "必需",
  Free: "自由生成",
  "Agent must preserve and attach this reference when a Content Item selects it.": "内容项目选择此类别时，Agent 必须保留并附上该参考素材。",
  "Reference guidance": "参考说明",
  "＋ Add reference images": "＋ 添加参考图片",
  "PNG, JPG or WEBP · maximum 4 current images": "PNG、JPG 或 WEBP · 当前最多 4 张图片",
  "Upload at least one image before submitting this enabled category.": "提交已启用类别前，请至少上传一张图片。",
  "Company Logo": "公司标志",
  Product: "产品",
  "Color Palette": "配色方案",
  Props: "道具",
  Environment: "环境",
  "Agent may create this element freely when needed.": "需要时，Agent 可自由创建此元素。",
  "How Agent uses this library": "Agent 如何使用此素材库",
  "In 2-Week Batch Ideas, every Content Item selects only the reference categories it actually needs. Those exact current files then follow the Content into image and Reel generation.": "在两周批次创意中，每个内容项目只选择实际需要的参考类别；所选的当前文件会随该内容进入图片与短视频生成。",
  "Save Approved Reference Library": "保存已批准参考素材库",
  "Uses only the latest Approved upstream context. It remains editable and is labelled rule-based until an LLM provider is securely connected.": "仅使用最新批准的上游内容。在安全连接 LLM 供应商前，内容仍可编辑并标记为规则生成。",
  "LAST APPROVED VERSION": "最近批准版本",
  "It remains in history and cannot override this revision.": "该版本仅保留在历史记录中，不能覆盖当前修订。",
  "The fields below are the active working version.": "以下字段属于当前工作版本。",
  "Strategic objective": "策略目标",
  "Performance learning": "表现学习",
  "Content pillars": "内容支柱",
  "Format mix": "形式组合",
  "Visual direction": "视觉方向",
  "Tone of voice": "品牌语气",
  "Current direction decision": "当前方向决定",
  "KEEP CURRENT DIRECTION": "保持当前方向",
  "PROPOSE ADJUSTMENT": "建议调整",
  "Management rationale": "管理层理由",
  "Next batch testing priorities": "下一批次测试重点",
  "Must preserve": "必须保留",
  "Must avoid": "必须避免",
  "AI influencer identity / persona": "AI 网红身份 / 人设",
  "Character continuity requirements": "角色连续性要求",
  "Request Change": "请求修改",
  "2-WEEK CONTENT PLAN": "两周内容计划",
  "The Agent decides what to create and which content style fits.": "Agent 决定要制作的内容及适合的内容风格。",
  "Choose Image, Reel, Carousel or Text Only. Platform selection and this production workflow does not ask for a destination or publishing schedule.": "请选择图片、短视频、轮播图或纯文字。此制作流程不要求选择发布平台、目标账号或发布时间。",
  "PLANNED CONTENTS": "计划内容",
  IDEA: "创意",
  HOOK: "开场钩子",
  "CONTENT ANCHOR QUALITY GATE": "内容锚点质量关卡",
  "Review one approved anchor per Content": "每项内容审核一个批准锚点",
  "1K generation · two role-scoped references. Character Anchors use the full-body diagram plus facial identity; Continuations use the facial identity plus the approved first Anchor.": "1K 生成 · 使用两个限定角色的参考素材。角色锚点使用全身图与面部身份；延续图使用面部身份与已批准的首个锚点。",
  "ANCHOR PROMPT · REEL KEYFRAME 01": "锚点提示词 · 短视频关键帧 01",
  ANCHOR: "锚点",
  "Upscaled master ready": "高清放大母版已就绪",
  "Generation references": "生成参考素材",
  "Default: lowest image size + Medium thinking + 2 core references. Uncheck Character for prop shots, product details or any visual without a person.": "默认：最低图片尺寸 + 中等思考 + 2 个核心参考素材。道具镜头、产品细节或无人画面请取消选择角色参考。",
  "View Agent Anchor Prompt": "查看 Agent 锚点提示词",
  "Upscaled master": "高清放大母版",
  "PROJECT FILE ARCHIVE": "项目文件归档",
  "Choose a Batch to view only that Batch’s current output files.": "选择一个批次，仅查看该批次当前的输出文件。",
  "View Batch files": "查看批次文件",
  "DELIVERY SCOPE": "交付范围",
  "Drive Retry Needed": "需要重试 Drive",
  "Drive Phase Folder Lookup Failed": "Drive 阶段文件夹查找失败",
  "Uploaded by system:runninghub": "由 system:runninghub 上传",
  "INDIVIDUAL ASSIGNMENT": "个人任务分配",
  "Assign responsible people": "分配负责人",
  "Assign only the people and Agent responsible for producing and reviewing task files.": "只分配负责制作与审核任务文件的成员和 Agent。",
  "Save assignment & open next phase →": "保存分配并开启下一阶段 →",
  "Phase status and history are recorded independently.": "阶段状态与历史记录会独立保存。",
  "Phase Context": "阶段上下文",
  "Export Brief, research source and this phase in one AI-ready text file.": "将简报、研究来源与本阶段导出为一份可供 AI 使用的文本文件。",
  "Agent submitted the revised working version below for Review.": "Agent 已在下方提交修订后的工作版本，等待审核。",
  "workflow not registered": "工作流尚未注册",
  "Locked workflow": "已锁定工作流",
  "current": "当前版本",
  "previous upload": "先前上传",
  "AGENT OUTPUT · PROVIDER-READY MOTION DIRECTION": "AGENT 输出 · 可直接发送供应商的动作方向",
  "words · first frame": "个英文词 · 首帧",
  performance: "表现",
  camera: "镜头",
  continuity: "连续性",
  "MANAGEMENT REVIEW": "管理层审核",
  Motion: "动作",
  "Generated Reel": "已生成短视频",
  "No edits recorded.": "暂无修改记录。",
  "No Agent task is ready. Assign a Tier 4 Agent to an eligible Social Project and open the next text phase.": "暂无可执行的 Agent 任务。请为符合条件的社交项目分配第 4 层级 Agent，并开启下一个文字阶段。",
  "AI Context": "AI 上下文",
  "Must include / 必须避免": "必须包含 / 必须避免",
  "↻ Replace current reference set": "↻ 替换当前参考素材组",
  "Creates new versions · previous files remain in history": "创建新版本 · 旧文件保留在历史记录中",
  "Pending Drive sync": "等待 Drive 同步",
  "Generation references · 2/2 reference roles": "生成参考素材 · 2/2 个参考角色",
  "visual asset": "个视觉素材",
  "visual assets": "个视觉素材",
  "reference role": "个参考角色",
  "reference roles": "个参考角色",
  "· workflow not registered": "· 工作流尚未注册",
  words: "个英文词",
  "MANAGEMENT REVIEW ·": "管理层审核 ·",
  "Motion + Generated Reel": "动作与生成短视频",
  "· current": "· 当前版本",
  "· previous upload": "· 先前上传",
  "· Pending Drive sync": "· 等待 Drive 同步",
  "✓ Approved version": "✓ 已批准版本",
  "✓ Approved Brief": "✓ 已批准简报",
  "Uploaded by": "上传者",
  Tier: "层级",
  "· Me": "· 我",
});

const lowerTranslations = new Map(
  Object.entries(UI_TRANSLATIONS).map(([key, value]) => [key.toLowerCase(), value]),
);

const preservedSelector = [
  "[data-i18n-ignore]",
  "textarea",
  "pre",
  "code",
  "script",
  "style",
  "[contenteditable='true']",
  ".project-title h4",
  ".detail-hero h2",
  ".global-search-group button b",
  ".reel-video-head b",
  ".reel-prompt-review header b",
  ".production-content-card > summary b",
  ".production-content-card > summary p",
  ".field-retake-feedback p",
].join(",");

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["placeholder", "aria-label", "title"] as const;

function translateUnit(value: string) {
  const exact = UI_TRANSLATIONS[value] || lowerTranslations.get(value.toLowerCase());
  if (exact) return exact;

  let match = value.match(/^Batch\s+(\d+)$/i);
  if (match) return `批次 ${match[1]}`;
  match = value.match(/^Content\s+(\d+)$/i);
  if (match) return `内容 ${match[1]}`;
  match = value.match(/^Version\s+(\d+)$/i);
  if (match) return `版本 ${match[1]}`;
  match = value.match(/^Phase\s+(\d+)$/i);
  if (match) return `阶段 ${match[1]}`;
  match = value.match(/^(\d+)\s+active projects?$/i);
  if (match) return `${match[1]} 个进行中的项目`;
  match = value.match(/^(\d+)\s+files?$/i);
  if (match) return `${match[1]} 个文件`;
  match = value.match(/^(\d+)\s+items?$/i);
  if (match) return `${match[1]} 项`;
  match = value.match(/^(\d+)\s+planned items?$/i);
  if (match) return `${match[1]} 项计划内容`;
  match = value.match(/^(\d+)\s+assignable people$/i);
  if (match) return `${match[1]} 位可分配成员`;
  match = value.match(/^(\d+)\s+activity events?$/i);
  if (match) return `${match[1]} 条活动记录`;
  match = value.match(/^(\d+)\s+approved$/i);
  if (match) return `${match[1]} 项已批准`;
  match = value.match(/^(\d+)\s+profiles?$/i);
  if (match) return `${match[1]} 个档案`;
  match = value.match(/^(\d+)\s+shots?$/i);
  if (match) return `${match[1]} 个镜头`;
  match = value.match(/^(\d+)\s+words?$/i);
  if (match) return `${match[1]} 个英文词`;
  match = value.match(/^(\d+)\/(\d+)\s+current HD images$/i);
  if (match) return `${match[1]}/${match[2]} 张当前高清图片`;
  match = value.match(/^(\d+)\s+visuals?$/i);
  if (match) return `${match[1]} 个视觉素材`;
  match = value.match(/^(\d+)\s+keyframes?$/i);
  if (match) return `${match[1]} 个关键帧`;
  match = value.match(/^(\d+)\s+Topics$/i);
  if (match) return `${match[1]} 个主题`;
  match = value.match(/^(\d+)\s+Locked\s+✓$/i);
  if (match) return `${match[1]} 个已锁定 ✓`;
  match = value.match(/^(\d+)\s+Need Review$/i);
  if (match) return `${match[1]} 个待审核`;
  match = value.match(/^Review\s+(\d+)\s+open topics?$/i);
  if (match) return `审核 ${match[1]} 个未完成主题`;
  match = value.match(/^(.+) is now linked to a verified Telegram identity\. No Project permission or task action was granted\.$/i);
  if (match) return `${match[1]} 已关联到已验证的 Telegram 身份。此操作不会授予任何项目权限或任务操作权限。`;
  match = value.match(/^(\d+)%\s+complete$/i);
  if (match) return `完成 ${match[1]}%`;
  match = value.match(/^Overdue by\s+(\d+)\s+days?\.?$/i);
  if (match) return `已逾期 ${match[1]} 天。`;
  match = value.match(/^Batch\s+(\d+)\s+is overdue$/i);
  if (match) return `批次 ${match[1]} 已逾期`;
  match = value.match(/^Version\s+(\d+)\s+·\s+for reference only$/i);
  if (match) return `版本 ${match[1]} · 仅供参考`;
  match = value.match(/^v\s*(\d+)$/i);
  if (match) return `版本 ${match[1]}`;
  match = value.match(/^(\d+)\/(\d+)\s+folders linked$/i);
  if (match) return `已连接 ${match[1]}/${match[2]} 个文件夹`;
  match = value.match(/^Tier\s+(\d+)$/i);
  if (match) return `层级 ${match[1]}`;
  match = value.match(/^(\d+)\s+ready for your review$/i);
  if (match) return `${match[1]} 项已可供你审核`;
  match = value.match(/^(\d+)\s+items? failed$/i);
  if (match) return `${match[1]} 项失败`;
  match = value.match(/^Open all\s+(\d+)\s+files?⌄$/i);
  if (match) return `打开全部 ${match[1]} 个文件⌄`;
  match = value.match(/^Final Approved\s+·\s+(\d+)\s+files?$/i);
  if (match) return `最终已批准 · ${match[1]} 个文件`;
  match = value.match(/^(\d+)\s+(profile|profiles)\s+·\s+Telegram Login\s+(configured|pending)$/i);
  if (match) return `${match[1]} 个档案 · Telegram 登录${match[3].toLowerCase() === "configured" ? "已配置" : "待处理"}`;
  match = value.match(/^Telegram Login:\s*(.+?)\s+·\s+identity only$/i);
  if (match) return `Telegram 登录：${translateUnit(match[1])} · 仅用于身份验证`;
  match = value.match(/^Agent connection:\s*(.+)$/i);
  if (match) return `Agent 连接：${translateUnit(match[1])}`;
  match = value.match(/^(Brief|Market|Trend):\s*(.+)$/i);
  if (match) {
    const labels: Record<string, string> = { brief: "简报", market: "市场", trend: "趋势" };
    return `${labels[match[1].toLowerCase()]}：${translateUnit(match[2])}`;
  }
  match = value.match(/^(Project phase|FrameFlow execution|Project automation):\s*(.+)$/i);
  if (match) {
    const labels: Record<string, string> = {
      "project phase": "项目阶段",
      "frameflow execution": "FrameFlow 执行状态",
      "project automation": "项目自动化",
    };
    return `${labels[match[1].toLowerCase()]}：${translateUnit(match[2])}`;
  }
  match = value.match(/^Last update\s+·\s+(.+)$/i);
  if (match) {
    const stamp = match[1].match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec),\s*(\d{1,2}:\d{2})\s*(am|pm)$/i);
    if (stamp) {
      const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
      return `最近更新 · ${months[stamp[2].toLowerCase()]}月${Number(stamp[1])}日 ${stamp[4].toLowerCase() === "pm" ? "下午" : "上午"} ${stamp[3]}`;
    }
    return `最近更新 · ${match[1]}`;
  }
  match = value.match(/^to\s+End TBC$/i);
  if (match) return "至结束日期待定";
  match = value.match(/^DATES\s+·\s+(.+)$/i);
  if (match) return `日期 · ${match[1]}`;
  match = value.match(/^✓\s+Approved Brief\s+v(\d+)$/i);
  if (match) return `✓ 已批准简报 版本 ${match[1]}`;
  match = value.match(/^✓\s+Approved version\s+(\d+)$/i);
  if (match) return `✓ 已批准版本 ${match[1]}`;
  match = value.match(/^(.+?)\s*·\s*workflow not registered$/i);
  if (match) return `${translateUnit(match[1])} · 工作流尚未注册`;
  match = value.match(/^·\s*workflow not registered$/i);
  if (match) return "· 工作流尚未注册";
  match = value.match(/^Locked workflow\s+(.+)$/i);
  if (match) return `已锁定工作流 ${match[1]}`;
  match = value.match(/^v(\d+)\s*·\s*(current|previous upload|Pending Drive sync)$/i);
  if (match) return `版本 ${match[1]} · ${translateUnit(match[2])}`;
  match = value.match(/^Uploaded by\s+(.+?)\s*·\s*(.+)$/i);
  if (match) return `由 ${match[1]} 上传 · ${match[2]}`;
  match = value.match(/^(\d+)\s+words\s*·\s*first frame\s*→\s*performance\s*→\s*camera\s*→\s*continuity$/i);
  if (match) return `${match[1]} 个英文词 · 首帧 → 表现 → 镜头 → 连续性`;
  match = value.match(/^MANAGEMENT REVIEW\s*·\s*Reel\s+(\d+)\s*·\s*Motion\s*\+\s*Generated Reel$/i);
  if (match) return `管理层审核 · 短视频 ${match[1]} · 动作与生成结果`;
  match = value.match(/^Reel\s+(\d+)$/i);
  if (match) return `短视频 ${match[1]}`;
  match = value.match(/^·\s*(current|previous upload|Pending Drive sync)$/i);
  if (match) return `· ${translateUnit(match[1])}`;
  match = value.match(/^v(\d+)\s*·\s*Drive retry needed:\s*Drive phase folder lookup failed:\s*(.+)$/i);
  if (match) return `版本 ${match[1]} · 需要重试 Drive：无法找到 Drive 阶段文件夹：${match[2]}`;
  match = value.match(/^Drive Retry Needed:\s*Drive Phase Folder Lookup Failed:\s*(.+)$/i);
  if (match) return `需要重试 Drive：无法找到 Drive 阶段文件夹：${match[1]}`;
  match = value.match(/^(\d+)\s+visual assets?$/i);
  if (match) return `${match[1]} 个视觉素材`;
  match = value.match(/^(\d+)\/(\d+)\s+reference roles?$/i);
  if (match) return `${match[1]}/${match[2]} 个参考角色`;
  match = value.match(/^Tier\s+(\d+)\s*·\s*(.+)$/i);
  if (match) return `第 ${match[1]} 层级 · ${translateUnit(match[2])}`;
  match = value.match(/^(.+?)\s*·\s*Me$/i);
  if (match) return `${match[1]} · 我`;
  match = value.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    return `${match[3]}年${months[match[2].toLowerCase()]}月${Number(match[1])}日`;
  }
  return value;
}

export function translateUiText(value: string) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.slice(leading.length, value.length - trailing.length);
  if (!core) return value;

  const translateComposite = (input: string): string => {
    const direct = translateUnit(input);
    if (direct !== input) return direct;
    for (const separator of [" · ", " → ", " / "]) {
      if (!input.includes(separator)) continue;
      const pieces = input.split(separator);
      const translated = pieces.map(translateComposite);
      if (translated.some((part, index) => part !== pieces[index])) {
        return translated.join(separator);
      }
    }
    return input;
  };
  const translated = translateComposite(core);
  return translated === core ? value : `${leading}${translated}${trailing}`;
}

function isPreserved(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
  return Boolean(element?.closest(preservedSelector));
}

function processTextNode(node: Text, language: Language) {
  if (isPreserved(node)) return;
  const knownOriginal = originalText.get(node);
  if (language === "en") {
    if (knownOriginal !== undefined && node.data !== knownOriginal) node.data = knownOriginal;
    return;
  }

  let source = knownOriginal;
  if (source === undefined) {
    source = node.data;
    originalText.set(node, source);
  } else if (node.data !== source && node.data !== translateUiText(source)) {
    source = node.data;
    originalText.set(node, source);
  }
  const translated = translateUiText(source);
  if (node.data !== translated) node.data = translated;
}

function processElement(element: Element, language: Language) {
  if (element.matches(preservedSelector) || element.closest("[data-i18n-ignore]")) return;
  let originals = originalAttributes.get(element);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(element, originals);
  }
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    let source = originals.get(attribute);
    if (source === undefined) {
      source = current;
      originals.set(attribute, source);
    } else if (current !== source && current !== translateUiText(source)) {
      source = current;
      originals.set(attribute, source);
    }
    const next = language === "zh" ? translateUiText(source) : source;
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function translateDocument(language: Language) {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.language = language;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) processTextNode(node as Text, language);
    else processElement(node as Element, language);
    node = walker.nextNode();
  }
}

export default function LanguageSwitch() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setLanguage(saved === "zh" ? "zh" : "en");
  }, []);

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        translateDocument(language);
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    window.localStorage.setItem(STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: language }));
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [language]);

  return (
    <div className="language-switch" role="group" aria-label="Switch interface language">
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "zh" ? "active" : ""}
        aria-pressed={language === "zh"}
        onClick={() => setLanguage("zh")}
      >
        中文
      </button>
    </div>
  );
}
