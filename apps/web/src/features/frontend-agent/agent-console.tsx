"use client";

import { FormEvent, useState } from "react";
import { Button } from "@agent-template/ui";
import type { AgentRunEvent, AgentRunResult } from "@agent-template/shared";
import { streamAgentChat } from "@/lib/agent-client";
import { AgentRunTimeline } from "./agent-run-timeline";

type AgentConsoleStatus = "idle" | "submitting" | "running" | "completed" | "skipped" | "failed";

export function AgentConsole() {
  const [prompt, setPrompt] = useState("");
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AgentConsoleStatus>("idle");
  const submitting = status === "submitting" || status === "running";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEvents([]);
    setResult(null);

    if (!prompt.trim()) {
      setError("请输入 Agent 请求。");
      setStatus("failed");
      return;
    }

    setStatus("submitting");
    try {
      const chatResult = await streamAgentChat({
        prompt,
        onEvent(event) {
          setEvents((current) => [...current, event]);
          setStatus("running");
        }
      });

      setResult(chatResult);
      setEvents(chatResult.events ?? []);
      setStatus(chatResult.status === "skipped" ? "skipped" : chatResult.status);
    } catch (caught) {
      setError(getAgentChatErrorMessage(caught));
      setStatus("failed");
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Prompt</span>
        <textarea
          className="min-h-36 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition focus:border-slate-400"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述你希望 Agent 完成的工作"
          value={prompt}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button disabled={submitting} type="submit">
          {submitting ? "运行中..." : status === "failed" ? "重试" : "发送给 Agent"}
        </Button>
        <p aria-live="polite" className={status === "failed" ? "text-sm text-red-600" : "text-sm text-slate-500"}>
          {getStatusText(status, error)}
        </p>
      </div>

      {result ? (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p className={result.status === "failed" ? "text-sm font-medium text-red-700" : "text-sm font-medium text-green-700"}>
            Agent 回复
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-950">
            {result.output ?? result.reason ?? "Agent 未返回内容。"}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Runtime: {result.runtime} / Model: {result.model}
          </p>
        </section>
      ) : null}

      <AgentRunTimeline events={events} />
    </form>
  );
}

function getStatusText(status: AgentConsoleStatus, error: string) {
  if (status === "submitting") {
    return "正在连接 Agent Chat...";
  }

  if (status === "running") {
    return "Agent 正在执行。";
  }

  if (status === "completed") {
    return "Agent 已完成回复。";
  }

  if (status === "skipped") {
    return "Agent runtime 未配置，未执行。";
  }

  if (status === "failed") {
    return error;
  }

  return "准备开始新的 Agent run。";
}

function getAgentChatErrorMessage(caught: unknown) {
  if (!(caught instanceof Error)) {
    return "启动 Agent run 失败，请重试。";
  }

  if (caught.message.startsWith("Agent chat rejected the request with status ")) {
    return `后端拒绝了 Agent Chat 请求（状态码 ${caught.message.split(" ").at(-1)}）。`;
  }

  if (caught.message === "Unable to reach Agent chat API") {
    return "无法连接 Agent Chat API，请检查网络或后端服务。";
  }

  return caught.message;
}
