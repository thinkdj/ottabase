/**
 * Test fixtures for messages
 */

import {
  MessageType,
  SubscribeMessage,
  UnsubscribeMessage,
  ChannelMessage,
  BroadcastMessage,
  ErrorMessage,
  AckMessage,
  PingMessage,
  PongMessage,
} from "../../types";

export const createSubscribeMessage = (
  channel: string = "test-channel",
  clientId: string = "test-client-123"
): SubscribeMessage => ({
  type: MessageType.SUBSCRIBE,
  channel,
  clientId,
  timestamp: Date.now(),
});

export const createUnsubscribeMessage = (
  channel: string = "test-channel",
  clientId: string = "test-client-123"
): UnsubscribeMessage => ({
  type: MessageType.UNSUBSCRIBE,
  channel,
  clientId,
  timestamp: Date.now(),
});

export const createChannelMessage = (
  channel: string = "test-channel",
  event: string = "test-event",
  data: any = { test: "data" }
): ChannelMessage => ({
  type: MessageType.MESSAGE,
  channel,
  event,
  data,
  timestamp: Date.now(),
});

export const createBroadcastMessage = (
  channels: string[] = ["channel-1", "channel-2"],
  event: string = "broadcast-event",
  data: any = { broadcast: "data" }
): BroadcastMessage => ({
  type: MessageType.BROADCAST,
  channels,
  event,
  data,
  timestamp: Date.now(),
});

export const createErrorMessage = (
  error: string = "Test error",
  details?: any
): ErrorMessage => ({
  type: MessageType.ERROR,
  error,
  details,
  timestamp: Date.now(),
});

export const createAckMessage = (
  messageId: string = "msg-123",
  channel: string = "test-channel"
): AckMessage => ({
  type: MessageType.ACK,
  messageId,
  channel,
  timestamp: Date.now(),
});

export const createPingMessage = (): PingMessage => ({
  type: MessageType.PING,
  timestamp: Date.now(),
});

export const createPongMessage = (): PongMessage => ({
  type: MessageType.PONG,
  timestamp: Date.now(),
});
