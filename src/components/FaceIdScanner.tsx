import React, { useEffect, useState, useRef } from "react";
import { ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { authenticateBiometric } from "@/lib/biometrics";

interface FaceIdScannerProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const FaceIdScanner: React.FC<FaceIdScannerProps> = ({ onSuccess, onCancel }) => {
  const [status, setStatus] = useState<"positioning" | "scanning" | "verifying" | "success" | "error">("positioning");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let videoStream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        // 1. Start Real Camera Stream
        setStatus("positioning");
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: 400, height: 400 } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
          }
          setTimeout(() => setStatus("scanning"), 1000);
        } catch (err) {
          console.warn("Camera access denied, using simulated visuals.");
          setTimeout(() => setStatus("scanning"), 1000);
        }

        // 2. Trigger Native Hardware Biometrics
        const success = await authenticateBiometric("face");
        
        if (success) {
          setStatus("verifying");
          setTimeout(() => {
            setStatus("success");
            // Stop camera stream before proceeding
            if (videoStream) {
              videoStream.getTracks().forEach(track => track.stop());
            }
            setTimeout(onSuccess, 800);
          }, 1000);
        } else {
          setStatus("error");
          setTimeout(() => {
            if (videoStream) {
              videoStream.getTracks().forEach(track => track.stop());
            }
            onCancel();
          }, 2000);
        }
      } catch (err) {
        setStatus("error");
      }
    };

    startScanner();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Sentinel Vision AI</span>
      </div>

      {/* The Scanner Aperture */}
      <div className="relative w-72 h-72 md:w-80 md:h-80 mb-12">
        {/* Outer Rings */}
        <div className={cn(
          "absolute inset-0 rounded-full border-2 transition-all duration-700",
          status === "success" ? "border-emerald-500 scale-110" : "border-primary/20"
        )} />
        <div className={cn(
          "absolute inset-4 rounded-full border-4 border-dashed transition-all duration-1000 animate-spin-slow",
          status === "success" ? "border-emerald-500 opacity-0" : "border-primary/10"
        )} />

        {/* Camera Mask / Preview Area */}
        <div className="absolute inset-8 rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center border border-white/5 shadow-2xl">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-1000",
              status === "positioning" ? "opacity-40" : "opacity-100"
            )}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          
          {/* Scanning Line */}
          {(status === "scanning" || status === "verifying") && (
            <div className="absolute inset-0 z-20 overflow-hidden">
              <div className="w-full h-1 bg-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scan-y" />
              <div className="absolute inset-0 bg-primary/5 grid grid-cols-6 gap-0 opacity-10">
                {[...Array(36)].map((_, i) => (
                  <div key={i} className="border-[0.5px] border-primary/20" />
                ))}
              </div>
            </div>
          )}

          {/* Success Overlay */}
          {status === "success" && (
            <div className="absolute inset-0 z-30 bg-emerald-500/20 flex items-center justify-center animate-in fade-in duration-300 backdrop-blur-[2px]">
              <ShieldCheck className="w-16 h-16 text-emerald-500 drop-shadow-glow" />
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      <div className="text-center space-y-2 relative z-10">
        <h2 className={cn(
          "text-xl font-display font-black uppercase tracking-widest transition-colors",
          status === "success" ? "text-emerald-500" : "text-white"
        )}>
          {status === "positioning" && "Aligning Face"}
          {status === "scanning" && "Mapping Face..."}
          {status === "verifying" && "Verifying Identity..."}
          {status === "success" && "Identity Confirmed"}
          {status === "error" && "Scan Failed"}
        </h2>
        <p className="text-xs text-muted-foreground font-medium max-w-[220px] mx-auto opacity-60">
          {status === "positioning" && "Center your face in the scan zone."}
          {status === "scanning" && "Sentinel is analyzing facial geometry."}
          {status === "verifying" && "Syncing with secure enclave."}
          {status === "success" && "Access granted to secure vault."}
          {status === "error" && "Identity mismatch. Please try again."}
        </p>
      </div>

      <button 
        onClick={onCancel}
        className="absolute bottom-16 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors"
      >
        Cancel Secure Scan
      </button>
    </div>
  );
};
