export function RegisterHandler(handler: (_?: any) => any, type = 'event') {
    if (self) {
        switch (type) {
            case 'init':
                (self as any).oninit = handler
                break
            case 'event':
                (self as any).onevent = handler
                break
            case 'share':
                (self as any).onshare = handler
                break
            case 'transfer':
                (self as any).ontransfer = handler
                break
            case 'work':
                (self as any).onwork = handler
                break
            case 'close':
                (self as any).onclose = handler
                break
        }
    } else {
        throw new Error('RegisterHandler only usable from worker thread!')
    }
}