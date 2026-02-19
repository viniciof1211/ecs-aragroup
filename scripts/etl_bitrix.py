"""
ETL Pipeline: Bitrix24 XLS Export → ECS Normalized Data
========================================================
Reads the Bitrix24 HTML-format XLS export, normalizes leads,
synthesizes interaction events, computes longitudinal ECS scores,
and outputs seed JSON files for the ECS Lead Intelligence platform.

Output files (in public/data/):
  - leads.json          : Normalized lead records
  - interactions.json   : Synthesized interaction events per lead
  - score_history.json  : Longitudinal ECS score snapshots per lead

Author: ECS ETL Pipeline
Date: 2026-02-18
"""

import json
import hashlib
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

# ─── Configuration ───────────────────────────────────────────────

FILE = r"C:\Users\vinicio.flores\Downloads\LEAD_20260218_9c3c2dc1_6995e080048d8.xls"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data")
NOW = datetime(2026, 2, 18, 10, 0, 0)  # Reference "now" for score calculations

# ─── Mapping Tables ──────────────────────────────────────────────

STAGE_TO_STATUS: dict[str, str] = {
    # Active pipeline stages
    "Contactando": "contacted",
    "Contactado": "contacted",
    "Asignado Euromobilia": "qualified",
    "Asignado Nouvell": "qualified",
    "En proceso de filtro Euromobilia-Bc3": "qualified",
    "Prospectos Electros Online": "new",
    "Atendido": "qualified",
    "Para Diseño": "proposal",
    "En espera de Fotos": "proposal",
    "Euromobilia": "qualified",
    "LISTA DE LEADS POSITIVOS": "negotiation",
    "Negocio a largo plazo": "negotiation",
    # Terminal stages
    "Perdido": "lost",
    "No interesados Nouvell": "lost",
    "borrar": "lost",
}

ORIGIN_TO_CHANNEL: dict[str, str] = {
    "Facebook Nouvell": "facebook",
    "Facebook Euromobilia": "facebook",
    "Facebook - Facebook - Euromobilia Hogar": "facebook",
    "Euromobilia Studio": "showroom",
    "BC3": "showroom",
    "Showroom": "showroom",
    "Laminat": "showroom",
    "Llamada": "phone",
    "E-Mail": "email",
    "Tienda online": "web",
    "Sitio Web": "web",
    "Formulario del CRM": "web",
    "Cliente Existente": "referral",
    "Por Recomendación": "referral",
    "Otro": "other",
}

LOSS_REASON_MAP: dict[str, str] = {
    "No Contesto": "no_response",
    "No le interesaba cotizar": "not_interested",
    "Duplicado": "duplicate",
    "Precio": "price",
    "Compro en la competencia": "competitor",
    "Compro con la constructora": "competitor",
    "No le funciono por tiempo": "timing",
    "No teniamos el producto que buscaba": "product_mismatch",
    "Era una Garantia": "warranty",
}

BUDGET_PATTERN = re.compile(r"\$[\d,.]+")

# ─── ECS Scoring Engine (Python port) ────────────────────────────

INTERACTION_WEIGHTS: dict[str, float] = {
    "lead_created": 5,
    "status_changed": 3,
    "note_added": 2,
    "call": 8,
    "email_sent": 4,
    "email_received": 6,
    "whatsapp": 7,
    "meeting": 10,
    "quote_sent": 9,
    "deal_won": 15,
    "deal_lost": -5,
    "form_submitted": 6,
    "page_visited": 1,
    "chat": 6,
    "web_visit": 2,
    "showroom_visit": 8,
    "facebook_lead": 5,
    "stage_change": 3,
    "contact_attempt": 4,
    "design_request": 9,
    "budget_qualified": 7,
}

DECAY_HALF_LIFE_DAYS = 14


def temporal_decay(days_since: float) -> float:
    return math.pow(0.5, max(days_since, 0) / DECAY_HALF_LIFE_DAYS)


def safe_parse_iso(val: str) -> datetime | None:
    try:
        return datetime.fromisoformat(val)
    except (ValueError, TypeError):
        return None


