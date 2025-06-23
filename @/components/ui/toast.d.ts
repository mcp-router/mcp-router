import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
declare const ToastProvider: React.FC<ToastPrimitives.ToastProviderProps>;
declare const ToastViewport: any;
declare const Toast: any;
declare const ToastAction: any;
declare const ToastClose: any;
declare const ToastTitle: any;
declare const ToastDescription: any;
type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;
export { type ToastProps, type ToastActionElement, ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction, };
//# sourceMappingURL=toast.d.ts.map