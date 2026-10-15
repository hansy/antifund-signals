import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
/** shadcn's Sonner wrapper, adapted to this app's CSS and Heroicons. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      visibleToasts={3}
      duration={3500}
      offset={24}
      mobileOffset={{ top: 80, left: 16, right: 16 }}
      icons={{
        success: <CheckCircleIcon width={20} height={20} />,
        error: <ExclamationCircleIcon width={20} height={20} />,
        info: <InformationCircleIcon width={20} height={20} />,
        warning: <ExclamationTriangleIcon width={20} height={20} />,
      }}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast-title",
          description: "app-toast-description",
          actionButton: "app-toast-action",
          closeButton: "app-toast-close",
        },
      }}
      {...props}
    />
  );
}
