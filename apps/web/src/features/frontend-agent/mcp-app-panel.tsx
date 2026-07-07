"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentMcpAppUi } from "@agent-template/shared";
import { callMcpTool, fetchMcpAppResource } from "@/lib/agent-client";

export function McpAppPanel({ ui }: { ui: AgentMcpAppUi }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchMcpAppResource({ uri: ui.resource.uri })
      .then((resource) => {
        if (!cancelled) {
          setHtml(resource);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "MCP App resource 加载失败。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ui.resource.uri]);

  useEffect(() => {
    async function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== iframeRef.current?.contentWindow || !isJsonRpcMessage(event.data)) {
        return;
      }

      if (event.data.method !== "tools/call" || event.data.id === undefined) {
        return;
      }

      try {
        const params = isRecord(event.data.params) ? event.data.params : {};
        if (typeof params.name === "string" && params.name !== ui.toolName) {
          throw new Error(`MCP App cannot call undeclared tool: ${params.name}`);
        }

        const args = isRecord(params.arguments) ? params.arguments : {};
        const result = await callMcpTool({ args, serverId: ui.serverId, toolName: ui.toolName });
        postToApp({ id: event.data.id, jsonrpc: "2.0", result });
      } catch (caught) {
        postToApp({
          error: {
            code: -32000,
            message: caught instanceof Error ? caught.message : "MCP tool call failed"
          },
          id: event.data.id,
          jsonrpc: "2.0"
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [ui.serverId, ui.toolName]);

  function initializeApp() {
    postToApp({
      jsonrpc: "2.0",
      method: "ui/initialize",
      params: {
        toolData: ui.toolData,
        toolName: ui.toolName
      }
    });
  }

  function postToApp(message: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>{ui.title}</span>
        <span>{ui.resource.uri}</span>
      </div>
      {html ? (
        <iframe
          className="block h-[430px] w-full rounded-b-md"
          onLoad={initializeApp}
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={html}
          title={ui.title}
        />
      ) : (
        <div className="px-3 py-2 text-sm text-slate-500">正在加载 MCP App...</div>
      )}
    </div>
  );
}

type JsonRpcMessage = {
  id?: number | string;
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
};

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  return isRecord(value) && value.jsonrpc === "2.0";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