def calc_recency(interactions: list[dict], now: datetime) -> float:
    seven_days_ago = now - timedelta(days=7)
    total_w = 0.0
    for i in interactions:
        ts = safe_parse_iso(i["timestamp"])
        if ts and ts >= seven_days_ago:
            w = INTERACTION_WEIGHTS.get(i["type"], 3)
            total_w += max(w, 0)
    return min(total_w * 1.5, 25)


def calc_frequency(interactions: list[dict]) -> float:
    return min(len(interactions) * 1.5, 25)


def calc_depth(interactions: list[dict], now: datetime) -> float:
    total = 0.0
    for i in interactions:
        w = INTERACTION_WEIGHTS.get(i["type"], 3)
        ts = safe_parse_iso(i["timestamp"])
        if not ts:
            continue
        days = (now - ts).total_seconds() / 86400
        total += w * temporal_decay(days)
    return min(total * 0.8, 25)


def calc_channel_diversity(interactions: list[dict]) -> float:
    channels = set(i["channel"] for i in interactions)
    return min((len(channels) - 1) * 5, 15)


def calc_velocity(interactions: list[dict]) -> float:
    if len(interactions) < 4:
        return 0
    sorted_i = sorted(interactions, key=lambda x: x["timestamp"])
    mid = len(sorted_i) // 2
    old_half = sorted_i[:mid]
    new_half = sorted_i[mid:]

    def avg_gap(items: list[dict]) -> float:
        if len(items) < 2:
            return float("inf")
        total_gap = 0.0
        count = 0
        for j in range(1, len(items)):
            t1 = safe_parse_iso(items[j - 1]["timestamp"])
            t2 = safe_parse_iso(items[j]["timestamp"])
            if t1 and t2:
                total_gap += (t2 - t1).total_seconds()
                count += 1
        return total_gap / count if count > 0 else float("inf")

    old_gap = avg_gap(old_half)
    new_gap = avg_gap(new_half)
    if old_gap == float("inf") or new_gap == float("inf"):
        return 0
    acceleration = (old_gap - new_gap) / 86400
    return min(max(acceleration * 2, 0), 10)


def calculate_ecs_score(interactions: list[dict], now: datetime) -> dict:
    if not interactions:
        return {"recency": 0, "frequency": 0, "depth": 0,
                "channelDiversity": 0, "velocity": 0, "total": 0}
    r = calc_recency(interactions, now)
    f = calc_frequency(interactions, )
    d = calc_depth(interactions, now)
    cd = max(calc_channel_diversity(interactions), 0)
    v = calc_velocity(interactions)
    total = min(round(r + f + d + cd + v), 100)
    return {
        "recency": round(r, 1),
        "frequency": round(f, 1),
        "depth": round(d, 1),
        "channelDiversity": round(cd, 1),
        "velocity": round(v, 1),
        "total": total,
    }


def get_segment(score: int) -> str:
    if score >= 80:
        return "hot"
    if score >= 60:
        return "warm"
    if score >= 40:
        return "cool"
    if score >= 20:
        return "cold"
    if score >= 5:
        return "dormant"
    return "lost"


# ─── Helpers ─────────────────────────────────────────────────────

def make_id(prefix: str, *parts: Any) -> str:
    raw = "|".join(str(p) for p in parts)
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"{prefix}_{h}"


def parse_dt(val: Any) -> datetime | None:
    if pd.isna(val) or val is None or str(val).strip() == "" or str(val).strip() == "NaT":
        return None
    try:
        return datetime.strptime(str(val).strip(), "%d/%m/%Y %H:%M:%S")
    except ValueError:
        try:
            result = pd.to_datetime(val)
            if pd.isna(result):
                return None
            return result.to_pydatetime()
        except Exception:
            return None


def sanitize_value(val: Any) -> Any:
    """Ensure no NaT/NaN values leak into JSON output."""
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    if isinstance(val, str) and val.strip() in ("NaT", "nan", "NaN", ""):
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def sanitize_dict(d: dict) -> dict:
    """Recursively sanitize all values in a dict."""
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result[k] = sanitize_dict(v)
        elif isinstance(v, list):
            result[k] = [sanitize_dict(i) if isinstance(i, dict) else sanitize_value(i) for i in v]
        else:
            result[k] = sanitize_value(v)
    return result


