// ex-UIMessageDisplay

import {
  IconAlertSquareRounded,
  IconHelpSquareRounded,
  IconInfoSquareRounded,
  IconLoader,
  IconLockSquareRounded,
  IconSquareRoundedCheck,
  IconSquareRoundedX,
  IconWifiOff,
} from "@tabler/icons-react";
import React from "react";

type SkeletonVariant = "spinner" | "skeleton";

export type MessageTypes =
  | "info"
  | "error"
  | "warning"
  | "success"
  | "help"
  | "loginRequired"
  | "disconnected"
  | "loading";

export interface MessageBoxProps {
  isLoading?: boolean;
  loadingType?: SkeletonVariant;
  message?: React.ReactNode | Error | Record<string, unknown> | string;
  messageType?: MessageTypes;
  width?: string | number;
}

const messageColorClass: Record<MessageTypes, string> = {
  info: "text-blue-500 dark:text-blue-400",
  error: "text-red-500 dark:text-red-400",
  warning: "text-amber-500 dark:text-amber-400",
  success: "text-emerald-500 dark:text-emerald-400",
  help: "text-indigo-500 dark:text-indigo-400",
  loginRequired: "text-slate-500 dark:text-slate-300",
  disconnected: "text-zinc-500 dark:text-zinc-300",
  loading: "text-blue-500 dark:text-blue-400",
};

const Loading = ({
  skeletonType = "spinner",
  width,
}: {
  skeletonType?: SkeletonVariant;
  width?: string | number;
}): JSX.Element => {
  // Helper function to process width - add px if numeric, otherwise use as is
  // Type guard for processing width values
  const processWidth = (width?: string | number): string => {
    if (!width) {
      return "w-full";
    }

    // Handle numeric values (convert to arbitrary width)
    if (typeof width === "number") {
      return `w-[${width}px]`;
    }

    // Handle percentage values (convert to arbitrary width)
    if (width.includes("%")) {
      return `w-[${width}]`;
    }

    // Handle pixel values (convert to arbitrary width)
    if (width.includes("px")) {
      return `w-[${width}]`;
    }

    // Return as-is for Tailwind classes
    return width;
  };
  if (skeletonType === "skeleton") {
    const containerWidth = processWidth(width);
    const isFullWidth = !width;

    return (
      <div
        className={`flex flex-col items-center gap-4 ${containerWidth}`}
        role="status"
        aria-live="polite"
      >
        {/* Icon placeholder */}
        <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />

        {/* Content area skeleton - uses full container width */}
        <div
          className={`flex flex-col gap-3 w-full ${
            isFullWidth ? "max-w-md" : ""
          }`}
        >
          {/* Title/heading line */}
          <div className="h-5 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />

          {/* Main content lines */}
          <div className="flex flex-col gap-2 w-full">
            <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-11/12 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>

          {/* Optional action/button area */}
          <div className="mt-2 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <IconLoader
      size={54}
      strokeWidth={1.5}
      className="animate-spin text-blue-500 dark:text-blue-400"
      aria-hidden="true"
    />
  );
};

const MessageIcon = ({ type }: { type: MessageTypes }): JSX.Element => {
  const IconComponent = {
    info: IconInfoSquareRounded,
    error: IconSquareRoundedX,
    warning: IconAlertSquareRounded,
    success: IconSquareRoundedCheck,
    help: IconHelpSquareRounded,
    loginRequired: IconLockSquareRounded,
    disconnected: IconWifiOff,
    loading: IconLoader,
  }[type];

  const className = `${
    messageColorClass[type] ?? messageColorClass.info
  } mb-2.5`;
  return (
    <IconComponent
      size={54}
      strokeWidth={1.25}
      className={className}
      aria-hidden="true"
    />
  );
};

const renderMessageContent = (
  message: MessageBoxProps["message"],
  setMessageType: (nextType: MessageTypes) => void,
): React.ReactNode => {
  if (React.isValidElement(message)) {
    return message;
  }

  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Error) {
    setMessageType("error");
    return message.message ?? message.name;
  }

  if (message && typeof message === "object") {
    return (
      <pre className="max-w-full whitespace-pre-wrap break-words text-sm text-left">
        {JSON.stringify(message, null, 2)}
      </pre>
    );
  }

  return "An error has occurred.";
};

const MessageBox = ({
  isLoading,
  loadingType,
  message,
  messageType = "info",
  width,
}: MessageBoxProps): JSX.Element => {
  if (isLoading) {
    return (
      <div className="flex h-full min-h-32 w-full flex-col items-center justify-center rounded-md p-8 text-center">
        <Loading skeletonType={loadingType} width={width} />
      </div>
    );
  }

  let resolvedType: MessageTypes = messageType;
  const content = renderMessageContent(message, (nextType) => {
    resolvedType = nextType;
  });

  return (
    <div
      role="status"
      className={`flex h-full min-h-32 w-full flex-col items-center justify-center rounded-md p-8 text-center ${
        resolvedType === "error" ? "cursor-not-allowed" : "cursor-default"
      }`}
    >
      <MessageIcon type={resolvedType} />
      <div className="text-base text-gray-700 dark:text-gray-200">
        {content}
      </div>
    </div>
  );
};

export type { SkeletonVariant as SkeletonType };
export default MessageBox;
