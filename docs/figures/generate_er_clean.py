#!/usr/bin/env python3
"""Clean database ER diagram for communications module."""

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = Path(__file__).with_name("fig-er-communications.png")

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 9,
    "axes.unicode_minus": False,
})

fig, ax = plt.subplots(figsize=(16, 11), dpi=200)
ax.set_xlim(0, 16)
ax.set_ylim(0, 11)
ax.axis("off")
fig.patch.set_facecolor("white")

CORE = dict(facecolor="#E8F0FE", edgecolor="#2563EB", linewidth=1.6, boxstyle="square,pad=0.02")
EXT = dict(facecolor="#F5F5F5", edgecolor="#888888", linewidth=1.2, boxstyle="square,pad=0.02", linestyle="--")


def entity(x, y, w, h, name, attrs, style=CORE, title_bg="#D0E2FF"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, **style))
    ax.add_patch(plt.Rectangle((x, y + h - 0.38), w, 0.38, facecolor=title_bg, edgecolor=style["edgecolor"], linewidth=style["linewidth"]))
    ax.text(x + w / 2, y + h - 0.19, name, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, (label, kind) in enumerate(attrs):
        yy = y + h - 0.58 - i * 0.28
        if kind == "pk":
            ax.text(x + 0.08, yy, label, ha="left", va="top", fontsize=8, fontweight="bold", color="#1D4ED8")
        elif kind == "fk":
            ax.text(x + 0.08, yy, label, ha="left", va="top", fontsize=8, color="#6D28D9")
        else:
            ax.text(x + 0.08, yy, label, ha="left", va="top", fontsize=8, color="#333333")
    return x, y, w, h


def connect(x1, y1, x2, y2, c1="1", c2="N", rad=0.0):
    style = "arc3,rad={}".format(rad) if rad else "arc3"
    arr = FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle="-|>", mutation_scale=11, linewidth=1.1, color="#222222",
        connectionstyle=style, shrinkA=2, shrinkB=2,
    )
    ax.add_patch(arr)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    ax.text(mx - 0.12, my + 0.08, c1, fontsize=8, fontweight="bold")
    ax.text(mx + 0.08, my + 0.08, c2, fontsize=8, fontweight="bold")


def hconnect(x1, y, x2, c1="1", c2="N"):
    connect(x1, y, x2, y, c1, c2)


ax.text(8, 10.55, "ER-диаграмма базы данных модуля коммуникаций и управления сообществом",
        ha="center", fontsize=14, fontweight="bold")
ax.text(8, 10.15, "Маркетплейс «Свои Ряды»", ha="center", fontsize=10, color="#555555")

u = entity(0.4, 8.0, 2.3, 1.55, "users", [
    ("id", "pk"), ("email", "n"), ("role", "n"), ("full_name", "n"), ("farm_name", "n"),
], EXT, "#EAEAEA")
o = entity(0.4, 5.8, 2.3, 1.05, "orders", [
    ("id", "pk"), ("user_id", "fk"), ("status", "n"), ("total_price", "n"),
], EXT, "#EAEAEA")
p = entity(0.4, 3.6, 2.3, 1.05, "products", [
    ("id", "pk"), ("owner_id", "fk"), ("name", "n"), ("price", "n"), ("status", "n"),
], EXT, "#EAEAEA")

entity(3.8, 8.2, 2.5, 1.45, "notifications", [
    ("id", "pk"), ("user_id", "fk"), ("type", "n"), ("subject", "n"), ("body", "n"), ("is_read", "n"),
])
entity(3.8, 5.5, 2.7, 2.15, "complaints", [
    ("id", "pk"), ("user_id", "fk"), ("target_user_id", "fk"), ("target_product_id", "fk"),
    ("order_id", "fk"), ("category", "n"), ("text", "n"), ("status", "n"), ("admin_response", "n"),
])
entity(3.8, 2.9, 2.5, 1.55, "reviews", [
    ("id", "pk"), ("user_id", "fk"), ("product_id", "fk"), ("order_id", "fk"),
    ("rating", "n"), ("text", "n"), ("status", "n"), ("seller_response", "n"),
])
entity(3.8, 0.55, 2.7, 1.25, "seller_reviews", [
    ("id", "pk"), ("user_id", "fk"), ("seller_id", "fk"), ("order_id", "fk"), ("rating", "n"), ("status", "n"),
])

entity(8.0, 5.2, 2.8, 2.35, "conversations", [
    ("id", "pk"), ("type", "n"), ("buyer_id", "fk"), ("farmer_id", "fk"), ("admin_id", "fk"),
    ("order_id", "fk"), ("product_id", "fk"), ("complaint_id", "fk"), ("status", "n"),
])
entity(12.0, 5.5, 2.4, 1.55, "messages", [
    ("id", "pk"), ("conversation_id", "fk"), ("sender_id", "fk"), ("sender_role", "n"),
    ("text", "n"), ("attachment_path", "n"), ("is_read", "n"),
])

ux, uy, uw, uh = u
hconnect(ux + uw, 8.75, 3.8, "1", "N")
hconnect(ux + uw, 7.8, 3.8, "1", "N")
hconnect(ux + uw, 3.95, 3.8, "1", "N")
hconnect(ux + uw, 1.15, 3.8, "1", "N")

ox, oy, ow, oh = o
hconnect(ox + ow, oy + oh / 2, 3.8, "1", "N")

px, py, pw, ph = p
connect(px + pw, py + ph * 0.55, 3.8, 6.2, "1", "N")
connect(px + pw, py + ph * 0.45, 3.8, 3.8, "1", "N")

hconnect(6.5, 6.8, 8.0, "1", "0..1")
hconnect(10.8, 6.4, 12.0, "1", "N")

connect(ux + uw, uy + 0.7, 8.0, 7.0, "1", "N", rad=-0.15)
connect(ox + ow, oy + oh / 2, 8.0, 6.5, "1", "N", rad=0.1)
connect(px + pw, py + ph / 2, 8.0, 6.0, "1", "N", rad=0.15)

leg = FancyBboxPatch((8.0, 0.45), 6.4, 1.55, boxstyle="square,pad=0.02", facecolor="white", edgecolor="#CCCCCC")
ax.add_patch(leg)
ax.text(8.15, 1.75, "Условные обозначения", fontsize=9, fontweight="bold")
ax.text(8.15, 1.45, "Синий блок — таблица модуля коммуникаций", fontsize=8)
ax.text(8.15, 1.20, "Серый блок — связанные таблицы маркетплейса", fontsize=8)
ax.text(8.15, 0.95, "PK — первичный ключ;  FK — внешний ключ", fontsize=8)
ax.text(8.15, 0.70, "1:N — один ко многим;  1:0..1 — один к нулю или одному", fontsize=8)

ax.text(8, 0.12, "Рисунок — ER-диаграмма базы данных модуля коммуникаций и управления сообществом",
        ha="center", fontsize=9, color="#444444")

fig.savefig(OUT, bbox_inches="tight", facecolor="white", pad_inches=0.15)
print(OUT)
