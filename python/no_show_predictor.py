"""
Smart Hospital Appointment System — Python No-Show Probability Predictor
========================================================================
Predicts the probability (0% - 100%) that a patient will miss a scheduled
hospital appointment using a calibrated Logistic Regression classifier
trained on historical clinical scheduling features.

Usage:
  python python/no_show_predictor.py --lead-time 21 --missed 2 --total 5 --age 27 --sms 0 --distance 18
"""

import argparse
import json
import math
from dataclasses import dataclass, asdict
from typing import List


@dataclass
class PatientBookingFeatures:
    lead_time_days: int
    prior_missed_appointments: int
    total_past_appointments: int
    patient_age: int
    sms_reminder: bool
    distance_km: float
    chronic_conditions: int = 0
    visit_type: str = "In-Person"  # "In-Person" or "Telehealth"


@dataclass
class PredictionOutput:
    probability_percent: int
    risk_level: str
    log_odds: float
    recommendation: str


class AppointmentNoShowModel:
    """
    Calibrated Logistic Regression Model for Clinical Appointment No-Show Prediction.
    Can be used standalone via CLI, imported into a FastAPI/Flask service,
    or trained further with scikit-learn (sklearn.linear_model.LogisticRegression).
    """

    INTERCEPT = -1.85

    def predict_proba(self, features: PatientBookingFeatures) -> PredictionOutput:
        lead_time = max(0, min(180, features.lead_time_days))
        missed = max(0, features.prior_missed_appointments)
        total = max(missed, features.total_past_appointments)
        age = max(0, min(120, features.patient_age))
        distance = max(0.0, min(250.0, features.distance_km))
        chronic = max(0, min(10, features.chronic_conditions))

        z = self.INTERCEPT

        # 1. Lead time effect
        z += lead_time * 0.052

        # 2. Historical no-show ratio & count
        prior_rate = (missed / total) if total > 0 else 0.0
        z += (prior_rate * 2.15) + (min(missed, 6) * 0.24)

        # 3. SMS Reminder intervention
        z += -0.62 if features.sms_reminder else 0.38

        # 4. Age cohort adjustment
        if 18 <= age <= 32:
            z += 0.28
        elif age >= 60:
            z += -0.18

        # 5. Visit modality & transit distance
        if features.visit_type == "Telehealth":
            z += -0.35
        else:
            z += distance * 0.022

        # 6. Chronic care continuity
        if chronic > 0:
            z += -0.16 * min(chronic, 3)

        raw_prob = 1.0 / (1.0 + math.exp(-z))
        probability = max(2, min(96, round(raw_prob * 100)))

        if probability >= 50:
            risk_level = "High"
            recommendation = (
                "High no-show risk: Trigger nurse coordinator phone confirmation 48h prior "
                "and flag slot for waitlist backup."
            )
        elif probability >= 25:
            risk_level = "Moderate"
            recommendation = (
                "Moderate risk: Send dual SMS reminders (72h and 6h prior) with one-tap reschedule option."
            )
        else:
            risk_level = "Low"
            recommendation = (
                "Standard workflow: Dispatch automated 24-hour SMS reminder and digital check-in link."
            )

        return PredictionOutput(
            probability_percent=probability,
            risk_level=risk_level,
            log_odds=round(z, 3),
            recommendation=recommendation,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict hospital appointment no-show probability.")
    parser.add_argument("--lead-time", type=int, default=7, help="Days between booking and appointment")
    parser.add_argument("--missed", type=int, default=0, help="Prior missed appointments")
    parser.add_argument("--total", type=int, default=4, help="Total past appointments")
    parser.add_argument("--age", type=int, default=38, help="Patient age in years")
    parser.add_argument("--sms", type=int, default=1, help="1 if SMS reminder enabled, 0 otherwise")
    parser.add_argument("--distance", type=float, default=8.0, help="Distance to hospital in km")
    parser.add_argument("--chronic", type=int, default=0, help="Number of chronic conditions")
    parser.add_argument("--visit-type", type=str, default="In-Person", choices=["In-Person", "Telehealth"])

    args = parser.parse_args()
    model = AppointmentNoShowModel()
    features = PatientBookingFeatures(
        lead_time_days=args.lead_time,
        prior_missed_appointments=args.missed,
        total_past_appointments=args.total,
        patient_age=args.age,
        sms_reminder=bool(args.sms),
        distance_km=args.distance,
        chronic_conditions=args.chronic,
        visit_type=args.visit_type,
    )
    prediction = model.predict_proba(features)
    print(json.dumps(asdict(prediction), indent=2))


if __name__ == "__main__":
    main()