def safe_str(val: Any) -> str | None:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s else None


def safe_float(val: Any) -> float:
    if pd.isna(val):
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def classify_origin_channel(origin: str | None) -> str:
    if not origin:
        return "unknown"
    o = origin.strip()
    # Direct match
    if o in ORIGIN_TO_CHANNEL:
        return ORIGIN_TO_CHANNEL[o]
    # Pattern matching
    ol = o.lower()
    if "whatsapp" in ol or "wz" in ol:
        return "whatsapp"
    if "facebook" in ol or "fb" in ol:
        return "facebook"
    if "instagram" in ol or "ig" in ol:
        return "instagram"
    if "telegram" in ol:
        return "telegram"
    if "llamada" in ol or "call" in ol:
        return "phone"
    if "mail" in ol or "e-mail" in ol:
        return "email"
    if "web" in ol or "sitio" in ol or "online" in ol or "tienda" in ol:
        return "web"
    if "showroom" in ol or "studio" in ol or "bc3" in ol or "laminat" in ol:
        return "showroom"
    if "formulario" in ol or "form" in ol:
        return "web"
    return "other"


def extract_budget_range(comment: str | None) -> str | None:
    """Extract budget info from Comentario field."""
    if not comment:
        return None
    c = str(comment).strip()
    # Known budget patterns from Bitrix forms
    budget_patterns = [
        ("más_de_$16.000", "$16,000+"),
        ("$12.000_-_$16.000", "$12,000-$16,000"),
        ("$8000_-_$12.000", "$8,000-$12,000"),
        ("$20.000_en_adelante", "$20,000+"),
        ("$5.000_–_$10,000", "$5,000-$10,000"),
        ("$15.000_–_$20,000", "$15,000-$20,000"),
        ("$20,000_o_más", "$20,000+"),
    ]
    for pattern, label in budget_patterns:
        if pattern in c:
            return label
    if BUDGET_PATTERN.search(c):
        return c
    return None


def extract_timeline_range(comment: str | None) -> str | None:
    """Extract project timeline from Comentario field."""
    if not comment:
        return None
    c = str(comment).strip()
    timeline_patterns = [
        ("4–6_months", "4-6 meses"),
        ("1–3_months", "1-3 meses"),
        ("6–12_months", "6-12 meses"),
        ("inmediato", "Inmediato"),
    ]
    for pattern, label in timeline_patterns:
        if pattern in c.lower():
            return label
    return None


def extract_division(row: pd.Series) -> str | None:
    """Extract brand/division from row."""
    div = safe_str(row.get("Division"))
    suc = safe_str(row.get("Sucursal"))
    return div or suc


# ─── Main ETL ────────────────────────────────────────────────────

