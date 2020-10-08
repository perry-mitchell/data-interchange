import * as ChannelQueue from "@buttercup/channel-queue";

export function createQueue(): ChannelQueue {
    return new ChannelQueue();
}

export async function enqueue(queue: ChannelQueue, key: string, call: () => any): Promise<any> {
    return queue.channel(key).enqueue(call);
}
