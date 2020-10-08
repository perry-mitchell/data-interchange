# data-interchange
Data interchange handler &amp; DB fallback handler


### Example

```typescript

interface MessageA {
    id: string;
    type: "normal" | "special";
    time: number;
}
interface MessageB {
    id: string;
    messageType: "normal" | "special";
    ts: number;
}

interface GetMessageFn {
    (id: string): Promise<MessageA>
}

const readMessageA: (id: string) => MessageA = { /* ... */ };
const readMessageB: (id: string) => MessageB = { /* ... */ };
const writeMessageA: (msg: MessageA) => MessageA = { /* ... */ };
const writeMessageB: (msg: MessageB) => MessageB = { /* ... */ };

createInterchange([
    {
        read: (id: string) => readMessageA(id),
        write: (msg: MessageA) => writeMessageA(msg),
        readError: (err) => ReadAction.Fallback
    },
    {
        read: (id: string) => readMessageB(id),
        write: (msg: MessageB) => writeMessageB(msg),
        convert: {
            read: (msg: MessageB): MessageA => ({
                id: msg.id,
                type: msg.messageType,
                time: msg.ts
            }),
            write: (msg: MessageA): MessageB => ({
                id: msg.id,
                messageType: msg.type,
                ts: msg.time
            })
        }
    }
]);

```

Or if all types are the same:

```typescript
const readMessageA: (id: string) => MessageA = { /* ... */ };
const readMessageB: (id: string) => MessageA = { /* ... */ };
const writeMessageA: (msg: MessageA) => MessageA = { /* ... */ };
const writeMessageB: (msg: MessageA) => MessageA = { /* ... */ };

createInterchange([
    {
        read: (id: string) => readMessageA(id),
        write: (msg: MessageA) => writeMessageA(msg),
        readError: (err) => ReadAction.Fallback
    },
    {
        read: (id: string) => readMessageB(id),
        write: (msg: MessageA) => writeMessageB(MessageA)
    }
]);
```
