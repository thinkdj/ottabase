import type { API, BlockTool, BlockToolConstructorOptions } from "@ottabase/ottaeditor";

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

  constructor({ data, config, api }: BlockToolConstructorOptions<AlertData, AlertConfig>) {
    this.api = api;
    this.config = config || {};
    this.data = {
      type: data?.type || this.config.defaultType || "info",
      message: data?.message || "",
    };
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add(CustomAlertPlugin.CSS.baseClass, CustomAlertPlugin.CSS.wrapper);
    wrapper.classList.add(CustomAlertPlugin.CSS[this.data.type]);

    const select = document.createElement("select");
    select.classList.add(CustomAlertPlugin.CSS.select);

    const types: Array<AlertData["type"]> = ["info", "warning", "success", "error"];
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
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .cdx-alert__wrapper {
        padding: 12px;
        border-radius: 8px;
        border-left: 4px solid hsl(var(--border));
        background: hsl(var(--muted));
        color: hsl(var(--foreground));
      }

      .cdx-alert__select,
      .cdx-alert__message {
        display: block;
        width: 100%;
        padding: 8px;
        border: 1px solid hsl(var(--border));
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
      }

      .cdx-alert__select { margin-bottom: 10px; }
      .cdx-alert__message { resize: vertical; min-height: 60px; }

      .cdx-alert--info { border-left-color: hsl(var(--primary)); }
      .cdx-alert--success { border-left-color: hsl(var(--primary)); }
      .cdx-alert--warning { border-left-color: hsl(var(--secondary-foreground)); }
      .cdx-alert--error { border-left-color: hsl(var(--destructive)); }
    `;

    document.head.appendChild(style);
  }
}
