"use client";

import { useEffect, useRef, useState, use } from "react";
import {
  FileSignature,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Eraser,
  PenTool,
  Lock,
  Building2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicContract, signPublicContract, type PublicContract } from "@/lib/api";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SignContractPage({ params }: PageProps) {
  const { token } = use(params);

  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signMode, setSignMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  // Canvas ref for drawing signature on mobile/desktop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    async function fetchContract() {
      try {
        setLoading(true);
        const data = await getPublicContract(token);
        setContract(data);
        if (data.recipient_name) setSignerName(data.recipient_name);
        if (data.recipient_email) setSignerEmail(data.recipient_email);
        if (data.status === "signed") setSignedSuccess(true);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Invalid or expired contract link.");
      } finally {
        setLoading(false);
      }
    }
    fetchContract();
  }, [token]);

  // Setup Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#38bdf8"; // cyan-400
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [loading, signMode, signedSuccess]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      alert("Please check the box to agree to the legal terms.");
      return;
    }

    let signatureData = "";
    if (signMode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        alert("Please draw your signature in the signature pad.");
        return;
      }
      signatureData = canvas.toDataURL("image/png");
    } else {
      if (!typedSignature.trim()) {
        alert("Please type your legal signature.");
        return;
      }
      signatureData = `typed:${typedSignature.trim()}`;
    }

    try {
      setSubmitting(true);
      const updated = await signPublicContract(token, {
        client_signature: signatureData,
        recipient_name: signerName,
        recipient_email: signerEmail,
      });
      setContract(updated);
      setSignedSuccess(true);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to submit signature.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full bg-slate-900/60 border-white/10 p-8 space-y-6">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </Card>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-red-500/20 p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Contract Link Unavailable</h2>
          <p className="text-sm text-slate-400">{error || "Contract not found."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-wide">Freelance Book</span>
              <span className="block text-[10px] text-cyan-400 font-mono">SECURE E-SIGN PORTAL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              <Lock className="w-3 h-3 mr-1" /> 256-bit Encrypted
            </Badge>
          </div>
        </div>

        {/* Contract Summary Card */}
        <Card className="bg-slate-900/60 border-white/10 p-6 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 tracking-wider uppercase">Contract Agreement</span>
              <h1 className="text-2xl font-bold text-white mt-0.5">{contract.title}</h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Project: <span className="text-slate-200 font-medium">{contract.project_title}</span>
              </p>
            </div>

            <div>
              {contract.status === "signed" || signedSuccess ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1 font-semibold">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Fully Executed & Signed
                </Badge>
              ) : (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs px-3 py-1 font-semibold">
                  <Smartphone className="w-4 h-4 mr-1.5" /> Ready for Signature
                </Badge>
              )}
            </div>
          </div>

          {/* Freelancer & Client Party Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-slate-500 font-mono uppercase text-[10px]">Issued By (Freelancer):</span>
              <p className="font-semibold text-white">{contract.freelancer_name}</p>
              {contract.sender_signed_at && (
                <p className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" /> Signed on {contract.sender_signed_at.slice(0, 10)}
                </p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-slate-500 font-mono uppercase text-[10px]">Client Recipient:</span>
              <p className="font-semibold text-white">{contract.recipient_name || "Client"}</p>
              <p className="text-slate-400 text-[11px]">{contract.recipient_email || "Via Direct Link"}</p>
            </div>
          </div>
        </Card>

        {/* Contract Content Body */}
        <Card className="bg-slate-900/60 border-white/10 p-6 sm:p-8 backdrop-blur-xl space-y-4">
          <h2 className="text-sm font-semibold font-mono text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2">
            Terms & Statement of Work
          </h2>
          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/70 p-5 rounded-xl border border-white/5 max-h-96 overflow-y-auto">
            {contract.content}
          </div>
        </Card>

        {/* Signing Area or Execution Confirmation */}
        {signedSuccess || contract.status === "signed" ? (
          <Card className="bg-gradient-to-tr from-emerald-950/50 to-slate-900 border-emerald-500/30 p-8 text-center space-y-4 backdrop-blur-xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Contract Legally Signed!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              This agreement is active and has been archived directly into the project record. Both parties have received verification stamps.
            </p>

            {contract.client_signature && (
              <div className="mt-4 pt-4 border-t border-white/10 max-w-sm mx-auto space-y-2">
                <span className="text-xs text-slate-400 font-mono">Recorded Client Signature:</span>
                {contract.client_signature.startsWith("data:image") ? (
                  <div className="p-3 bg-slate-950 rounded-lg border border-white/10 flex justify-center">
                    <img src={contract.client_signature} alt="Client Signature" className="h-14 object-contain" />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-lg border border-white/10 font-serif italic text-lg text-cyan-300">
                    {contract.client_signature.replace("typed:", "")}
                  </div>
                )}
                <div className="text-[11px] text-slate-500 font-mono">
                  Timestamp: {contract.client_signed_at ? new Date(contract.client_signed_at).toLocaleString() : "Confirmed"}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="bg-slate-900/60 border-white/10 p-6 sm:p-8 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Sign This Agreement</h3>
              </div>

              {/* Mode Toggle: Draw on Mobile/Canvas vs Type */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setSignMode("draw")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    signMode === "draw" ? "bg-cyan-600 text-white font-medium" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5 inline mr-1" /> Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => setSignMode("type")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    signMode === "type" ? "bg-cyan-600 text-white font-medium" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Type Signature
                </button>
              </div>
            </div>

            <form onSubmit={handleSign} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Your Full Legal Name *</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Email Address (for audit copy) *</label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Signature Capture Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">
                    {signMode === "draw" ? "Draw Your Signature (Touch / Mouse) *" : "Type Your Legal Signature *"}
                  </label>
                  {signMode === "draw" && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                    >
                      <Eraser className="w-3.5 h-3.5" /> Clear Canvas
                    </button>
                  )}
                </div>

                {signMode === "draw" ? (
                  <div className="relative border-2 border-dashed border-white/15 rounded-xl bg-slate-950 overflow-hidden touch-none flex justify-center items-center">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-44 cursor-crosshair"
                    />
                    {!hasDrawn && (
                      <div className="absolute pointer-events-none flex flex-col items-center justify-center text-slate-600 text-xs gap-1 select-none">
                        <Smartphone className="w-5 h-5" />
                        <span>Sign with finger on phone or mouse/trackpad</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your signature here..."
                    className="w-full px-4 py-4 rounded-xl bg-slate-950 border border-white/15 text-cyan-300 font-serif italic text-2xl focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>

              {/* Legal Checkbox */}
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-white/5">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="agree" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                  I agree that my electronic signature above is legally binding and equivalent to my physical handwritten signature on this contract under the ESIGN Act and UETA regulations.
                </label>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-cyan-500/20"
              >
                <ShieldCheck className="w-5 h-5 mr-2" />
                {submitting ? "Signing & Executing..." : "Adopt & Sign Contract"}
              </Button>
            </form>
          </Card>
        )}

      </div>
    </div>
  );
}
