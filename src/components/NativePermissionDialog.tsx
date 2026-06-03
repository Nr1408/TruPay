import React from "react";
import { MapPin, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface NativePermissionDialogProps {
  isOpen: boolean;
  type: "location" | "contacts";
  onGrant: () => void;
  onDeny: () => void;
}

export const NativePermissionDialog: React.FC<NativePermissionDialogProps> = ({
  isOpen,
  type,
  onGrant,
  onDeny,
}) => {
  if (!isOpen) return null;

  const content = {
    location: {
      title: "Allow TruPay to access this device's location?",
      description: "TruPay uses your location to prevent unauthorized transactions and ensure geofenced payment security.",
      icon: <MapPin className="w-8 h-8 text-blue-500" />,
    },
    contacts: {
      title: "Allow TruPay to access your contacts?",
      description: "This allows you to quickly send money to your friends and family and receive security alerts if a contact is flagged.",
      icon: <Users className="w-8 h-8 text-blue-500" />,
    }
  };

  const { title, description, icon } = content[type];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      
      <div className="relative w-full max-w-[320px] bg-white rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
            {icon}
          </div>
          
          <h2 className="text-xl font-display font-bold text-zinc-900 leading-tight mb-4">
            {title}
          </h2>
          
          <p className="text-sm text-zinc-500 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex border-t border-zinc-100">
          <button 
            onClick={onDeny}
            className="flex-1 py-5 text-sm font-bold text-zinc-400 hover:bg-zinc-50 active:bg-zinc-100 transition-colors border-r border-zinc-100 uppercase tracking-widest"
          >
            Deny
          </button>
          <button 
            onClick={onGrant}
            className="flex-1 py-5 text-sm font-bold text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors uppercase tracking-widest"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
