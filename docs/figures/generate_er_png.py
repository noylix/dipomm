#!/usr/bin/env python3
"""Generate ER diagram PNG for communications module."""

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = Path(__file__).with_name("fig-er-communications.png")

plt.rcParams["font.family"] = "DejaVu Sans"
fig, ax = plt.subplots(figsize=(14, 10), dpi=150)
ax.set_xlim(0, 14)
ax.set_ylim(0, 10)
ax.axis("off")

CORE = dict(boxstyle="round,pad=0.35", facecolor="#dbeafe", edgecolor="#1d4ed8", linewidth=1.8)
EXT = dict(boxstyle="round,pad=0.35", facecolor="#f3f4f6", edgecolor="#6b7280", linewidth=1.2, linestyle="--")


def box(x, y, w, h, title, lines, style=CORE):
    patch = FancyBboxPatch((x, y), w, h, **style)
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="top", fontsize=10, fontweight="bold")
    text = "\n".join(lines)
    ax.text(x + 0.12, y + h - 0.45, text, ha="left", va="top", fontsize=8, linespacing=1.35)


def arrow(x1, y1, x2, y2, c1="", c2=""):
    arr = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12, linewidth=1.2, color="#1f2937")
    ax.add_patch(arr)
    if c1:
        ax.text((x1 + x2) / 2 - 0.15, (y1 + y2) / 2 + 0.12, c1, fontsize=8, fontweight="bold")
    if c2:
        ax.text((x1 + x2) / 2 + 0.15, (y1 + y2) / 2 + 0.12, c2, fontsize=8, fontweight="bold")


ax.text(7, 9.65, "ER-диаграмма модуля коммуникаций и управления сообществом", ha="center", fontsize=14, fontweight="bold")
ax.text(7, 9.35, "Маркетплейс «Свои Ряды»", ha="center", fontsize=10, color="#4b5563")

# External entities
box(0.4, 7.0, 2.0, 1.35, "users", ["PK id", "email, role", "full_name, farm_name", "is_approved"], EXT)
box(0.4, 5.3, 2.0, 1.0, "orders", ["PK id", "FK user_id", "status, total_price"], EXT)
box(0.4, 3.8, 2.0, 1.0, "products", ["PK id", "FK owner_id", "name, price, status"], EXT)

# Module entities
box(3.2, 7.3, 2.5, 1.45, "notifications", [
    "PK id", "FK user_id (nullable)", "type, subject, body", "is_read, created_at", "NULL = системное"
])
box(3.2, 5.0, 2.7, 1.75, "complaints", [
    "PK id", "FK user_id, target_user_id", "FK target_product_id, order_id",
    "category, text, status", "admin_response, attachment_path", "assigned_to_role"
])
box(3.2, 2.8, 2.5, 1.55, "reviews", [
    "PK id", "FK user_id, product_id, order_id", "rating, text, status",
    "seller_response", "pending / approved / rejected"
])
box(3.2, 0.9, 2.7, 1.35, "seller_reviews", [
    "PK id", "FK user_id, seller_id, order_id", "rating, text, status", "created_at"
])
box(7.3, 4.8, 2.8, 1.85, "conversations", [
    "PK id", "type (order_chat, product_question…)", "FK buyer_id, farmer_id, admin_id",
    "FK order_id, product_id, complaint_id", "status (open / resolved)", "created_at, updated_at"
])
box(11.0, 5.0, 2.3, 1.45, "messages", [
    "PK id", "FK conversation_id, sender_id", "sender_role, text",
    "attachment_path, is_read", "created_at"
])

# Relationships (unique only)
arrow(2.4, 7.7, 3.2, 7.9, "1", "N")
arrow(2.4, 7.3, 3.2, 6.0, "1", "N")
arrow(2.4, 5.7, 3.2, 5.8, "1", "N")
arrow(2.4, 4.2, 3.2, 5.5, "1", "N")
arrow(2.4, 7.0, 3.2, 3.5, "1", "N")
arrow(2.4, 4.0, 3.2, 3.2, "1", "N")
arrow(2.4, 7.1, 3.2, 1.5, "1", "N")
arrow(2.4, 7.5, 7.3, 5.8, "1", "N")
arrow(2.4, 5.6, 7.3, 5.5, "1", "N")
arrow(2.4, 4.1, 7.3, 5.2, "1", "N")
arrow(5.9, 5.7, 7.3, 5.7, "1", "0..1")
arrow(10.1, 5.7, 11.0, 5.7, "1", "N")

# Legend
leg = FancyBboxPatch((7.3, 0.55), 6.0, 1.55, boxstyle="round,pad=0.25", facecolor="#fff", edgecolor="#d1d5db")
ax.add_patch(leg)
ax.text(7.45, 1.85, "Условные обозначения", fontsize=9, fontweight="bold")
ax.text(7.45, 1.55, "■ синий блок — сущность модуля коммуникаций", fontsize=8)
ax.text(7.45, 1.30, "■ серый блок — связанные сущности маркетплейса", fontsize=8)
ax.text(7.45, 1.05, "PK — первичный ключ; FK — внешний ключ (доп. FK указаны в атрибутах)", fontsize=8)
ax.text(7.45, 0.80, "1:N — один ко многим; дублирующие связи к users убраны", fontsize=8)

ax.text(7, 0.15, "Рисунок — ER-диаграмма модуля коммуникаций и управления сообществом",
        ha="center", fontsize=9, color="#374151")

fig.tight_layout(pad=0.5)
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print(f"Saved: {OUT}")
