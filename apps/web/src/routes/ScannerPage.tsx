import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

type ValidateResponse =
  | { status: "invalid" }
  | { status: "voided"; ticketId: string; eventId: string }
  | { status: "used"; ticketId: string; eventId: string; attendeeEmail: string }
  | { status: "valid"; ticketId: string; eventId: string; attendeeEmail: string };

export default function ScannerPage() {
  const auth = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const lastScan = useRef<{ payload: string; at: number } | null>(null);

  const reader = useMemo(() => new BrowserQRCodeReader(), []);

  useEffect(() => {
    if (!auth.user) return;
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      if (!videoRef.current) return;
      setStatus("Starting camera…");
      setError(null);
      try {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, _err) => {
          if (!result || cancelled) return;
          const payload = result.getText();
          const now = Date.now();
          if (lastScan.current && lastScan.current.payload === payload && now - lastScan.current.at < 2500) return;
          lastScan.current = { payload, at: now };

          setLastPayload(payload);
          setStatus("Validating…");
          setError(null);

          try {
            const data = await auth.apiFetch<ValidateResponse>("/tickets/validate", {
              method: "POST",
              body: JSON.stringify({ qrPayload: payload })
            });
            setValidation(data);
            setStatus(data.status);
          } catch (err: any) {
            setValidation(null);
            setStatus("Error");
            setError(err?.message ?? "Validation failed");
          }
        });

        setStatus("Scanning…");
      } catch (err: any) {
        setStatus("Error");
        setError(err?.message ?? "Failed to start scanner");
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      reader.reset();
    };
  }, [auth, reader]);

  if (!auth.user) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
        Please <Link className="underline" to="/login">login</Link> to scan tickets.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scanner</h1>
        <div className="text-xs text-neutral-400">{status}</div>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <video ref={videoRef} className="w-full rounded-md bg-black" />
          <div className="mt-2 text-xs text-neutral-400">
            Tip: use a phone on the same network and open this page to scan attendee QR codes.
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="text-sm font-medium">Last scan</div>
          <div className="break-all rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-300">
            {lastPayload ?? "No scans yet."}
          </div>

          <div className="text-sm font-medium">Validation</div>
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200">
            {!validation ? "—" : JSON.stringify(validation)}
          </div>

          {validation && validation.status === "valid" ? (
            <button
              type="button"
              className="w-full rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              onClick={async () => {
                setError(null);
                try {
                  const data = await auth.apiFetch<{ status: string }>(`/tickets/${validation.ticketId}/checkin`, {
                    method: "POST"
                  });
                  setStatus(`checkin:${data.status}`);
                } catch (err: any) {
                  setError(err?.message ?? "Check-in failed");
                }
              }}
            >
              Check in
            </button>
          ) : null}

          <div className="text-xs text-neutral-400">
            Requires organizer access; if you get 403, create an organizer profile under “Organizer”.
          </div>
        </div>
      </div>
    </div>
  );
}