def run_etl():
    print(f"[ETL] Reading {FILE}...")
    df = pd.read_html(FILE, encoding="utf-8")[0]
    print(f"[ETL] Loaded {len(df)} rows × {len(df.columns)} columns")

    # NOTE: We parse dates per-row below to avoid pandas NaT issues

    leads: list[dict] = []
    all_interactions: list[dict] = []
    all_score_history: list[dict] = []

    # Track progress
    total = len(df)
    skipped = 0

    for idx, row in df.iterrows():
        if idx % 2000 == 0:
            print(f"[ETL] Processing row {idx}/{total}...")

        bitrix_id = int(row["ID"]) if not pd.isna(row["ID"]) else None
        if bitrix_id is None:
            skipped += 1
            continue

        # ─── Lead normalization ───
        nombre = safe_str(row.get("Nombre")) or ""
        apellido = safe_str(row.get("Apellido")) or ""
        full_name = f"{nombre} {apellido}".strip()
        if not full_name:
            full_name = f"Lead #{bitrix_id}"

        lead_id = make_id("lead", bitrix_id)
        etapa = safe_str(row.get("Etapa")) or ""
        status = STAGE_TO_STATUS.get(etapa, "new")
        origin = safe_str(row.get("Origen"))
        channel = classify_origin_channel(origin)
        responsable = safe_str(row.get("Responsable"))
        company = safe_str(row.get("Nombre de la Compañía"))
        email = safe_str(row.get("E-mail del trabajo"))
        phone = safe_str(row.get("Móvil")) or safe_str(row.get("Teléfono del trabajo"))
        division = extract_division(row)
        total_amount = safe_float(row.get("Total"))
        currency = safe_str(row.get("Moneda"))
        comment = safe_str(row.get("Comentario"))
        loss_reason_raw = safe_str(row.get("porque no compro"))
        loss_reason = LOSS_REASON_MAP.get(loss_reason_raw or "", None)
        budget = extract_budget_range(comment)
        timeline = extract_timeline_range(comment)
        client_type = safe_str(row.get("Tipo de Cliente"))
        project_type = safe_str(row.get("Tipo de Proyecto"))
        design_type = safe_str(row.get("Tipo de Diseño"))
        designing = safe_str(row.get("Que estamos Diseñando"))
        product_sold = safe_str(row.get("Producto Vendido"))
        profile = safe_str(row.get("Perfil"))
        cargo = safe_str(row.get("Cargo"))
        source_info = safe_str(row.get("Información de origen"))
        stage_info = safe_str(row.get("Más información sobre esta etapa"))
        utm_source = safe_str(row.get("UTM Source"))
        crm_form = safe_str(row.get("Creado por el formulario del CRM"))

        created_dt = parse_dt(row.get("Creado"))
        modified_dt = parse_dt(row.get("Modificado"))
        last_contact_dt = parse_dt(row.get("Último contacto"))
        stage_changed_dt = parse_dt(row.get("Fecha de cambio de la etapa"))

        first_seen = created_dt
        last_seen = last_contact_dt or modified_dt or created_dt

        # Collect all channels this lead used
        lead_channels: set[str] = set()
        if channel != "unknown":
            lead_channels.add(channel)
        # Check for WhatsApp contact info
        if safe_str(row.get("Contacto de Viber")) or safe_str(row.get("Cuenta de Canal Abierto")):
            lead_channels.add("whatsapp")
        if safe_str(row.get("Chat en vivo")):
            lead_channels.add("chat")
        if email:
            lead_channels.add("email")
        if phone:
            lead_channels.add("phone")

        employees: set[str] = set()
        if responsable:
            employees.add(responsable)
        stage_changer = safe_str(row.get("Etapa cambiada por"))
        # stage_changer is an ID, not a name — skip adding it

        # ─── Synthesize interactions ───
        lead_interactions: list[dict] = []

        def add_interaction(
            itype: str, ts: datetime | None, ichannel: str | None = None,
            direction: str = "unknown", employee: str | None = None,
            duration: int | None = None, source: str | None = None,
            extra: dict | None = None,
        ):
            if ts is None or not isinstance(ts, datetime):
                return
            iid = make_id("int", lead_id, itype, ts.isoformat())
            ch = ichannel or channel
            lead_channels.add(ch)
            interaction = {
                "id": iid,
                "lead_id": lead_id,
                "bitrix_conversation_id": None,
                "bitrix_lead_id": bitrix_id,
                "bitrix_activity_id": None,
                "type": itype,
                "channel": ch,
                "direction": direction,
                "status": None,
                "timestamp": ts.isoformat(),
                "agent_replied_at": None,
                "last_message_at": None,
                "agent_closed_at": None,
                "message_count": None,
                "duration_seconds": duration,
                "first_response_seconds": None,
                "avg_response_seconds": None,
                "client_rating": None,
                "employee": employee or responsable,
                "source": source or origin,
                "raw_weight": INTERACTION_WEIGHTS.get(itype, 3),
                "decayed_weight": None,  # computed later
                "bitrix_raw": extra,
                "updated_at": NOW.isoformat(),
            }
            lead_interactions.append(interaction)

        # 1. Lead creation event
        if created_dt:
            source_type = "form_submitted" if crm_form else "lead_created"
            if channel == "facebook":
                source_type = "facebook_lead"
            elif channel == "showroom":
                source_type = "showroom_visit"
            elif channel == "web":
                source_type = "web_visit"
            add_interaction(source_type, created_dt, direction="entrante",
                            source=origin, extra={"origin": origin, "utm_source": utm_source})

        # 2. Stage change event (if different from creation)
        if stage_changed_dt and created_dt and stage_changed_dt != created_dt:
            add_interaction("stage_change", stage_changed_dt,
                            extra={"new_stage": etapa, "stage_info": stage_info})

        # 3. Contact attempt / last contact event
        if last_contact_dt and created_dt and last_contact_dt != created_dt:
            # Determine type based on channel
            contact_type = "contact_attempt"
            contact_channel = channel
            if channel == "whatsapp":
                contact_type = "whatsapp"
            elif channel == "phone":
                contact_type = "call"
            elif channel == "email":
                contact_type = "email_sent"
            elif channel == "facebook":
                contact_type = "chat"
            add_interaction(contact_type, last_contact_dt, ichannel=contact_channel,
                            direction="saliente", employee=responsable)

        # 4. Modification event (if distinct from others)
        if modified_dt and modified_dt != created_dt and modified_dt != stage_changed_dt and modified_dt != last_contact_dt:
            add_interaction("note_added", modified_dt, employee=responsable)

        # 5. Budget qualification event (from Comentario)
        if budget and created_dt:
            budget_dt = created_dt + timedelta(minutes=5)  # shortly after creation
            add_interaction("budget_qualified", budget_dt,
                            extra={"budget_range": budget, "timeline": timeline})

        # 6. Design request event
        if designing and created_dt:
            design_dt = (stage_changed_dt or created_dt) + timedelta(hours=1)
            add_interaction("design_request", design_dt,
                            extra={"designing": designing, "design_type": design_type,
                                   "project_type": project_type})

        # 7. Quote / deal events based on monetary value
        if total_amount > 0 and created_dt:
            quote_dt = (stage_changed_dt or modified_dt or created_dt) + timedelta(hours=2)
            add_interaction("quote_sent", quote_dt,
                            extra={"amount": total_amount, "currency": currency,
                                   "product": product_sold})

        # 8. Deal outcome events
        if status == "lost" and loss_reason_raw and loss_reason_raw != "Duplicado":
            loss_dt = stage_changed_dt or modified_dt or last_contact_dt or created_dt
            if loss_dt:
                add_interaction("deal_lost", loss_dt,
                                extra={"reason": loss_reason_raw, "reason_code": loss_reason})

        if product_sold and total_amount > 0:
            won_dt = (stage_changed_dt or modified_dt or created_dt) + timedelta(hours=3)
            if won_dt:
                add_interaction("deal_won", won_dt,
                                extra={"product": product_sold, "amount": total_amount})
                if status != "lost":
                    status = "won"

        # 9. Synthesize intermediate interactions for leads with long timelines
        if created_dt and last_seen and first_seen:
            span_days = (last_seen - first_seen).days
            if span_days > 14 and len(lead_interactions) < 4:
                # Add synthetic follow-up interactions
                num_synth = min(max(span_days // 14, 1), 6)
                for si in range(num_synth):
                    synth_dt = first_seen + timedelta(days=(si + 1) * (span_days / (num_synth + 1)))
                    synth_channel = channel if channel != "unknown" else "phone"
                    add_interaction("contact_attempt", synth_dt,
                                    ichannel=synth_channel, direction="saliente",
                                    employee=responsable)

        # 10. Source info interactions (contains call notes, presentations sent, etc.)
        if source_info and created_dt:
            si_lower = source_info.lower()
            if "llamada" in si_lower:
                call_dt = created_dt + timedelta(minutes=2)
                add_interaction("call", call_dt, ichannel="phone", direction="entrante")
            if "mand" in si_lower and ("info" in si_lower or "presentacion" in si_lower or "pp" in si_lower):
                email_dt = (last_contact_dt or created_dt) + timedelta(minutes=30)
                add_interaction("email_sent", email_dt, ichannel="email", direction="saliente")
            if "no contesta" in si_lower or "no esta interesad" in si_lower:
                # Failed contact attempt
                fail_dt = (last_contact_dt or created_dt) + timedelta(minutes=10)
                add_interaction("contact_attempt", fail_dt, direction="saliente",
                                extra={"outcome": "no_answer"})

        # Filter out interactions with no/invalid timestamp
        lead_interactions = [i for i in lead_interactions if i.get("timestamp")]

        # Sort interactions by timestamp
        lead_interactions.sort(key=lambda x: x["timestamp"])

        # Deduplicate by (type, timestamp) — keep first
        seen_keys: set[str] = set()
        deduped: list[dict] = []
        for inter in lead_interactions:
            key = f"{inter['type']}|{inter['timestamp']}"
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(inter)
        lead_interactions = deduped

        # Compute decayed weights
        for inter in lead_interactions:
            ts = safe_parse_iso(inter["timestamp"])
            if ts:
                days = (NOW - ts).total_seconds() / 86400
                w = inter["raw_weight"] or 3
                inter["decayed_weight"] = round(w * temporal_decay(days), 4)
            else:
                inter["decayed_weight"] = 0

        # ─── Longitudinal ECS score computation ───
        score_snapshots: list[dict] = []
        if lead_interactions:
            # Compute score at each interaction point
            cumulative: list[dict] = []
            prev_score = 0
            for inter in lead_interactions:
                cumulative.append(inter)
                ts = safe_parse_iso(inter["timestamp"])
                if not ts:
                    continue
                breakdown = calculate_ecs_score(cumulative, ts)
                score = breakdown["total"]
                delta = score - prev_score
                trend = "up" if delta > 2 else ("down" if delta < -2 else "stable")
                score_snapshots.append({
                    "lead_id": lead_id,
                    "score": score,
                    "previous_score": prev_score,
                    "delta": delta,
                    "trend": trend,
                    "breakdown": breakdown,
                    "calculated_at": ts.isoformat(),
                    "interaction_count": len(cumulative),
                })
                prev_score = score

            # Also compute "current" score (as of NOW)
            current_breakdown = calculate_ecs_score(lead_interactions, NOW)
            current_score = current_breakdown["total"]
        else:
            current_score = 0
            current_breakdown = {"recency": 0, "frequency": 0, "depth": 0,
                                 "channelDiversity": 0, "velocity": 0, "total": 0}

        # Previous score = score at second-to-last snapshot
        previous_score = score_snapshots[-2]["score"] if len(score_snapshots) >= 2 else 0

        segment = get_segment(current_score)

        # ─── Build lead record ───
        lead_record = {
            "id": lead_id,
            "lead_id": lead_id,
            "bitrix_id": bitrix_id,
            "name": full_name,
            "email": email,
            "phone": phone,
            "company": company,
            "brand": division,
            "source": origin,
            "status": status,
            "channels": sorted(lead_channels),
            "employees": sorted(employees),
            "interaction_count": len(lead_interactions),
            "total_messages": len(lead_interactions),
            "first_seen": first_seen.isoformat() if first_seen else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "bitrix_lead_ids": [bitrix_id],
            "current_score": current_score,
            "previous_score": previous_score,
            "segment": segment,
            "created_at": first_seen.isoformat() if first_seen else NOW.isoformat(),
            "last_interaction_at": last_seen.isoformat() if last_seen else None,
            "updated_at": NOW.isoformat(),
            # Extended fields for ECS analysis
            "etapa_bitrix": etapa,
            "loss_reason": loss_reason,
            "loss_reason_raw": loss_reason_raw,
            "budget_range": budget,
            "project_timeline": timeline,
            "client_type": client_type,
            "project_type": project_type,
            "design_type": design_type,
            "designing": designing,
            "product_sold": product_sold,
            "profile": profile,
            "cargo": cargo,
            "total_amount": total_amount,
            "currency": currency,
            "sucursal": safe_str(row.get("Sucursal")),
            "division": division,
            "utm_source": utm_source,
            "score_breakdown": current_breakdown,
            "bitrix_raw": None,  # omit raw to save space
        }

        leads.append(lead_record)
        all_interactions.extend(lead_interactions)
        all_score_history.extend(score_snapshots)

    # ─── Summary stats ───
    print(f"\n[ETL] ═══════════════════════════════════════")
    print(f"[ETL] Processed: {total - skipped} leads ({skipped} skipped)")
    print(f"[ETL] Interactions synthesized: {len(all_interactions)}")
    print(f"[ETL] Score snapshots: {len(all_score_history)}")

    # Status distribution
    status_counts = defaultdict(int)
    for l in leads:
        status_counts[l["status"]] += 1
    print(f"[ETL] Status distribution: {dict(status_counts)}")

    # Segment distribution
    seg_counts = defaultdict(int)
    for l in leads:
        seg_counts[l["segment"]] += 1
    print(f"[ETL] Segment distribution: {dict(seg_counts)}")

    # Score stats
    scores = [l["current_score"] for l in leads]
    print(f"[ETL] Score stats: min={min(scores)}, max={max(scores)}, "
          f"avg={sum(scores)/len(scores):.1f}, median={sorted(scores)[len(scores)//2]}")

    # Interactions per lead stats
    int_counts = defaultdict(int)
    for i in all_interactions:
        int_counts[i["lead_id"]] += 1
    ic_vals = list(int_counts.values())
    print(f"[ETL] Interactions/lead: min={min(ic_vals)}, max={max(ic_vals)}, "
          f"avg={sum(ic_vals)/len(ic_vals):.1f}")

    # Channel distribution
    ch_counts = defaultdict(int)
    for i in all_interactions:
        ch_counts[i["channel"]] += 1
    print(f"[ETL] Channel distribution: {dict(sorted(ch_counts.items(), key=lambda x: -x[1]))}")

    # ─── Write output files ───
    os.makedirs(OUT_DIR, exist_ok=True)

    leads_path = os.path.join(OUT_DIR, "leads.json")
    interactions_path = os.path.join(OUT_DIR, "interactions.json")
    score_history_path = os.path.join(OUT_DIR, "score_history.json")

    # ─── Sanitize all output ───
    print(f"\n[ETL] Sanitizing output...")
    leads = [sanitize_dict(l) for l in leads]
    all_interactions = [sanitize_dict(i) for i in all_interactions]
    all_score_history = [sanitize_dict(s) for s in all_score_history]

    # Strip null fields from interactions to reduce size
    def compact_interaction(i: dict) -> dict:
        """Remove null/None fields to reduce JSON size."""
        return {k: v for k, v in i.items() if v is not None}

    compact_interactions = [compact_interaction(i) for i in all_interactions]

    # Strip breakdown from score_history to reduce size (keep only totals)
    compact_history = []
    for s in all_score_history:
        compact_history.append({
            "lead_id": s["lead_id"],
            "score": s["score"],
            "previous_score": s["previous_score"],
            "delta": s["delta"],
            "trend": s["trend"],
            "calculated_at": s["calculated_at"],
            "interaction_count": s["interaction_count"],
        })

    print(f"[ETL] Writing {leads_path}...")
    with open(leads_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  → {os.path.getsize(leads_path) / 1024 / 1024:.1f} MB")

    print(f"[ETL] Writing {interactions_path}...")
    with open(interactions_path, "w", encoding="utf-8") as f:
        json.dump(compact_interactions, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  → {os.path.getsize(interactions_path) / 1024 / 1024:.1f} MB")

    print(f"[ETL] Writing {score_history_path}...")
    with open(score_history_path, "w", encoding="utf-8") as f:
        json.dump(compact_history, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  → {os.path.getsize(score_history_path) / 1024 / 1024:.1f} MB")

    print(f"\n[ETL] ✓ Done! Files written to {OUT_DIR}")
    return leads, all_interactions, all_score_history


if __name__ == "__main__":
    run_etl()
