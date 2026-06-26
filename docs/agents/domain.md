# Domain Docs

工程类 skill 在探索代码前，按 single-context 读取项目语境。

## Before exploring, read these

- 根目录 `CONTEXT.md`
- `docs/adr/` 下与当前工作相关的 ADR

如果文件不存在，静默继续，不要因为缺文件而中断。`domain-modeling`、`grill-with-docs`、`improve-codebase-architecture` 会在术语或决策真正明确时懒创建这些文件。

## Layout

```text
/
├── CONTEXT.md
├── docs/adr/
└── apps/
```

## Use the glossary's vocabulary

输出 issue 标题、重构建议、诊断假设、测试名称时，优先使用 `CONTEXT.md` 里定义的项目术语。

## Flag ADR conflicts

如果建议和已有 ADR 冲突，需要明确指出冲突，而不是静默覆盖。
