import React, { useState, useEffect } from "react";
import { Check, Delete, ShieldCheck, X, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UpiPinPadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  payeeName: string;
  amount: number;
}

export const UpiPinPad: React.FC<UpiPinPadProps> = ({
  isOpen,
  onClose,
  onSuccess,
  payeeName,
  amount,
}) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSetting, setIsSetting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(false);
  const pinLength = 4;

  useEffect(() => {
    if (isOpen) {
      const savedPin = localStorage.getItem("trupay_pin");
      setIsSetting(!savedPin);
      setPin("");
      setConfirmPin("");
      setIsConfirming(false);
      setError(false);
    }
  }, [isOpen]);

  // AUTO-SUBMIT once 4 digits are entered
  useEffect(() => {
    if (pin.length === pinLength) {
      const timer = setTimeout(() => {
        handleSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  const handlePress = (num: string) => {
    if (error) setError(false);
    if (pin.length < pinLength) {
      setPin((p) => p + num);
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
  };

  const handleSubmit = () => {
    const currentPin = pin;
    if (currentPin.length !== pinLength) return;

    if (isSetting) {
      if (!isConfirming) {
        setConfirmPin(currentPin);
        setPin("");
        setIsConfirming(true);
      } else {
        if (currentPin === confirmPin) {
          localStorage.setItem("trupay_pin", currentPin);
          toast.success("UPI PIN Set Successfully!");
          onSuccess(currentPin);
        } else {
          setError(true);
          setPin("");
          toast.error("PINs do not match. Try again.");
          setIsConfirming(false);
        }
      }
    } else {
      const savedPin = localStorage.getItem("trupay_pin");
      if (currentPin === savedPin) {
        onSuccess(currentPin);
      } else {
        setError(true);
        setPin("");
        toast.error("Incorrect UPI PIN", {
          description: "Please enter the correct 4-digit PIN."
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {/* Premium Light Header */}
      <div className="shrink-0 flex items-center justify-between p-5 border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-[9px] shadow-lg shadow-blue-600/20">
            NPCI
          </div>
          <div className="text-left">
            <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 leading-none mb-1">Secure Network</span>
            <span className="block text-xs font-bold text-zinc-900 tracking-wide leading-none">BHIM UPI Gateway</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center active:scale-90 transition-all"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Modern Status Section - White Theme */}
      <div className="shrink-0 px-6 pt-6 pb-2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-5 h-5 text-primary animate-pulse" />
        </div>
        
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-2 leading-none">
          {isSetting ? "New Registration" : "Payment Authorization"}
        </p>
        <h2 className="text-lg font-display font-black text-zinc-900 text-center px-4 leading-tight">
          {isSetting ? "Set Secure 4-Digit PIN" : `Paying ${payeeName}`}
        </h2>
        
        <div className="mt-4 px-6 py-2 rounded-full bg-zinc-50 border border-zinc-100 shadow-inner">
          <p className="text-2xl font-display font-black text-zinc-900 tracking-tight tabular-nums">
            ₹{amount.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* PIN Input Area - Light Mode */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <p className={cn(
          "text-[9px] font-black uppercase tracking-[0.4em] mb-8 transition-colors leading-none",
          error ? "text-destructive" : "text-zinc-400"
        )}>
          {isSetting 
            ? (isConfirming ? "Confirm PIN" : "Enter New PIN") 
            : "Enter UPI PIN"}
        </p>
        
        <div className={cn(
          "flex gap-6",
          error && "animate-shake"
        )}>
          {[...Array(pinLength)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2 transition-all duration-300",
                i < pin.length 
                  ? "bg-primary border-primary scale-125 shadow-[0_0_12px_rgba(59,130,246,0.2)]" 
                  : cn("bg-transparent border-zinc-200", error && "border-destructive/40")
              )}
            />
          ))}
        </div>

        {error ? (
          <div className="mt-8 flex items-center gap-2 text-destructive font-bold text-[9px] uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-3.5 h-3.5" />
            Verification Failed
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-2.5 text-success font-black text-[8px] uppercase tracking-[0.3em] bg-success/5 px-4 py-2 rounded-full border border-success/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            AI Shield Vault Active
          </div>
        )}
      </div>

      {/* Premium Numeric Keypad - Light Mode */}
      <div className="shrink-0 grid grid-cols-3 bg-zinc-50/50 backdrop-blur-2xl border-t border-zinc-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => handlePress(n.toString())}
            className="py-4 text-2xl font-display font-black text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 transition-all border-r border-b border-zinc-100"
          >
            {n}
          </button>
        ))}
        <button
          onClick={handleDelete}
          className="py-4 flex items-center justify-center border-r border-zinc-100 hover:bg-zinc-100 active:bg-zinc-200 transition-all"
        >
          <Delete className="w-6 h-6 text-zinc-400" />
        </button>
        <button
          onClick={() => handlePress("0")}
          className="py-4 text-2xl font-display font-black text-zinc-900 border-r border-zinc-100 hover:bg-zinc-100 active:bg-zinc-200 transition-all"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          className={cn(
            "py-4 flex items-center justify-center transition-all duration-500",
            pin.length === pinLength 
              ? "bg-primary text-white shadow-glow" 
              : "bg-zinc-100 text-zinc-300 pointer-events-none"
          )}
        >
          <Check className="w-8 h-8" strokeWidth={4} />
        </button>
      </div>
      
      {/* Safe Area Padding */}
      <div className="h-8 bg-white" />
    </div>
  );
};
