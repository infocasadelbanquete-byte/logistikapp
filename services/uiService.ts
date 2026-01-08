
type ModalType = 'ALERT' | 'CONFIRM' | 'PROMPT';

interface ModalRequest {
    id: string;
    type: ModalType;
    title: string;
    message: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    resolve: (value: any) => void;
}

let listeners: ((req: ModalRequest | null) => void)[] = [];

export const uiService = {
    subscribe: (cb: (req: ModalRequest | null) => void) => {
        listeners.push(cb);
        return () => { listeners = listeners.filter(l => l !== cb); };
    },
    
    alert: (title: string, message: string, buttonText: string = 'Entendido'): Promise<void> => {
        return new Promise((resolve) => {
            const req: ModalRequest = { 
                id: Date.now().toString(), 
                type: 'ALERT', 
                title, 
                message, 
                confirmText: buttonText,
                resolve 
            };
            listeners.forEach(cb => cb(req));
        });
    },

    confirm: (title: string, message: string, confirmText: string = 'Aceptar', cancelText: string = 'Cancelar'): Promise<boolean> => {
        return new Promise((resolve) => {
            const req: ModalRequest = { 
                id: Date.now().toString(), 
                type: 'CONFIRM', 
                title, 
                message, 
                confirmText,
                cancelText,
                resolve 
            };
            listeners.forEach(cb => cb(req));
        });
    },

    prompt: (title: string, message: string, defaultValue: string = ''): Promise<string | null> => {
        return new Promise((resolve) => {
            const req: ModalRequest = { 
                id: Date.now().toString(), 
                type: 'PROMPT', 
                title, 
                message, 
                defaultValue, 
                resolve 
            };
            listeners.forEach(cb => cb(req));
        });
    },

    close: () => {
        listeners.forEach(cb => cb(null));
    }
};
