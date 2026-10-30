import { useEffect, useState } from "react";
import { api } from "../services/api";
import { queueReport, type QueuedReport } from "../offline/reportQueue";

export default function PublicReport() {
  const [text, setText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [geoStatus, setGeoStatus] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation is not supported by your browser.");
      return;
    }
    setGeoStatus("Locating device...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoStatus(`📍 Location attached: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => {
        setGeoStatus(`Could not acquire location (${err.message}). You can type your location below.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErrorMsg("Please describe what you need or what you see.");
      return;
    }
    setErrorMsg("");
    setSending(true);

    const payload = {
      text: text.trim(),
      location_text: locationText.trim() || undefined,
      lat,
      lng,
      phone: phone.trim() || undefined,
    };

    // If offline or fails network, fallback to offline queue
    if (!navigator.onLine) {
      await saveOffline(payload);
      return;
    }

    try {
      const res = await api.submitPublicReport(payload);
      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 429) {
        setErrorMsg("Too many reports, please wait a minute.");
      } else if (res.status === 0) {
        // Network error: store offline
        await saveOffline(payload);
      } else {
        setErrorMsg(res.error || "Failed to submit report. Please try again.");
      }
    } catch {
      await saveOffline(payload);
    } finally {
      setSending(false);
    }
  };

  const saveOffline = async (payload: { text: string; location_text?: string; lat?: number; lng?: number; phone?: string }) => {
    const queued: QueuedReport = {
      uuid: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: payload.text,
      source: "public",
      camp: payload.location_text || (payload.lat ? `${payload.lat.toFixed(4)}, ${payload.lng?.toFixed(4)}` : undefined),
      state: "Waiting",
    };
    try {
      await queueReport(queued);
      setOfflineSaved(true);
      setSubmitted(true);
    } catch {
      // Fallback to localStorage if IndexedDB fails
      const existing = JSON.parse(localStorage.getItem("reliefos-public-queue") || "[]");
      existing.push(payload);
      localStorage.setItem("reliefos-public-queue", JSON.stringify(existing));
      setOfflineSaved(true);
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4eee3",
        color: "#292522",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #d8cfc2",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#6e2638",
            color: "#ffffff",
            padding: "18px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontFamily: "Georgia, serif" }}>
              Relief<span>OS</span>
            </h1>
            <small style={{ opacity: 0.85, fontSize: "11px" }}>
              Public Emergency Citizen Report
            </small>
          </div>
          <span
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "12px",
              background: online ? "rgba(22, 129, 75, 0.4)" : "rgba(232, 161, 26, 0.4)",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: online ? "#2ecc71" : "#e67e22",
              }}
            />
            {online ? "Online" : "Offline"}
          </span>
        </div>

        {/* Offline notification banner if offline */}
        {!online && (
          <div
            style={{
              background: "#faedc9",
              color: "#825600",
              padding: "10px 16px",
              fontSize: "12px",
              borderBottom: "1px solid #ebd0a1",
              textAlign: "center",
            }}
          >
            Works with zero internet. Your report will be saved on your device and sent automatically when connected.
          </div>
        )}

        <div style={{ padding: "20px" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#dcebdc",
                  color: "#16814b",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "28px",
                  margin: "0 auto 16px",
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: "19px", color: "#16814b", margin: "0 0 8px", fontFamily: "Georgia, serif" }}>
                {offlineSaved ? "Saved on your device" : "Report Received"}
              </h2>
              <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.5, margin: "0 0 20px" }}>
                {offlineSaved
                  ? "Saved, will send when connected. As soon as your device reconnects to a local mesh or cellular network, relief coordinators will be notified."
                  : "Your report was received. Relief teams and nearby depots have been notified."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setText("");
                  setLocationText("");
                  setLat(undefined);
                  setLng(undefined);
                  setGeoStatus("");
                  setPhone("");
                  setOfflineSaved(false);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#6e2638",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Submit another report
              </button>
              <div style={{ marginTop: "14px" }}>
                <a
                  href="#/dashboard"
                  style={{ fontSize: "12px", color: "#6e2638", textDecoration: "underline" }}
                >
                  ← Go to Coordinator Dashboard
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {errorMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "4px",
                    background: "#f7dfdc",
                    color: "#8b1727",
                    fontSize: "12px",
                    border: "1px solid #e2b6b1",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* Message Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Describe what you need or what you see *
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Example: 300 families near bridge need drinking water urgently. Water level rising."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "14px",
                    border: "1px solid #d8cfc2",
                    borderRadius: "4px",
                    background: "#faf8f5",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                  required
                />
                <span style={{ fontSize: "10px", color: "#777" }}>
                  Write in English, Hindi, Hinglish, or Punjabi. The AI will extract the details.
                </span>
              </div>

              {/* Location button */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Your Location</label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  style={{
                    padding: "10px",
                    background: "#f0ece5",
                    color: "#6e2638",
                    border: "1px solid #d8cfc2",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  📍 Share my location (GPS)
                </button>
                {geoStatus && (
                  <span style={{ fontSize: "11px", color: lat ? "#16814b" : "#b04a00" }}>
                    {geoStatus}
                  </span>
                )}
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Or type landmark, village, road, or camp name"
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    fontSize: "13px",
                    border: "1px solid #d8cfc2",
                    borderRadius: "4px",
                    background: "#faf8f5",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Optional Phone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Contact phone number <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number for callback"
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    fontSize: "13px",
                    border: "1px solid #d8cfc2",
                    borderRadius: "4px",
                    background: "#faf8f5",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: "13px",
                  background: "#6e2638",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: sending ? "not-allowed" : "pointer",
                  marginTop: "6px",
                  boxShadow: "0 2px 6px rgba(110, 38, 56, 0.25)",
                }}
              >
                {sending ? "Sending report..." : "Submit Emergency Report"}
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <a
                  href="#/dashboard"
                  style={{ fontSize: "11px", color: "#6e2638", textDecoration: "underline" }}
                >
                  Coordinator Dashboard Login →
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
