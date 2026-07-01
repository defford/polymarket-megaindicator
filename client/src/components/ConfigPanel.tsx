import { useCallback, useEffect, useState } from "react";
import {
  fetchConfigSettings,
  loadPreset,
  previewConfigSettings,
  saveConfigSettings,
} from "../api/client";
import type {
  ConfigPreviewResult,
  ConfigSettings,
  PredictionHorizon,
  PredictionSignal,
  PresetMeta,
  StrategyPresetId,
} from "../types";
import { directionColor, directionLabel } from "../predictionUtils";

interface ConfigPanelProps {
  open: boolean;
  onClose: () => void;
  onApplied: (snapshot: import("../types").Snapshot) => void;
  currentPredictions: PredictionSignal[];
}

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];

function PredictionMini({ label, p }: { label: string; p: PredictionSignal | undefined }) {
  if (!p) return <span className="preview-mini empty">{label}: —</span>;
  return (
    <span className="preview-mini" style={{ color: directionColor(p.direction) }}>
      {label}: {directionLabel(p.direction)} ({p.confidence})
    </span>
  );
}

export function ConfigPanel({ open, onClose, onApplied, currentPredictions }: ConfigPanelProps) {
  const [settings, setSettings] = useState<ConfigSettings | null>(null);
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [preview, setPreview] = useState<ConfigPreviewResult | null>(null);
  const [activeHorizon, setActiveHorizon] = useState<PredictionHorizon>("5m");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchConfigSettings()
      .then(({ settings: s, presets: p }) => {
        setSettings(s);
        setPresets(p);
        setDirty(false);
      })
      .catch((err) => setError((err as Error).message));
  }, [open]);

  const runPreview = useCallback(async (draft: ConfigSettings) => {
    try {
      const result = await previewConfigSettings(draft);
      setPreview(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!settings || !open) return;
    const timer = setTimeout(() => runPreview(settings), 400);
    return () => clearTimeout(timer);
  }, [settings, open, runPreview]);

  const updateSettings = (patch: Partial<ConfigSettings> | ((s: ConfigSettings) => ConfigSettings)) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      return next;
    });
    setDirty(true);
  };

  const applyPreset = async (id: StrategyPresetId) => {
    try {
      const { settings: s, preview: p } = await loadPreset(id);
      setSettings(s);
      setPreview(p);
      setDirty(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { snapshot } = await saveConfigSettings(settings);
      onApplied(snapshot);
      setDirty(false);
      setError(null);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="config-overlay" onClick={onClose} role="presentation">
      <div className="config-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="config-header">
          <div>
            <h2>Prediction Settings</h2>
            <p className="panel-hint">Tune how signals are scored. Preview updates live before you save.</p>
          </div>
          <button type="button" className="config-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {settings && (
          <div className="config-body">
            <section className="config-section">
              <h3>Strategy Preset</h3>
              <div className="preset-grid">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-card ${settings.preset === p.id ? "active" : ""}`}
                    onClick={() => applyPreset(p.id)}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.description}</span>
                    <em>Best for: {p.bestFor}</em>
                  </button>
                ))}
              </div>
            </section>

            <section className="config-section">
              <h3>Signal Thresholds</h3>
              <p className="config-tip">
                Higher &quot;No Edge&quot; threshold = fewer marginal bets. Higher confidence bars = only strong setups flagged actionable.
              </p>
              <div className="slider-group">
                <label>
                  No Edge threshold ({settings.predictions.noEdgeThreshold.toFixed(2)})
                  <input
                    type="range"
                    min={0.05}
                    max={0.25}
                    step={0.01}
                    value={settings.predictions.noEdgeThreshold}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        preset: "balanced",
                        predictions: {
                          ...settings.predictions,
                          noEdgeThreshold: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span className="slider-hint">↑ fewer trades, cleaner signals</span>
                </label>
                <label>
                  High confidence bar ({settings.predictions.highConfidenceThreshold.toFixed(2)})
                  <input
                    type="range"
                    min={0.25}
                    max={0.55}
                    step={0.01}
                    value={settings.predictions.highConfidenceThreshold}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        predictions: {
                          ...settings.predictions,
                          highConfidenceThreshold: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Medium confidence bar ({settings.predictions.mediumConfidenceThreshold.toFixed(2)})
                  <input
                    type="range"
                    min={0.1}
                    max={0.35}
                    step={0.01}
                    value={settings.predictions.mediumConfidenceThreshold}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        predictions: {
                          ...settings.predictions,
                          mediumConfidenceThreshold: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
            </section>

            <section className="config-section">
              <h3>Horizon Tuning</h3>
              <div className="horizon-tabs">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={activeHorizon === h ? "tf-tab active" : "tf-tab"}
                    onClick={() => setActiveHorizon(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              {(() => {
                const tuning = settings.predictions.horizonTuning[activeHorizon];
                return (
                  <div className="slider-group">
                    <label>
                      Oscillator emphasis ({tuning.oscillatorEmphasis}%)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={tuning.oscillatorEmphasis}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            predictions: {
                              ...settings.predictions,
                              horizonTuning: {
                                ...settings.predictions.horizonTuning,
                                [activeHorizon]: {
                                  ...tuning,
                                  oscillatorEmphasis: Number(e.target.value),
                                },
                              },
                            },
                          })
                        }
                      />
                      <span className="slider-hint">
                        {activeHorizon === "5m"
                          ? "High = RSI/Momentum weighted (scalp-friendly)"
                          : activeHorizon === "1h"
                            ? "Low = MA/trend weighted (swing-friendly)"
                            : "Balance speed vs trend"}
                      </span>
                    </label>
                    <label>
                      Higher-TF conflict sensitivity ({tuning.conflictSensitivity}%)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={tuning.conflictSensitivity}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            predictions: {
                              ...settings.predictions,
                              horizonTuning: {
                                ...settings.predictions.horizonTuning,
                                [activeHorizon]: {
                                  ...tuning,
                                  conflictSensitivity: Number(e.target.value),
                                },
                              },
                            },
                          })
                        }
                      />
                      <span className="slider-hint">↑ penalizes bets against 1h/4h/1d trend</span>
                    </label>
                    <label>
                      Confluence bonus ({tuning.confluenceBonus.toFixed(2)})
                      <input
                        type="range"
                        min={0.04}
                        max={0.14}
                        step={0.01}
                        value={tuning.confluenceBonus}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            predictions: {
                              ...settings.predictions,
                              horizonTuning: {
                                ...settings.predictions.horizonTuning,
                                [activeHorizon]: {
                                  ...tuning,
                                  confluenceBonus: Number(e.target.value),
                                },
                              },
                            },
                          })
                        }
                      />
                      <span className="slider-hint">↑ rewards when leading timeframes align</span>
                    </label>
                  </div>
                );
              })()}
            </section>

            <section className="config-section">
              <h3>Confluence Alerts</h3>
              <p className="config-tip">Enable rules that fire when specific timeframes all agree — useful confirmation before betting.</p>
              <div className="rule-toggles">
                {Object.entries(settings.agreementRules).map(([id, enabled]) => (
                  <label key={id} className="rule-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          agreementRules: {
                            ...settings.agreementRules,
                            [id]: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>{id.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="config-section preview-section">
              <h3>Live Preview</h3>
              <div className="preview-compare">
                <div className="preview-col">
                  <h4>Current (saved)</h4>
                  <div className="preview-row">
                    {HORIZONS.map((h) => (
                      <PredictionMini
                        key={h}
                        label={h}
                        p={(preview?.current ?? currentPredictions).find((x) => x.horizon === h)}
                      />
                    ))}
                  </div>
                </div>
                <div className="preview-col draft">
                  <h4>Draft (unsaved)</h4>
                  <div className="preview-row">
                    {HORIZONS.map((h) => (
                      <PredictionMini
                        key={h}
                        label={h}
                        p={preview?.draft.find((x) => x.horizon === h)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {preview?.impact && (
                <ul className="impact-list">
                  {preview.impact.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <footer className="config-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!dirty || saving || !settings}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save & Apply"}
          </button>
        </footer>
      </div>
    </div>
  );
}
