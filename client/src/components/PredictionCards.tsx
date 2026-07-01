import { useState } from "react";
import type {
  HypothesisProfileId,
  HypothesisProfileMeta,
  PredictionHorizon,
  PredictionSignal,
} from "../types";
import {
  confidenceClass,
  directionColor,
  directionLabel,
  horizonLabel,
} from "../predictionUtils";

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];

interface PredictionCardsProps {
  profilePredictions: Partial<Record<HypothesisProfileId, PredictionSignal[]>> | undefined;
  fallbackPredictions: PredictionSignal[];
  profiles: HypothesisProfileMeta[];
  selectedProfile: HypothesisProfileId;
  selectedHorizon: PredictionHorizon;
  onSelectHorizon: (horizon: PredictionHorizon) => void;
  onSelectProfile: (profileId: HypothesisProfileId) => void;
}

function getProfilePrediction(
  profilePredictions: Partial<Record<HypothesisProfileId, PredictionSignal[]>> | undefined,
  fallbackPredictions: PredictionSignal[],
  profileId: HypothesisProfileId,
  horizon: PredictionHorizon
): PredictionSignal | undefined {
  const fromProfile = profilePredictions?.[profileId]?.find((p) => p.horizon === horizon);
  if (fromProfile) return fromProfile;

  const fromBalanced = profilePredictions?.balanced?.find((p) => p.horizon === horizon);
  if (fromBalanced) return fromBalanced;

  return fallbackPredictions.find((p) => p.horizon === horizon);
}

function PredictionCard({
  prediction,
  selected,
  onClick,
}: {
  prediction: PredictionSignal;
  selected: boolean;
  onClick: () => void;
}) {
  const color = directionColor(prediction.direction);
  const barWidth = Math.min(100, Math.abs(prediction.compositeScore) * 100);

  return (
    <button
      type="button"
      className={`prediction-card ${selected ? "selected" : ""} dir-${prediction.direction.toLowerCase().replace("_", "-")}`}
      style={{ borderColor: selected ? color : undefined }}
      onClick={onClick}
    >
      <div className="prediction-card-top">
        <span className="prediction-horizon">{horizonLabel(prediction.horizon)}</span>
        <span className={`confidence-badge ${confidenceClass(prediction.confidence)}`}>
          {prediction.confidence}
        </span>
      </div>
      <div className="prediction-direction" style={{ color }}>
        {directionLabel(prediction.direction)}
      </div>
      <div className="prediction-score-bar">
        <div
          className={`prediction-score-fill ${prediction.compositeScore >= 0 ? "bull" : "bear"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="prediction-meta">
        <span>Score {prediction.compositeScore.toFixed(2)}</span>
        <span>Conf {prediction.confidenceScore}%</span>
      </div>
    </button>
  );
}

function PlaceholderCard({ horizon, selected, onClick }: {
  horizon: PredictionHorizon;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`prediction-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="prediction-card-top">
        <span className="prediction-horizon">{horizonLabel(horizon)}</span>
      </div>
      <div className="prediction-direction muted">—</div>
      <p className="muted prediction-placeholder">Waiting for data…</p>
    </button>
  );
}

export function PredictionCards({
  profilePredictions,
  fallbackPredictions,
  profiles,
  selectedProfile,
  selectedHorizon,
  onSelectHorizon,
  onSelectProfile,
}: PredictionCardsProps) {
  const [expandedHorizon, setExpandedHorizon] = useState<PredictionHorizon | null>(null);
  const activeProfileName = profiles.find((p) => p.id === selectedProfile)?.name ?? selectedProfile;

  const handleCardClick = (horizon: PredictionHorizon) => {
    onSelectHorizon(horizon);
    setExpandedHorizon((current) => (current === horizon ? null : horizon));
  };

  const handleProfilePick = (profileId: HypothesisProfileId) => {
    onSelectProfile(profileId);
    setExpandedHorizon(null);
  };

  return (
    <section className="panel prediction-cards-panel">
      <h2>Polymarket Signals</h2>
      <p className="panel-hint">
        Profile: <strong>{activeProfileName}</strong>. Click a horizon card to pick a hypothesis
        profile (3×4 grid).
      </p>

      <div className="prediction-cards">
        {HORIZONS.map((horizon) => {
          const prediction = getProfilePrediction(
            profilePredictions,
            fallbackPredictions,
            selectedProfile,
            horizon
          );
          const selected = horizon === selectedHorizon;

          if (!prediction) {
            return (
              <PlaceholderCard
                key={horizon}
                horizon={horizon}
                selected={selected}
                onClick={() => handleCardClick(horizon)}
              />
            );
          }

          return (
            <PredictionCard
              key={horizon}
              prediction={prediction}
              selected={selected}
              onClick={() => handleCardClick(horizon)}
            />
          );
        })}
      </div>

      {expandedHorizon && (
        <div className="profile-grid-panel">
          <div className="profile-grid-header">
            <h3>Hypothesis profiles — {horizonLabel(expandedHorizon)}</h3>
            <button
              type="button"
              className="profile-grid-close"
              onClick={() => setExpandedHorizon(null)}
              aria-label="Close profile grid"
            >
              ×
            </button>
          </div>
          <div className="profile-grid">
            {profiles.length === 0 ? (
              <p className="muted profile-grid-loading">Loading profiles…</p>
            ) : (
              profiles.map((profile) => {
              const prediction = getProfilePrediction(
                profilePredictions,
                fallbackPredictions,
                profile.id,
                expandedHorizon
              );
              const isSelected = profile.id === selectedProfile;
              const direction = prediction?.direction ?? "NO_EDGE";
              const color = directionColor(direction);

              return (
                <button
                  key={profile.id}
                  type="button"
                  className={`profile-grid-btn ${isSelected ? "selected" : ""} dir-${direction.toLowerCase().replace("_", "-")}`}
                  onClick={() => handleProfilePick(profile.id)}
                >
                  <span
                    className="profile-info"
                    title={`${profile.hypothesis}\n\n${profile.description}`}
                    aria-label={profile.description}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    i
                  </span>
                  <span className="profile-grid-name">{profile.name}</span>
                  <span className="profile-grid-direction" style={{ color }}>
                    {directionLabel(direction)}
                  </span>
                  {prediction && (
                    <span className="profile-grid-score muted">
                      {prediction.compositeScore.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function loadStoredProfile(): HypothesisProfileId {
  try {
    const stored = localStorage.getItem("selectedProfileId");
    if (stored) return stored as HypothesisProfileId;
  } catch {
    // ignore
  }
  return "balanced";
}

export function storeSelectedProfile(profileId: HypothesisProfileId): void {
  try {
    localStorage.setItem("selectedProfileId", profileId);
  } catch {
    // ignore
  }
}
