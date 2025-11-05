/**
 * Custom Alert Plugin for OttaEditor Demo
 * This demonstrates how to create and integrate a custom EditorJS plugin
 */

import type {
  API,
  BlockTool,
  BlockToolConstructorOptions,
} from "@ottabase/ottaeditor";

interface AlertConfig {
  defaultType?: "info" | "warning" | "success" | "error";
}

interface AlertData {
  type: "info" | "warning" | "success" | "error";
  message: string;
}

export default class CustomAlertPlugin implements BlockTool {
  private api: API;
  private data: AlertData;
  private config: AlertConfig;
  private wrapper: HTMLElement | null = null;

  static get CSS() {
    return {
      baseClass: "cdx-alert",
      wrapper: "cdx-alert__wrapper",
      select: "cdx-alert__select",
      textarea: "cdx-alert__message",
      info: "cdx-alert--info",
      warning: "cdx-alert--warning",
      success: "cdx-alert--success",
      error: "cdx-alert--error",
    };
  }

  static get toolbox() {
    return {
      title: "Alert",
      icon: '<svg width="17" height="15" viewBox="0 0 336 276"><path d="M291 150l-123 124c-3 3-8 3-11 0L34 151c-3-3-3-8 0-11l11-11c3-3 8-3 11 0l106 107 106-107c3-3 8-3 11 0l11 11c3 3 3 8 0 11z"/></svg>',
    };
  }

  static get enableLineBreaks() {
    return true;
  }

  constructor({
    data,
    config,
    api,
  }: BlockToolConstructorOptions<AlertData, AlertConfig>) {
    this.api = api;
    this.config = config || {};
    this.data = {
      type: data?.type || this.config.defaultType || "info",
      message: data?.message || "",
    };
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add(
      CustomAlertPlugin.CSS.baseClass,
      CustomAlertPlugin.CSS.wrapper,
    );
    wrapper.classList.add(CustomAlertPlugin.CSS[this.data.type]);

    const select = document.createElement("select");
    select.classList.add(CustomAlertPlugin.CSS.select);

    const types: Array<"info" | "warning" | "success" | "error"> = [
      "info",
      "warning",
      "success",
      "error",
    ];
    types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      option.selected = type === this.data.type;
      select.appendChild(option);
    });

    select.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;
      this.data.type = target.value as AlertData["type"];

      wrapper.classList.remove(
        CustomAlertPlugin.CSS.info,
        CustomAlertPlugin.CSS.warning,
        CustomAlertPlugin.CSS.success,
        CustomAlertPlugin.CSS.error,
      );
      wrapper.classList.add(CustomAlertPlugin.CSS[this.data.type]);
    });

    const textarea = document.createElement("textarea");
    textarea.classList.add(CustomAlertPlugin.CSS.textarea);
    textarea.placeholder = "Enter alert message...";
    textarea.value = this.data.message;
    textarea.rows = 3;

    textarea.addEventListener("input", (event) => {
      const target = event.target as HTMLTextAreaElement;
      this.data.message = target.value;
    });

    wrapper.appendChild(select);
    wrapper.appendChild(textarea);

    this.wrapper = wrapper;
    this.addStyles();

    return wrapper;
  }

  save(): AlertData {
    return this.data;
  }

  validate(savedData: AlertData): boolean {
    return savedData.message.trim() !== "";
  }

  private addStyles(): void {
    const styleId = "cdx-alert-styles";

    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .cdx-alert__wrapper {
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid;
        margin: 10px 0;
        transition: background-color 0.2s, border-color 0.2s;
      }

      .cdx-alert__select {
        display: block;
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        background-color: white;
        color: #1f2937;
        transition: background-color 0.2s, border-color 0.2s, color 0.2s;
      }

      .cdx-alert__message {
        display: block;
        width: 100%;
        padding: 8px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        background-color: white;
        color: #1f2937;
        transition: background-color 0.2s, border-color 0.2s, color 0.2s;
      }

      /* Light mode alert types */
      .cdx-alert--info {
        background-color: #eff6ff;
        border-left-color: #3b82f6;
        color: #1e40af;
      }

      .cdx-alert--warning {
        background-color: #fffbeb;
        border-left-color: #f59e0b;
        color: #92400e;
      }

      .cdx-alert--success {
        background-color: #f0fdf4;
        border-left-color: #10b981;
        color: #065f46;
      }

      .cdx-alert--error {
        background-color: #fef2f2;
        border-left-color: #ef4444;
        color: #991b1b;
      }

      /* Dark mode support (Tailwind-style) */
      .dark .cdx-alert__select,
      .dark .cdx-alert__message {
        background-color: #1f2937;
        border-color: #374151;
        color: #f3f4f6;
      }

      .dark .cdx-alert__select:focus,
      .dark .cdx-alert__message:focus {
        border-color: #4b5563;
        outline: none;
      }

      .dark .cdx-alert--info {
        background-color: #1e3a8a;
        border-left-color: #60a5fa;
        color: #dbeafe;
      }

      .dark .cdx-alert--warning {
        background-color: #78350f;
        border-left-color: #fbbf24;
        color: #fef3c7;
      }

      .dark .cdx-alert--success {
        background-color: #064e3b;
        border-left-color: #34d399;
        color: #d1fae5;
      }

      .dark .cdx-alert--error {
        background-color: #7f1d1d;
        border-left-color: #f87171;
        color: #fecaca;
      }
    `;

    document.head.appendChild(style);
  }
}
