# Issue tracker: Local Markdown

本仓库的任务、PRD 和 issue 使用本地 markdown 文件管理，统一放在 `.scratch/`。

## Conventions

- 一个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件：`.scratch/<feature-slug>/PRD.md`
- 实施 issue：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号
- triage 状态写在 issue 文件顶部附近的 `Status:` 行
- 评论和讨论追加到文件底部的 `## Comments` 小节

## When a skill says "publish to the issue tracker"

在 `.scratch/<feature-slug>/` 下创建新文件；目录不存在时先创建目录。

## When a skill says "fetch the relevant ticket"

读取用户给出的本地 markdown 路径。通常用户会直接提供路径或 issue 编号。
